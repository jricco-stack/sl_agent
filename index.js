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

        // Start Slack bot
        const { slack, webClient } = createSlackBot();
        await slack.start();
        log.info("Slack bot connected");

        // Start scheduler
        startScheduler({
            sendMorningDigest:  () => sendMorningDigest(webClient),
            checkAndSendAlerts: () => checkAndSendAlerts(webClient),
        });
        log.info("Slack AI agent is up and running");

        async function stop() {
            log.info("Shutting down...");
            await slack.stop();
            await new Promise(resolve => server.close(resolve));
            await closeDatabase();
            log.info("Stopped successfully");
            process.exit(0);
        }

        process.on("SIGINT",  stop);
        process.on("SIGTERM", stop);

    } catch (error) {
        log.error("Failed to start:", error.message);
        process.exit(1);
    }
}

start();
