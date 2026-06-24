# Restaurant Agent Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform sl_agent from a reactive Slack bot with empty data into a proactive restaurant intelligence tool that gives owners specific, dollar-denominated insights.

**Architecture:** Nine focused tasks — fix two existing bugs, complete the analytics core (menu engineering, benchmarks, AI prompt), add proactive scheduling and alerts, add conversational Q&A, and scaffold the Toast API data pipeline.

**Tech Stack:** Node.js (ES modules), Python 3, LangChain + OpenAI GPT-4, Slack Bolt, node-cron, better-sqlite3, axios

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `index.js` | Modify | Fix execSync bug, fix LangChain template bug, integrate all new modules, add chat handler |
| `menuengineering.py` | Modify | Add Stars/Dogs/Puzzles/Plowhorses classification |
| `benchmarks.js` | Create | NRA industry benchmark data + comparison functions |
| `alerts.js` | Create | Threshold logic for food cost spikes, revenue variance, labor overrun |
| `scheduler.js` | Create | node-cron jobs for morning digest and alert polling |
| `toast.js` | Create | Toast API client — authenticate, fetch orders/labor/menu |
| `convertdata.py` | Modify | Implement Toast JSON → data.py schema mapping |

---

## Task 1: Fix execSync — replace blocking subprocess with async

**Files:**
- Modify: `index.js` (the `runPythonScript` function, ~line 56)

- [ ] **Step 1: Replace `execSync` with promisified `exec`**

In `index.js`, replace the import and `runPythonScript` function:

```javascript
// Remove: import { execSync } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

async function runPythonScript(scriptName) {
    const scriptPath = join(__dirname, scriptName);
    const { stdout } = await execAsync(`python "${scriptPath}"`);
    return JSON.parse(stdout.trim());
}
```

- [ ] **Step 2: Update `doBasicResearch` to await the async call**

```javascript
async doBasicResearch(businessInfo) {
    const results = [];
    try {
        const dataMatrix = await runPythonScript("data.py");
        const meMatrix = menuEngineering(dataMatrix);
        const fcMatrix = foodCostAnalysis(dataMatrix);
        const companyInfo = businessInfo.domain ? await this.getCompanyInfo(businessInfo.domain) : null;
        results.push({ type: "menu_engineering", data: meMatrix });
        results.push({ type: "food_cost", data: fcMatrix });
        results.push({ type: "data", data: dataMatrix });
        results.push({ type: "company_info", data: companyInfo });
    } catch (error) {
        log.error(`Error during basic research for ${businessInfo.name}:`, error.message);
    }
    return results;
}
```

- [ ] **Step 3: Verify no remaining `execSync` references**

Run: `grep -n "execSync" index.js`
Expected: no output

---

## Task 2: Fix LangChain template — remove mismatched variable system

**Files:**
- Modify: `index.js` (the `analyzeWithAI` method, ~line 208)

The current code uses `ChatPromptTemplate.fromTemplate` but the template has no `{variable}` placeholders — data is baked in via JS template literals. Then `chain.invoke()` passes variables that don't exist in the template. Fix: call `this.openai.invoke()` directly.

- [ ] **Step 1: Replace `analyzeWithAI` with a direct invocation approach**

```javascript
async analyzeWithAI(businessInfo, researchData) {
    try {
        const prompt = `You are a restaurant business analyst. Analyze this operational data and give the owner specific, actionable insights.

Business: ${businessInfo.name} (${businessInfo.domain || "unknown domain"})

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

        const result = await this.openai.invoke(prompt);
        const responseText = result.content || result;
        const cleaned = responseText.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        log.error(`AI analysis failed for ${businessInfo.name}:`, error.message);
        return { insights: [], recommendations: [], alerts: [], prime_cost_status: "unknown", error: error.message };
    }
}
```

- [ ] **Step 2: Remove the now-unused `ChatPromptTemplate` import**

Check if `ChatPromptTemplate` is used anywhere else:
```bash
grep -n "ChatPromptTemplate" index.js
```
If only in the import line, remove: `import { ChatPromptTemplate } from "@langchain/core/prompts";`

---

## Task 3: Complete menu engineering — Stars/Dogs/Puzzles/Plowhorses

**Files:**
- Modify: `menuengineering.py`

The current script just lists items with margins. Add the classic four-quadrant classification based on contribution margin vs. average margin, and sales vs. average sales.

- [ ] **Step 1: Replace `menu_engineering()` with classified output**

```python
import json
import data

all_data = json.loads(data.data())
bucket_1 = all_data["bucket_1"]

