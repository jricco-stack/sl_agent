import cron from "node-cron";

// Pass the agent instance in so the scheduler can call its methods directly
export function startScheduler(agent) {
    // Morning digest — every day at 7:00am
    cron.schedule("0 7 * * *", async () => {
        try {
            await agent.sendMorningDigest();
        } catch (error) {
            console.error("[SCHEDULER] Morning digest failed:", error.message);
        }
    });

    // Alert check — every hour during service hours (10am–11pm)
    cron.schedule("0 10-23 * * *", async () => {
        try {
            await agent.checkAndSendAlerts();
        } catch (error) {
            console.error("[SCHEDULER] Alert check failed:", error.message);
        }
    });

    console.log("[SCHEDULER] Cron jobs started — digest at 7am, alerts every hour 10am-11pm");
}
