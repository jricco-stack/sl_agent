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
    const invoices         = data.bucket_3.A.supplier_invoices.invoice_line_items || [];
    const wasteLogs        = data.bucket_3.D.inventory_management.waste_gap_logs  || [];
    const kitchenWasteLogs = data.bucket_3.D.inventory_management.kitchen_waste_logs || [];

    const theoretical = invoices.reduce((s, i) => s + i.cost, 0);
    const actual      = wasteLogs.reduce((s, l) => s + l.cost, 0)
                      + kitchenWasteLogs.reduce((s, l) => s + l.cost, 0);

    return { theoretical, actual };
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

export async function runAnalysis() {
    const rawData    = await runPythonScript("data.py");
    const menuMatrix = buildMenuMatrix(rawData);
    const foodCost   = buildFoodCost(rawData);

    const researchData = [
        { type: "menu_engineering", data: menuMatrix },
        { type: "food_cost", data: [["Theoretical Food Cost", foodCost.theoretical], ["Actual Food Cost", foodCost.actual]] },
        { type: "data", data: rawData },
    ];
    researchData.push({ type: "benchmarks", data: benchmarkSummary(researchData) });

    const alerts  = checkAlerts(researchData);
    const result  = await openai.invoke(buildAnalysisPrompt(researchData));
    const cleaned = (result.content || result).replace(/```json\n?|```/g, "").trim();

    let aiOutput;
    try {
        aiOutput = JSON.parse(cleaned);
    } catch {
        aiOutput = { insights: [], recommendations: [], alerts: [], prime_cost_status: "unknown" };
    }

    return {
        menu_matrix:        menuMatrix,
        food_cost:          foodCost,
        benchmarks:         researchData.find(r => r.type === "benchmarks").data,
        operational_alerts: alerts,
        ai:                 aiOutput,
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
