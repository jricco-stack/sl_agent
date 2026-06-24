# Plan A: Platform-Agnostic REST API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the analysis logic out of the Slack-specific Agent class into a standalone engine, then expose it as a clean REST API so any frontend or third-party tool can consume it.

**Architecture:** `index.js` currently mixes Slack, Express, and analysis logic in one class. Split into three focused files: `engine.js` (pure analysis, no I/O), `api.js` (Express routes that call the engine), and `slack.js` (Slack bot that also calls the engine). `index.js` becomes a thin entry point that starts both servers.

**Tech Stack:** Node.js ES modules, Express.js (already installed), existing analysis modules (benchmarks.js, alerts.js, menuengineering.py, etc.)

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `engine.js` | Create | Pure analysis — runAnalysis(), askQuestion(), getAlerts(), getMenuMatrix(), getFoodCost(). No Slack, no HTTP. |
| `api.js` | Create | Express REST API — mounts routes, calls engine, returns JSON |
| `slack.js` | Create | Slack bot — event handlers only, calls engine for data |
| `index.js` | Modify | Entry point — starts api.js and slack.js, nothing else |

---

## Task 1: Create engine.js — pure analysis with no I/O

**Files:**
- Create: `engine.js`

The engine takes data in and returns structured results. No Slack calls, no HTTP, no side effects.

- [ ] **Step 1: Create `engine.js` with the core analysis functions**

```javascript
import { exec } from "child_process";
import { promisify } from "util";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ChatOpenAI } from "@langchain/openai";
import { benchmarkSummary } from "./benchmarks.js";
import { checkAlerts } from "./alerts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

const openai = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.3,
    apiKey: process.env.OPENAI_API_KEY,
});

async function runPythonScript(scriptName) {
    const scriptPath = join(__dirname, scriptName);
    const { stdout } = await execAsync(`python "${scriptPath}"`);
    return JSON.parse(stdout.trim());
}

function buildMenuMatrix(data) {
    const salesByMealPeriod = data.bucket_1.A.pos_reports.sales_by_meal_period || {};
    const contributionMargin = data.bucket_1.B.menu_performance.contribution_margin || {};

    if (Object.keys(contributionMargin).length === 0) return [];

    const items = Object.entries(contributionMargin).map(([name, margin]) => ({
        name, margin, sales: salesByMealPeriod[name] || 0
    }));

    const avgMargin = items.reduce((s, i) => s + i.margin, 0) / items.length;
    const avgSales  = items.reduce((s, i) => s + i.sales,  0) / items.length;

    return items.map(item => {
        const highMargin = item.margin >= avgMargin;
        const highSales  = item.sales  >= avgSales;
        let category;
        if      ( highMargin &&  highSales) category = "Star";
        else if ( highMargin && !highSales) category = "Puzzle";
        else if (!highMargin &&  highSales) category = "Plow Horse";
        else                               category = "Dog";
        return { name: item.name, margin: item.margin, sales: item.sales, category };
    });
}

function buildFoodCost(data) {
    const invoices  = data.bucket_3.A.supplier_invoices.invoice_line_items || [];
    const wasteLogs = data.bucket_3.D.inventory_management.waste_gap_logs  || [];
    const kitchenWasteLogs = data.bucket_3.D.inventory_management.kitchen_waste_logs || [];

    const theoretical = invoices.reduce((s, i) => s + i.cost, 0);
    const actual = wasteLogs.reduce((s, l) => s + l.cost, 0)
                 + kitchenWasteLogs.reduce((s, l) => s + l.cost, 0);

    return { theoretical, actual };
}

export async function runAnalysis() {
    const rawData    = await runPythonScript("data.py");
    const menuMatrix = buildMenuMatrix(rawData);
    const foodCost   = buildFoodCost(rawData);

    const researchData = [
        { type: "menu_engineering", data: menuMatrix },
        { type: "food_cost",        data: [["Theoretical Food Cost", foodCost.theoretical], ["Actual Food Cost", foodCost.actual]] },
        { type: "data",             data: rawData },
    ];
    researchData.push({ type: "benchmarks", data: benchmarkSummary(researchData) });

    const alerts  = checkAlerts(researchData);
    const prompt  = buildAnalysisPrompt(researchData);
    const result  = await openai.invoke(prompt);
    const cleaned = (result.content || result).replace(/```json\n?|```/g, "").trim();

    let aiOutput;
    try {
        aiOutput = JSON.parse(cleaned);
    } catch {
        aiOutput = { insights: [], recommendations: [], alerts: [], prime_cost_status: "unknown" };
    }

    return {
        menu_matrix:      menuMatrix,
        food_cost:        foodCost,
        benchmarks:       researchData.find(r => r.type === "benchmarks").data,
        operational_alerts: alerts,
        ai:               aiOutput,
    };
}

export async function askQuestion(question) {
    const rawData      = await runPythonScript("data.py");
    const menuMatrix   = buildMenuMatrix(rawData);
    const foodCost     = buildFoodCost(rawData);
    const researchData = [
        { type: "menu_engineering", data: menuMatrix },
        { type: "food_cost", data: [["Theoretical Food Cost", foodCost.theoretical], ["Actual Food Cost", foodCost.actual]] },
    ];

    const prompt = `You are a restaurant business analyst assistant. Answer this owner's question using their operational data.

