# Plan B: Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based dashboard that calls the REST API from Plan A and shows restaurant owners their key metrics — menu engineering quadrants, food cost vs. benchmark, alerts, and a Q&A chat — with no Slack required.

**Architecture:** Vanilla HTML/CSS/JS served statically by the existing Express server. No build step, no framework — just files the original author can open and read. The dashboard fetches from `/api/*` on the same origin. Plan A must be complete before starting this plan.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (fetch API), Chart.js (CDN, no install), Express static file serving

**Prerequisite:** Plan A (api-refactor) must be complete — the dashboard calls `/api/analysis`, `/api/menu-engineering`, `/api/alerts`, `/api/question`.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `web/index.html` | Create | Dashboard shell — layout, navigation tabs, Chart.js script tag |
| `web/app.js` | Create | All JS — fetch from API, render charts and tables, handle Q&A |
| `web/style.css` | Create | Clean, readable CSS — no framework, no dependencies |
| `api.js` | Modify | Uncomment the `express.static("web")` line added in Plan A |

---

## Task 1: Set up the web/ folder and serve it from Express

**Files:**
- Modify: `api.js` (one line uncomment)
- Create: `web/index.html`

- [ ] **Step 1: Uncomment the static file line in `api.js`**

In `api.js`, find the commented line and uncomment it:

```javascript
// Before:
// app.use(express.static("web"));

// After:
app.use(express.static("web"));
```

This tells Express to serve everything in the `web/` folder at `/`.

- [ ] **Step 2: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restaurant Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Restaurant Dashboard</h1>
        <nav>
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="menu">Menu Engineering</button>
            <button class="tab-btn" data-tab="food-cost">Food Cost</button>
            <button class="tab-btn" data-tab="alerts">Alerts</button>
            <button class="tab-btn" data-tab="ask">Ask a Question</button>
        </nav>
    </header>

    <main>
        <!-- Overview Tab -->
        <section id="tab-overview" class="tab active">
            <div class="status-bar">
                <div class="status-card" id="prime-cost-card">
                    <span class="label">Prime Cost Status</span>
                    <span class="value" id="prime-cost-status">—</span>
                </div>
                <div class="status-card">
                    <span class="label">Food Cost</span>
                    <span class="value" id="food-cost-pct">—</span>
                </div>
                <div class="status-card">
                    <span class="label">Active Alerts</span>
                    <span class="value" id="alert-count">—</span>
                </div>
            </div>
            <div class="card">
                <h2>Key Insights</h2>
                <ul id="insights-list"><li class="loading">Loading...</li></ul>
            </div>
            <div class="card">
                <h2>Recommendations</h2>
                <ul id="recommendations-list"><li class="loading">Loading...</li></ul>
            </div>
        </section>

        <!-- Menu Engineering Tab -->
        <section id="tab-menu" class="tab">
            <div class="quadrant-grid">
                <div class="quadrant star">
                    <h3>⭐ Stars</h3>
                    <p class="quadrant-desc">High margin, high sales — protect these</p>
                    <ul id="stars-list"></ul>
                </div>
                <div class="quadrant puzzle">
                    <h3>🧩 Puzzles</h3>
                    <p class="quadrant-desc">High margin, low sales — promote these</p>
                    <ul id="puzzles-list"></ul>
                </div>
                <div class="quadrant plow-horse">
                    <h3>🐴 Plow Horses</h3>
                    <p class="quadrant-desc">Low margin, high sales — reprice or reduce cost</p>
                    <ul id="plow-horses-list"></ul>
                </div>
                <div class="quadrant dog">
                    <h3>🐕 Dogs</h3>
                    <p class="quadrant-desc">Low margin, low sales — consider removing</p>
                    <ul id="dogs-list"></ul>
                </div>
            </div>
        </section>

        <!-- Food Cost Tab -->
        <section id="tab-food-cost" class="tab">
            <div class="card">
                <h2>Theoretical vs Actual Food Cost</h2>
                <canvas id="food-cost-chart" height="120"></canvas>
            </div>
            <div class="card">
                <h2>Benchmark Comparison</h2>
                <table id="benchmarks-table">
                    <thead><tr><th>Metric</th><th>Yours</th><th>Industry Range</th><th>Status</th></tr></thead>
                    <tbody id="benchmarks-body"></tbody>
                </table>
            </div>
        </section>

        <!-- Alerts Tab -->
        <section id="tab-alerts" class="tab">
            <div class="card">
                <h2>Active Alerts</h2>
                <ul id="alerts-list"><li class="loading">Loading...</li></ul>
            </div>
        </section>

        <!-- Ask a Question Tab -->
        <section id="tab-ask" class="tab">
            <div class="card chat-card">
                <h2>Ask about your restaurant</h2>
                <div id="chat-messages"></div>
                <form id="chat-form">
                    <input type="text" id="chat-input" placeholder="e.g. Which items have the best margins?" autocomplete="off">
                    <button type="submit">Ask</button>
                </form>
            </div>
        </section>
    </main>

    <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add api.js web/index.html
