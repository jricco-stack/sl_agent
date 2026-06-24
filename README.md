# sl_agent — Restaurant Intelligence Slack Bot

A Slack bot that pulls your restaurant's operational data, analyzes it with AI, and posts specific, actionable insights back to your team. Built on top of Toast POS data.

---

## What it does

- **Morning digest** — every day at 7am, posts a snapshot of your key metrics to Slack
- **Proactive alerts** — checks hourly (10am–11pm) and flags anything that needs attention, like food cost running above benchmark or menu items that aren't pulling their weight
- **On-demand analysis** — @mention the bot in any channel and it runs a full analysis on the spot
- **Q&A** — send the bot a direct message and ask it anything: "How did we do last Saturday?" or "Which items have the best margins?"
- **Menu engineering** — automatically classifies every menu item into one of four quadrants (Stars, Puzzles, Plow Horses, Dogs) based on contribution margin and sales volume
- **Benchmarking** — compares your numbers against NRA casual dining industry standards and flags where you're out of range

---

## Files

| File | What it does |
|---|---|
| `index.js` | Main entry point — sets up the Slack bot, Express server, and wires everything together |
| `db.js` | SQLite database — saves every analysis so you have a history |
| `benchmarks.js` | NRA industry benchmark data and comparison logic |
| `alerts.js` | Threshold checks — fires alerts when numbers go outside normal ranges |
| `scheduler.js` | Cron jobs for the morning digest and hourly alert checks |
| `toast.js` | Toast API client — fetches orders, menu items, and labor data |
| `data.py` | Schema definition for all restaurant data (POS, labor, supply chain, overhead) |
| `convertdata.py` | Maps raw Toast API responses into the data.py schema |
| `menuengineering.py` | Stars/Puzzles/Plow Horses/Dogs classification logic |
| `foodcost.py` | Theoretical vs. actual food cost comparison |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your `.env` file

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
SLACK_CHANNEL_ID=C...
OPENAI_API_KEY=sk-...
TOAST_CLIENT_ID=...
TOAST_CLIENT_SECRET=...
TOAST_LOCATION_GUID=...
```

### 3. Run

```bash
node index.js
```

---

## How the analysis works

When triggered (by @mention, morning digest, or alert check), the bot runs this pipeline:

1. **Fetch data** — calls `data.py` to get the current restaurant data snapshot
2. **Menu engineering** — classifies every menu item into a quadrant based on its contribution margin vs. the average and its sales vs. the average
3. **Food cost** — calculates theoretical food cost (from supplier invoices) vs. actual (from waste logs)
4. **Benchmarking** — compares food cost %, labor %, prime cost %, and rent % against NRA casual dining industry ranges
5. **Alert check** — flags anything above threshold with a dollar amount attached (e.g. "food cost is 36% — that's roughly $800 extra this period")
6. **AI analysis** — sends all of the above to GPT-4 with the benchmark context, asks for specific insights and recommendations with dollar amounts where possible
7. **Post to Slack** — formats the output and posts it to the configured channel

---

## Menu engineering quadrants

| Quadrant | Margin | Sales | What to do |
|---|---|---|---|
| **Star** | High | High | Protect these — they're your best items |
| **Puzzle** | High | Low | Good margin but not selling — better placement or promotion |
| **Plow Horse** | Low | High | Popular but thin margin — look at repricing or cost reduction |
| **Dog** | Low | Low | Consider removing or redesigning |

---

## Toast API integration

The `toast.js` client handles authentication and fetching from three Toast endpoints:

- `/orders/v2/orders` — sales and transaction data
- `/config/v2/menus` — menu items and pricing
- `/labor/v1/timeEntries` — hours and wages by role

The `convertdata.py` script maps the raw Toast responses into the bucket structure defined in `data.py`. Once Toast credentials are in `.env`, call the `convert_*` functions in `convertdata.py` to populate the schema before analysis runs.

---

## What's still to do

1. **Wire Toast into the data pipeline** — `toast.js` and `convertdata.py` are built, they just need to be called on a schedule to keep the data fresh
2. **24/7 dynamic updates** — hook the Toast sync into the scheduler so data refreshes automatically
3. **Multi-location support** — the current architecture assumes one restaurant; extending to multiple locations would require a location ID tied to each Slack workspace or user

 