Question: ${question}

Their data:
${JSON.stringify(researchData, null, 2)}

Give a direct, plain-English answer. If the data doesn't have what you need, say so and tell them what data they'd need. Keep it under 3 sentences.`;

    const result = await openai.invoke(prompt);
    return result.content || result;
}

function buildAnalysisPrompt(researchData) {
    return `You are a restaurant business analyst. Analyze this operational data and give the owner specific, actionable insights.

Operational Data:
${JSON.stringify(researchData, null, 2)}

Industry benchmarks (NRA casual dining):
- Food cost: 28-32% of revenue
- Labor cost: 28-35% of revenue
- Prime cost (food + labor combined): under 60% of revenue
- Rent: 5-10% of revenue

Just give me back JSON with these keys:
- insights: array of specific observations, include dollar amounts where possible
- recommendations: array of specific actions the owner can take this week
- alerts: array of anything that needs immediate attention
- prime_cost_status: one of "healthy", "warning", or "critical"`;
}
```

- [ ] **Step 2: Verify it parses cleanly**

```bash
node --check engine.js
```
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add engine.js
git commit -m "feat: extract analysis engine into engine.js — no Slack/HTTP dependencies"
```

---

## Task 2: Create api.js — REST API over the engine

**Files:**
- Create: `api.js`

- [ ] **Step 1: Create `api.js`**

```javascript
import express from "express";
import dotenv from "dotenv";
import { runAnalysis, askQuestion } from "./engine.js";

dotenv.config();

const router = express.Router();