def menu_engineering():
    pos_reports = bucket_1['A']['pos_reports']
    menu_performance = bucket_1['B']['menu_performance']

    sales_by_meal_period = pos_reports.get('sales_by_meal_period', {})
    contribution_margin = menu_performance.get('contribution_margin', {})

    if not contribution_margin:
        return json.dumps([])

    items = []
    for item_name, margin in contribution_margin.items():
        sales = sales_by_meal_period.get(item_name, 0)
        items.append({ "name": item_name, "margin": margin, "sales": sales })

    avg_margin = sum(i["margin"] for i in items) / len(items)
    avg_sales = sum(i["sales"] for i in items) / len(items)

    def classify(item):
        high_margin = item["margin"] >= avg_margin
        high_sales = item["sales"] >= avg_sales
        if high_margin and high_sales:
            return "Star"
        elif high_margin and not high_sales:
            return "Puzzle"
        elif not high_margin and high_sales:
            return "Plow Horse"
        else:
            return "Dog"

    matrix = []
    for item in items:
        matrix.append([
            item["name"],
            item["margin"],
            item["sales"],
            classify(item)
        ])

    return json.dumps(matrix)

if __name__ == "__main__":
    print(menu_engineering())
```

- [ ] **Step 2: Update the JS `menuEngineering()` function in `index.js` to handle the new 4-element rows**

```javascript
function menuEngineering(data) {
    const matrix = [];
    const bucket1 = data.bucket_1;
    const posReports = bucket1.A.pos_reports;
    const menuPerformance = bucket1.B.menu_performance;
    const salesByMealPeriod = posReports.sales_by_meal_period || {};
    const contributionMargin = menuPerformance.contribution_margin || {};

    if (Object.keys(contributionMargin).length === 0) return matrix;

    const items = Object.entries(contributionMargin).map(([name, margin]) => ({
        name, margin, sales: salesByMealPeriod[name] || 0
    }));

    const avgMargin = items.reduce((s, i) => s + i.margin, 0) / items.length;
    const avgSales = items.reduce((s, i) => s + i.sales, 0) / items.length;

    for (const item of items) {
        const highMargin = item.margin >= avgMargin;
        const highSales = item.sales >= avgSales;
        let category;
        if (highMargin && highSales) category = "Star";
        else if (highMargin && !highSales) category = "Puzzle";
        else if (!highMargin && highSales) category = "Plow Horse";
        else category = "Dog";
        matrix.push([item.name, item.margin, item.sales, category]);
    }
    return matrix;
}
```

---

## Task 4: Benchmarks module

**Files:**
- Create: `benchmarks.js`

- [ ] **Step 1: Create `benchmarks.js`**

```javascript
// NRA casual dining industry benchmarks (National Restaurant Association)
const BENCHMARKS = {
    food_cost_pct:     { low: 0.28, high: 0.32 },
    labor_cost_pct:    { low: 0.28, high: 0.35 },
    prime_cost_pct:    { low: 0.55, high: 0.65 },
    rent_pct:          { low: 0.05, high: 0.10 },
    beverage_cost_pct: { low: 0.18, high: 0.24 },
    supplies_pct:      { low: 0.01, high: 0.03 },
};

export function compareToBenchmark(metric, actual) {
    const bench = BENCHMARKS[metric];
    if (!bench || actual == null) return null;

    const midpoint = (bench.low + bench.high) / 2;
    let status;
    if (actual < bench.low) status = "below";
    else if (actual > bench.high) status = "above";
    else status = "within";

    return {
        metric,
        actual: `${(actual * 100).toFixed(1)}%`,
        benchmark: `${(bench.low * 100).toFixed(1)}–${(bench.high * 100).toFixed(1)}%`,
        status,
        delta_from_midpoint: ((actual - midpoint) * 100).toFixed(1) + "%",
    };
}