git commit -m "feat: serve web dashboard from Express static files"
```

---

## Task 2: Write app.js — data fetching and rendering

**Files:**
- Create: `web/app.js`

- [ ] **Step 1: Create `web/app.js`**

```javascript
// Tab navigation
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});

// Fetch full analysis on load
async function loadDashboard() {
    try {
        const res    = await fetch("/api/analysis");
        const data   = await res.json();
        renderOverview(data);
        renderMenuEngineering(data.menu_matrix);
        renderFoodCost(data.food_cost, data.benchmarks);
        renderAlerts(data.operational_alerts);
    } catch (err) {
        console.error("Failed to load dashboard:", err);
    }
}

function renderOverview(data) {
    const ai = data.ai || {};

    // Prime cost status card
    const statusEl = document.getElementById("prime-cost-status");
    statusEl.textContent = ai.prime_cost_status || "unknown";
    statusEl.className   = "value " + (ai.prime_cost_status || "unknown");

    // Food cost %
    const fc = data.food_cost;
    if (fc && fc.theoretical > 0) {
        const pct = ((fc.actual / fc.theoretical) * 100).toFixed(1);
        document.getElementById("food-cost-pct").textContent = `${pct}%`;
    }

    // Alert count
    document.getElementById("alert-count").textContent =
        (data.operational_alerts || []).length;

    // Insights
    const insightsList = document.getElementById("insights-list");
    insightsList.innerHTML = (ai.insights || ["No insights yet"]).map(i =>
        `<li>${i}</li>`
    ).join("");

    // Recommendations
    const recsList = document.getElementById("recommendations-list");
    recsList.innerHTML = (ai.recommendations || ["No recommendations yet"]).map(r =>
        `<li>${r}</li>`
    ).join("");
}

function renderMenuEngineering(matrix) {
    if (!matrix || matrix.length === 0) return;

    const lists = { Star: "stars-list", Puzzle: "puzzles-list", "Plow Horse": "plow-horses-list", Dog: "dogs-list" };

    // Clear
    Object.values(lists).forEach(id => document.getElementById(id).innerHTML = "");

    matrix.forEach(item => {
        const listId = lists[item.category];
        if (!listId) return;
        const li = document.createElement("li");
        li.textContent = `${item.name} (margin: $${item.margin.toFixed(2)})`;
        document.getElementById(listId).appendChild(li);
    });

    // Fill empty quadrants
    Object.values(lists).forEach(id => {
        const el = document.getElementById(id);
        if (el.children.length === 0) el.innerHTML = "<li class='empty'>None</li>";
    });
}

let foodCostChart = null;

function renderFoodCost(foodCost, benchmarks) {
    // Bar chart
    if (foodCostChart) foodCostChart.destroy();
    const ctx = document.getElementById("food-cost-chart").getContext("2d");
    foodCostChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Theoretical Food Cost", "Actual Food Cost"],
            datasets: [{
                label: "Cost ($)",
                data: [foodCost?.theoretical || 0, foodCost?.actual || 0],
                backgroundColor: ["#4a90e2", "#e05c5c"],
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
        }
    });

    // Benchmarks table
    const tbody = document.getElementById("benchmarks-body");
    tbody.innerHTML = (benchmarks || []).map(b => `
        <tr class="status-${b.status}">
            <td>${b.label}</td>
            <td>${b.actual}</td>
            <td>${b.benchmark}</td>
            <td>${b.status}</td>
        </tr>
    `).join("") || "<tr><td colspan='4'>No benchmark data yet</td></tr>";
}

function renderAlerts(alerts) {
    const list = document.getElementById("alerts-list");
    list.innerHTML = (alerts && alerts.length > 0)
        ? alerts.map(a => `<li class="alert-item">${a}</li>`).join("")
        : "<li>No active alerts</li>";
}

// Q&A chat
document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input    = document.getElementById("chat-input");
    const question = input.value.trim();
    if (!question) return;

    appendMessage("you", question);
    input.value = "";

    try {
        const res  = await fetch("/api/question", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ question }),
        });
        const data = await res.json();
        appendMessage("bot", data.answer || "No answer returned.");
    } catch (err) {
        appendMessage("bot", "Sorry, something went wrong.");
    }
});