// GET /api/analysis — full analysis snapshot
router.get("/analysis", async (req, res) => {
    try {
        const result = await runAnalysis();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu-engineering — menu matrix only
router.get("/menu-engineering", async (req, res) => {
    try {
        const result = await runAnalysis();
        res.json(result.menu_matrix);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/food-cost — food cost comparison only
router.get("/food-cost", async (req, res) => {
    try {
        const result = await runAnalysis();
        res.json(result.food_cost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/alerts — current operational alerts only
router.get("/alerts", async (req, res) => {
    try {
        const result = await runAnalysis();
        res.json(result.operational_alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/benchmarks — benchmark comparisons only
router.get("/benchmarks", async (req, res) => {
    try {
        const result = await runAnalysis();
        res.json(result.benchmarks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/question — Q&A, body: { question: "..." }
router.post("/question", async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });
    try {
        const answer = await askQuestion(question);
        res.json({ answer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export function createApiServer() {
    const app = express();
    app.use(express.json());

    // Health check
    app.get("/health", (req, res) => {
        res.json({ status: "OK", timestamp: new Date().toISOString() });
    });

    app.use("/api", router);

    // Serve web dashboard (added in Plan B)
    // app.use(express.static("web"));

    // Dev test endpoint
    if (process.env.NODE_ENV === "development") {
        app.post("/test/analyze", async (req, res) => {
            try {
                const result = await runAnalysis();
                res.json({ success: true, result, timestamp: new Date().toISOString() });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    app.use((err, req, res, next) => {
        console.error("[API ERROR]", err.message);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
    });

    return app;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check api.js
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add api.js
git commit -m "feat: add REST API in api.js — /api/analysis, /api/menu-engineering, /api/food-cost, /api/alerts, /api/benchmarks, /api/question"
```

---

## Task 3: Create slack.js — Slack bot extracted from index.js

**Files:**
- Create: `slack.js`

Pull the Slack-specific code out of index.js's Agent class. The bot calls `runAnalysis()` and `askQuestion()` from engine.js — no analysis logic lives here.

- [ ] **Step 1: Create `slack.js`**

```javascript
import pkg from "@slack/bolt";
const { App } = pkg;
import { WebClient } from "@slack/web-api";
import { runAnalysis, askQuestion } from "./engine.js";
import { startScheduler } from "./scheduler.js";

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
    const channel = channelId || process.env.SLACK_CHANNEL_ID;
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

    await webClient.chat.postMessage({
        channel,
        text: "Restaurant Analysis",
        blocks,
    });
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
```

- [ ] **Step 2: Verify syntax**

```bash
node --check slack.js
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add slack.js
git commit -m "feat: extract Slack bot into slack.js — calls engine.js, no analysis logic inline"
```

---

## Task 4: Refactor index.js — thin entry point only

**Files:**
- Modify: `index.js`

Replace the entire current `index.js` with a thin startup file that imports and starts `api.js` and `slack.js`. All analysis logic is now in `engine.js`.

- [ ] **Step 1: Replace `index.js` contents**

```javascript
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

        // Start REST API
        const apiApp = createApiServer();
        const port   = process.env.PORT || 3000;
        const server = apiApp.listen(port, () => {
            log.info(`API server running on port ${port}`);
        });

        // Start Slack bot
        const { slack, webClient } = createSlackBot();
        await slack.start();
        log.info("Slack bot connected");

        // Start scheduler — passes webClient so it can post to Slack
        startScheduler({
            sendMorningDigest:  () => sendMorningDigest(webClient),
            checkAndSendAlerts: () => checkAndSendAlerts(webClient),
        });
        log.info("Slack AI agent is up and running");

        if (process.env.NODE_ENV === "development") {
            log.info(`API: http://localhost:${port}/api/analysis`);
        }

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
```

- [ ] **Step 2: Update `scheduler.js` to accept an object with callbacks instead of the whole Agent instance**

Replace the current `startScheduler(agent)` signature:

```javascript
// scheduler.js — updated to accept callbacks directly
import cron from "node-cron";

export function startScheduler({ sendMorningDigest, checkAndSendAlerts }) {
    // Morning digest — every day at 7:00am
    cron.schedule("0 7 * * *", async () => {
        try {
            await sendMorningDigest();
        } catch (error) {
            console.error("[SCHEDULER] Morning digest failed:", error.message);
        }
    });

    // Alert check — every hour during service hours (10am–11pm)
    cron.schedule("0 10-23 * * *", async () => {
        try {
            await checkAndSendAlerts();
        } catch (error) {
            console.error("[SCHEDULER] Alert check failed:", error.message);
        }
    });

    console.log("[SCHEDULER] Cron jobs started — digest at 7am, alerts every hour 10am-11pm");
}
```

- [ ] **Step 3: Verify all files parse cleanly**

```bash
node --check index.js && node --check api.js && node --check engine.js && node --check slack.js && node --check scheduler.js
```
Expected: no output from any file

- [ ] **Step 4: Commit**

```bash
git add index.js scheduler.js
git commit -m "refactor: index.js is now a thin entry point — starts api.js and slack.js separately"
```

---

## Task 5: Final integration check

- [ ] **Step 1: Confirm the old Agent class is fully gone from index.js**

```bash
grep -n "class Agent" index.js
```
Expected: no output

- [ ] **Step 2: Confirm no Slack imports remain in engine.js or api.js**

```bash
grep -n "slack" engine.js api.js
```
Expected: no output

- [ ] **Step 3: Confirm all syntax is clean across the whole project**

```bash
for f in index.js engine.js api.js slack.js scheduler.js benchmarks.js alerts.js db.js toast.js; do
  node --check "$f" && echo "$f OK"
done
```
Expected: each file prints `OK`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete API/Slack/engine separation — Plan A done"
```
