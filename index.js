// Using ChatGPT right now because I have API credits left over from a school project that I've already bought. Can be easily exchanged for another brain.
import dotenv from "dotenv";
dotenv.config();

import { initDatabase, closeDatabase } from "./db.js";
import { createApiServer } from "./api.js";
import { createSlackBot, sendMorningDigest, checkAndSendAlerts } from "./slack.js";
import { startScheduler } from "./scheduler.js";

const log = {
    info:  (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
};

const slackConfigured = process.env.SLACK_BOT_TOKEN
    && process.env.SLACK_SIGNING_SECRET
    && process.env.SLACK_APP_TOKEN;

async function start() {
    try {
        log.info("Initializing database...");
        await initDatabase();

        // Start REST API + web dashboard
        const apiApp = createApiServer();
        const port   = process.env.PORT || 3000;
        const server = apiApp.listen(port, () => {
            log.info(`API server running on port ${port}`);
            log.info(`Dashboard: http://localhost:${port}`);
        });

        // Slack bot is optional — only starts if tokens are configured
        if (slackConfigured) {
            const { slack, webClient } = createSlackBot();
            await slack.start();
            log.info("Slack bot connected");

            startScheduler({
                sendMorningDigest:  () => sendMorningDigest(webClient),
                checkAndSendAlerts: () => checkAndSendAlerts(webClient),
            });

            process.on("SIGINT",  async () => { await slack.stop(); shutdown(server); });
            process.on("SIGTERM", async () => { await slack.stop(); shutdown(server); });
        } else {
            log.info("Slack not configured — running in web/API mode only");
            process.on("SIGINT",  () => shutdown(server));
            process.on("SIGTERM", () => shutdown(server));
        }

        log.info("Up and running");

    } catch (error) {
        log.error("Failed to start:", error.message);
        process.exit(1);
    }
}

async function shutdown(server) {
    log.info("Shutting down...");
    await new Promise(resolve => server.close(resolve));
    await closeDatabase();
    log.info("Stopped");
    process.exit(0);
}

start();
