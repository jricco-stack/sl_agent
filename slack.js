import pkg from "@slack/bolt";
const { App } = pkg;
import { WebClient } from "@slack/web-api";
import { runAnalysis, askQuestion } from "./engine.js";

const log = {
    info:  (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
};

export function createSlackBot() {
    const slack = new App({
        token:         process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        socketMode:    true,
        appToken:      process.env.SLACK_APP_TOKEN,
    });

    const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

    // @mention — run full analysis and post to channel
    slack.event("app_mention", async ({ event, say }) => {
        try {
            log.info(`Mentioned by ${event.user} in ${event.channel}`);
            const result = await runAnalysis();
            await postAnalysis(webClient, event.channel, result);
        } catch (error) {
            log.error("app_mention error:", error.message);
            await say("Sorry, something went wrong while processing your request.");
        }
    });

    // Direct message — Q&A
    slack.message(async ({ message, say }) => {
        if (message.subtype || !message.text) return;
        try {
            log.info(`Message from ${message.user}: ${message.text}`);
            const answer = await askQuestion(message.text);
            await say(answer);
        } catch (error) {
            log.error("message handler error:", error.message);
            await say("Sorry, I couldn't process that question.");
        }
    });

    slack.error(async (error) => log.error("Slack error:", error.message));

    return { slack, webClient };
}

async function postAnalysis(webClient, channelId, result) {
    const channel  = channelId || process.env.SLACK_CHANNEL_ID;
    const insights = result.ai?.insights || [];
    const alerts   = [...(result.operational_alerts || []), ...(result.ai?.alerts || [])];

    const blocks = [
        {
            type: "header",
            text: { type: "plain_text", text: "Restaurant Analysis" }
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `*Insights*\n${insights.map(i => `• ${i}`).join("\n") || "No insights yet"}`
                },
                {
                    type: "mrkdwn",
                    text: `*Alerts*\n${alerts.map(a => `• ${a}`).join("\n") || "No alerts"}`
                }
            ]
        }
    ];

    await webClient.chat.postMessage({ channel, text: "Restaurant Analysis", blocks });
}

export async function sendMorningDigest(webClient) {
    const channelId = process.env.SLACK_CHANNEL_ID;
    if (!channelId) return;
    const result   = await runAnalysis();
    const insights = result.ai?.insights || [];
    const text     = `*Good morning! Here's your daily restaurant snapshot:*\n\n`
                   + (insights.map(i => `• ${i}`).join("\n") || "No insights available yet - check your data connection.");
    await webClient.chat.postMessage({ channel: channelId, text });
    log.info("Morning digest sent");
}

export async function checkAndSendAlerts(webClient) {
    const channelId = process.env.SLACK_CHANNEL_ID;
    if (!channelId) return;
    const result = await runAnalysis();
    const alerts = result.operational_alerts || [];
    if (alerts.length > 0) {
        const text = `*Alert:*\n` + alerts.map(a => `• ${a}`).join("\n");
        await webClient.chat.postMessage({ channel: channelId, text });
        log.info(`Sent ${alerts.length} alert(s)`);
    }
}