export function benchmarkSummary(researchData) {
    const results = [];
    const foodCost = researchData.find(r => r.type === "food_cost");
    if (foodCost && foodCost.data.length === 2) {
        const theoretical = foodCost.data[0][1];
        const actual = foodCost.data[1][1];
        if (theoretical > 0) {
            results.push(compareToBenchmark("food_cost_pct", actual / theoretical));
        }
    }
    return results.filter(Boolean);
}
```

- [ ] **Step 2: Import and use in `doBasicResearch` in `index.js`**

Add import at top of `index.js`:
```javascript
import { benchmarkSummary } from "./benchmarks.js";
```

In `doBasicResearch`, after building `results`:
```javascript
const benchmarks = benchmarkSummary(results);
results.push({ type: "benchmarks", data: benchmarks });
```

---

## Task 5: Proactive alerts

**Files:**
- Create: `alerts.js`

- [ ] **Step 1: Create `alerts.js`**

```javascript
// Threshold-based alert logic — returns array of alert strings
export function checkAlerts(researchData) {
    const alerts = [];

    const foodCost = researchData.find(r => r.type === "food_cost");
    if (foodCost && foodCost.data.length === 2) {
        const theoretical = foodCost.data[0][1];
        const actual = foodCost.data[1][1];
        if (theoretical > 0) {
            const pct = actual / theoretical;
            if (pct > 0.35) {
                alerts.push(`Food cost is ${(pct * 100).toFixed(1)}% — above the 32% benchmark. At your current revenue this is costing you an extra $${Math.round((pct - 0.30) * theoretical).toLocaleString()}/period.`);
            }
        }
    }

    const menuData = researchData.find(r => r.type === "menu_engineering");
    if (menuData && menuData.data.length > 0) {
        const dogs = menuData.data.filter(row => row[3] === "Dog");
        if (dogs.length > 0) {
            alerts.push(`${dogs.length} menu item(s) are Dogs (low margin, low sales): ${dogs.map(d => d[0]).join(", ")}. Consider removing or repricing.`);
        }
        const puzzles = menuData.data.filter(row => row[3] === "Puzzle");
        if (puzzles.length > 0) {
            alerts.push(`${puzzles.length} menu item(s) are Puzzles (high margin, low sales): ${puzzles.map(p => p[0]).join(", ")}. These need better placement or promotion.`);
        }
    }

    return alerts;
}
```

- [ ] **Step 2: Import and wire into `analyzeAndPostBusiness` in `index.js`**

```javascript
import { checkAlerts } from "./alerts.js";
```

In `analyzeAndPostBusiness`, after getting `researchData`:
```javascript
const operationalAlerts = checkAlerts(researchData);
if (operationalAlerts.length > 0) {
    log.info(`${operationalAlerts.length} operational alert(s) for ${businessInfo.name}`);
}
```

Pass `operationalAlerts` into `analyzeWithAI` and merge with the AI-generated alerts before posting.

---

## Task 6: Morning digest + scheduler

**Files:**
- Create: `scheduler.js`

- [ ] **Step 1: Install node-cron**

```bash
npm install node-cron
```

- [ ] **Step 2: Create `scheduler.js`**

```javascript
import cron from "node-cron";

// Pass the agent instance in so the scheduler can trigger its methods
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

    console.log("[SCHEDULER] Cron jobs started");
}
```

- [ ] **Step 3: Add `sendMorningDigest()` and `checkAndSendAlerts()` to the Agent class in `index.js`**

```javascript
async sendMorningDigest() {
    const channelId = process.env.SLACK_CHANNEL_ID;
    if (!channelId) return;

    const placeholderInfo = { name: "Your Restaurant", email: null, domain: null };
    const researchData = await this.doBasicResearch(placeholderInfo);
    const analysis = await this.analyzeWithAI(placeholderInfo, researchData);

    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    const text = `*Good morning! Here's your daily restaurant snapshot:*\n\n` +
        insights.map(i => `• ${i}`).join("\n") || "No insights available yet — check your data connection.";

    await this.webClient.chat.postMessage({ channel: channelId, text });
    log.info("Morning digest sent");
}

async checkAndSendAlerts() {
    const channelId = process.env.SLACK_CHANNEL_ID;
    if (!channelId) return;

    const placeholderInfo = { name: "Your Restaurant", email: null, domain: null };
    const researchData = await this.doBasicResearch(placeholderInfo);
    const alerts = checkAlerts(researchData);

    if (alerts.length > 0) {
        const text = `*Alert:*\n` + alerts.map(a => `• ${a}`).join("\n");
        await this.webClient.chat.postMessage({ channel: channelId, text });
        log.info(`Sent ${alerts.length} alert(s)`);
    }
}
```

- [ ] **Step 4: Start the scheduler in `agent.start()`**

```javascript
import { startScheduler } from "./scheduler.js";