function appendMessage(sender, text) {
    const messages = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

loadDashboard();
```

- [ ] **Step 2: Commit**

```bash
git add web/app.js
git commit -m "feat: add dashboard app.js — renders overview, menu matrix, food cost chart, alerts, Q&A"
```

---

## Task 3: Write style.css — clean, readable styles

**Files:**
- Create: `web/style.css`

- [ ] **Step 1: Create `web/style.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f5f6fa;
    color: #2d2d2d;
    line-height: 1.5;
}

header {
    background: #1a1a2e;
    color: white;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 32px;
}

header h1 { font-size: 1.25rem; font-weight: 600; }

nav { display: flex; gap: 8px; }

.tab-btn {
    background: transparent;
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.2);
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
}

.tab-btn:hover   { background: rgba(255,255,255,0.1); color: white; }
.tab-btn.active  { background: white; color: #1a1a2e; font-weight: 600; }

main { max-width: 1100px; margin: 0 auto; padding: 24px; }

.tab { display: none; }
.tab.active { display: block; }

.card {
    background: white;
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 16px; color: #444; }

/* Status bar */
.status-bar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 20px;
}

.status-card {
    background: white;
    border-radius: 8px;
    padding: 16px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.status-card .label { font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
.status-card .value { font-size: 1.5rem; font-weight: 700; color: #2d2d2d; }

.value.healthy  { color: #27ae60; }
.value.warning  { color: #f39c12; }
.value.critical { color: #e74c3c; }

/* Lists */
ul { list-style: none; }
ul li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; }
ul li:last-child { border-bottom: none; }
ul li.loading { color: #aaa; }
ul li.empty   { color: #aaa; font-style: italic; }

.alert-item { color: #c0392b; }
.alert-item::before { content: "⚠ "; }

/* Menu engineering quadrants */
.quadrant-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.quadrant {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border-top: 4px solid transparent;
}

.quadrant h3        { font-size: 1rem; margin-bottom: 4px; }
.quadrant-desc      { font-size: 0.8rem; color: #888; margin-bottom: 12px; }
.quadrant.star      { border-top-color: #f1c40f; }
.quadrant.puzzle    { border-top-color: #3498db; }
.quadrant.plow-horse{ border-top-color: #e67e22; }
.quadrant.dog       { border-top-color: #95a5a6; }

/* Benchmarks table */
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th    { text-align: left; padding: 8px 12px; border-bottom: 2px solid #eee; color: #888; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
td    { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }

tr.status-above td:last-child { color: #e74c3c; font-weight: 600; }
tr.status-below td:last-child { color: #3498db; }
tr.status-within td:last-child { color: #27ae60; font-weight: 600; }

/* Chat */
.chat-card { display: flex; flex-direction: column; gap: 16px; }

#chat-messages {
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0;
}

.message {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.9rem;
    line-height: 1.4;
}

.message.you { background: #1a1a2e; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
.message.bot { background: #f0f0f0; color: #2d2d2d; align-self: flex-start; border-bottom-left-radius: 4px; }

#chat-form { display: flex; gap: 10px; }

#chat-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    outline: none;
}

#chat-input:focus { border-color: #1a1a2e; }

#chat-form button {
    padding: 10px 20px;
    background: #1a1a2e;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
}

#chat-form button:hover { background: #2d2d4e; }
```

- [ ] **Step 2: Commit**

```bash
git add web/style.css
git commit -m "feat: add dashboard styles"
```

---

## Task 4: Final check

- [ ] **Step 1: Start the server and open the dashboard**

```bash
node index.js
```

Open: `http://localhost:3000`

Expected: Dashboard loads, tabs navigate, all sections render (data will be empty until Toast is wired up, but structure should show)

- [ ] **Step 2: Test the Q&A endpoint directly**

```bash
curl -X POST http://localhost:3000/api/question \
  -H "Content-Type: application/json" \
  -d '{"question": "What is my food cost?"}'
```

Expected: `{"answer": "..."}`

- [ ] **Step 3: Update README — add dashboard section**

Add to README.md:

```markdown
## Web Dashboard

Visit `http://localhost:3000` after starting the server. The dashboard shows:

- **Overview** — prime cost status, key insights, recommendations
- **Menu Engineering** — items sorted into Stars, Puzzles, Plow Horses, Dogs
- **Food Cost** — theoretical vs actual bar chart, benchmark comparison table
- **Alerts** — active operational alerts
- **Ask a Question** — chat directly with the AI about your restaurant data
```

- [ ] **Step 4: Commit and push**

```bash
git add web/ README.md
git commit -m "feat: web dashboard complete — Plan B done"
git push
```