// Inside start():
startScheduler(this);
log.info("Scheduler started");
```

---

## Task 7: Chat / Q&A handler

**Files:**
- Modify: `index.js` (the `setupSlackEvents` method)

The current bot only responds to `app_mention`. Add a `message` listener so owners can ask questions in plain English.

- [ ] **Step 1: Add a message event listener in `setupSlackEvents`**

```javascript
this.slack.message(async ({ message, say }) => {
    // Ignore bot messages and messages with no text
    if (message.subtype || !message.text) return;

    try {
        log.info(`Direct message from ${message.user}: ${message.text}`);
        const researchData = await this.doBasicResearch({ name: "restaurant", email: null, domain: null });
        const answer = await this.answerQuestion(message.text, researchData);
        await say(answer);
    } catch (error) {
        log.error("Error handling message:", error.message);
        await say("Sorry, I couldn't process that question.");
    }
});
```

- [ ] **Step 2: Add `answerQuestion()` to the Agent class**

```javascript
async answerQuestion(question, researchData) {
    try {
        const prompt = `You are a restaurant business analyst assistant. Answer this owner's question using their operational data.

Question: ${question}

Their data:
${JSON.stringify(researchData, null, 2)}

Give a direct, plain-English answer. If the data doesn't have what you need to answer, say so and tell them what data they'd need. Keep it under 3 sentences.`;

        const result = await this.openai.invoke(prompt);
        return result.content || result;
    } catch (error) {
        log.error("answerQuestion failed:", error.message);
        return "I ran into an error trying to answer that — check the logs.";
    }
}
```

---

## Task 8: Toast API scaffolding

**Files:**
- Create: `toast.js`
- Modify: `convertdata.py`

- [ ] **Step 1: Create `toast.js`**

```javascript
import axios from "axios";

const TOAST_BASE = "https://ws-api.toasttab.com";

export class ToastClient {
    constructor() {
        this.clientId = process.env.TOAST_CLIENT_ID;
        this.clientSecret = process.env.TOAST_CLIENT_SECRET;
        this.locationGuid = process.env.TOAST_LOCATION_GUID;
        this.token = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        const response = await axios.post(`${TOAST_BASE}/authentication/v1/authentication/login`, {
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            userAccessType: "TOAST_MACHINE_CLIENT",
        });
        this.token = response.data.token.accessToken;
        this.tokenExpiry = Date.now() + (response.data.token.expiresIn * 1000);
    }

    async ensureAuth() {
        if (!this.token || Date.now() >= this.tokenExpiry - 60000) {
            await this.authenticate();
        }
    }

    get headers() {
        return {
            Authorization: `Bearer ${this.token}`,
            "Toast-Restaurant-External-ID": this.locationGuid,
        };
    }

    async getOrders(startDate, endDate) {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/orders/v2/orders`, {
            headers: this.headers,
            params: { startDate, endDate },
        });
        return response.data;
    }

    async getMenuItems() {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/config/v2/menus`, {
            headers: this.headers,
        });
        return response.data;
    }

    async getLaborEntries(startDate, endDate) {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/labor/v1/timeEntries`, {
            headers: this.headers,
            params: { startDate, endDate },
        });
        return response.data;
    }
}
```

- [ ] **Step 2: Add required env vars to `.env` example (in README or a `.env.example` file)**

Add to the project:
```
TOAST_CLIENT_ID=your_toast_client_id
TOAST_CLIENT_SECRET=your_toast_client_secret
TOAST_LOCATION_GUID=your_location_guid
```

- [ ] **Step 3: Update `convertdata.py` with the mapping skeleton**

```python
# Converts raw Toast API JSON exports into the data.py schema format.
# Call this once per sync cycle before running analysis scripts.
import json

def convert_orders_to_pos_reports(orders):
    """Map Toast orders list to bucket_1.A.pos_reports shape."""
    sales_by_meal_period = {}
    for order in orders:
        period = order.get("mealPeriod", {}).get("name", "Unknown")
        total = order.get("totalAmount", 0)
        sales_by_meal_period[period] = sales_by_meal_period.get(period, 0) + total
    return { "sales_by_meal_period": sales_by_meal_period }

def convert_menu_items_to_performance(menu_items):
    """Map Toast menu config to bucket_1.B.menu_performance shape."""
    contribution_margin = {}
    for item in menu_items:
        name = item.get("name", "Unknown")
        price = item.get("price", 0)
        cost = item.get("cost", 0)
        contribution_margin[name] = price - cost
    return { "contribution_margin": contribution_margin }

def convert_labor_to_payroll(labor_entries):
    """Map Toast time entries to bucket_2.A.payroll_records shape."""
    payroll_by_role = {}
    for entry in labor_entries:
        role = entry.get("jobReference", {}).get("title", "Unknown")
        hours = entry.get("regularHours", 0)
        rate = entry.get("hourlyWage", 0)
        payroll_by_role[role] = payroll_by_role.get(role, 0) + (hours * rate)
    return { "payroll_by_role": payroll_by_role }

if __name__ == "__main__":
    # Example: load raw Toast exports from files and convert
    print("convertdata.py: run with Toast API data to populate the schema.")
```

---

## Final integration check

- [ ] Verify all new imports are at the top of `index.js`
- [ ] Verify `.env` has entries for all required vars: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID`, `OPENAI_API_KEY`, `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_LOCATION_GUID`
- [ ] Run `node --check index.js` to catch any syntax errors
