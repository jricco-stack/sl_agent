// Using ChatGPT right now because I have API credits left over from a school project that I've already bought. Can be easily exchanged for another brain.

import { ChatOpenAI } from "@langchain/openai";

import { initDatabase, saveBusinessAnalysis, markAsSentToSlack, closeDatabase } from "./db.js";
import { benchmarkSummary } from "./benchmarks.js";
import { checkAlerts } from "./alerts.js";
import { startScheduler } from "./scheduler.js";


import pkg from "@slack/bolt";

const { App } = pkg;

import { WebClient } from "@slack/web-api";

import express from "express";

import dotenv from "dotenv";

import axios from "axios";

import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

import { fileURLToPath } from "url";

import { dirname, join } from "path";



const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);



function menuEngineering(data) {
    const bucket1 = data.bucket_1;
    const posReports = bucket1.A.pos_reports;
    const menuPerformance = bucket1.B.menu_performance;
    const salesByMealPeriod = posReports.sales_by_meal_period || {};
    const contributionMargin = menuPerformance.contribution_margin || {};

    if (Object.keys(contributionMargin).length === 0) return [];

    const items = Object.entries(contributionMargin).map(([name, margin]) => ({
        name, margin, sales: salesByMealPeriod[name] || 0
    }));

    const avgMargin = items.reduce((s, i) => s + i.margin, 0) / items.length;
    const avgSales = items.reduce((s, i) => s + i.sales, 0) / items.length;

    return items.map(item => {
        const highMargin = item.margin >= avgMargin;
        const highSales = item.sales >= avgSales;
        let category;
        if (highMargin && highSales) category = "Star";
        else if (highMargin && !highSales) category = "Puzzle";
        else if (!highMargin && highSales) category = "Plow Horse";
        else category = "Dog";
        return [item.name, item.margin, item.sales, category];
    });
}
function foodCostAnalysis(data) {

    const matrix = [];

    const bucket3 = data.bucket_3;

    const supplierInvoices = bucket3.A.supplier_invoices;



    const totalTheoreticalFoodCost = (supplierInvoices.invoice_line_items || []).reduce(

        (sum, item) => sum + item.cost, 0

    );



    const wasteLogs = bucket3.D.inventory_management.waste_gap_logs;

    const kitchenWasteLogs = bucket3.D.inventory_management.kitchen_waste_logs;



    const totalActualFoodCost =

        wasteLogs.reduce((sum, log) => sum + log.cost, 0) +

        kitchenWasteLogs.reduce((sum, log) => sum + log.cost, 0);



    matrix.push(["Theoretical Food Cost", totalTheoreticalFoodCost]);

    matrix.push(["Actual Food Cost", totalActualFoodCost]);



    return matrix;

}



async function runPythonScript(scriptName) {
    const scriptPath = join(__dirname, scriptName);
    const { stdout } = await execAsync(`python "${scriptPath}"`);
    return JSON.parse(stdout.trim());
}

dotenv.config();



const log = {



    info: (msg,...args) => console.log(`[INFO] ${msg}`, ...args),

    error: (msg,...args) => console.log(`[ERROR] ${msg}`, ...args),

    debug: (msg,...args) => process.env.NODE_ENV === "development" && console.log(`[DEBUG] ${msg}`, ...args)

}



class Agent {

    constructor() {

        // boiler plate app setup

        this.app = express();

        this.slack = new App({

            token: process.env.SLACK_BOT_TOKEN,

            signingSecret: process.env.SLACK_SIGNING_SECRET,

            socketMode: true,

            appToken: process.env.SLACK_APP_TOKEN,

        });

        this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

        this.openai = new ChatOpenAI({

            modelName: "gpt-4",

            temperature: 0.3,

            apiKey: process.env.OPENAI_API_KEY

        });

        this.setupSlackEvents();

        this.setupExpress();

    }



    setupSlackEvents() {

        this.slack.event('app_mention', async ({ event, say }) => {

            try {

                log.info(`Mentioned by user ${event.user} in channel ${event.channel}: ${event.text}`);

                const businessInfo = await this.getBusinessInfo(event.user);

                await this.analyzeAndPostBusiness(businessInfo, event.channel);

            } catch (error) {

                log.error("Error handling app_mention event:", error.message);

                await say(`Sorry, something went wrong while processing your request.`);

            }

        });

        // direct message Q&A handler
        this.slack.message(async ({ message, say }) => {
            if (message.subtype || !message.text) return;
            try {
                log.info(`Message from ${message.user}: ${message.text}`);
                const researchData = await this.doBasicResearch({ name: "restaurant", email: null, domain: null });
                const answer = await this.answerQuestion(message.text, researchData);
                await say(answer);
            } catch (error) {
                log.error("Error handling message:", error.message);
                await say("Sorry, I couldn't process that question.");
            }
        });

        this.slack.error(async (error) => log.error("Slack error:", error.message));
    }



    setupExpress() {

        this.app.use(express.json());



        this.app.get('/health', (req, res) => {

            // Simple health check endpoint

            res.json({ status: "OK", timestamp: new Date().toISOString() });





        })

        if (process.env.NODE_ENV === "development") {

            this.app.post('/test/analyze-business', async (req, res) => {

                try {

                    const businessInfo = req.body;

                    if (!businessInfo) return res.status(400).json({ error: "Business info is required" });

                    const analysis = await this.analyzeAndPostBusiness(businessInfo);

                    res.json({ success: true, analysis, timestamp: new Date().toISOString() });

                } catch (error) {

                    log.error("Error in test analysis:", error.message);

                    res.status(500).json({ error: "Analysis failed", message: error.message });

                }

            });

        }

        this.app.use((err, req, res, next) => {

            log.error("Express error:", err.message);

            res.status(500).json({ error: "Internal Server Error", message: err.message });

        });

    }



    async getBusinessInfo(userId) {

        const result = await this.webClient.users.info({ user: userId });

        const user = result.user;

        const email = user.profile?.email;

        const domain = email ? email.split("@")[1] : null;

        return {

            id: user.id,

            name: user.real_name || user.name,

            email: email,

            domain: domain,

        };

    }



    async analyzeAndPostBusiness(businessInfo) {

        let analysisId = null;

        try {

            log.info(`Processing business ${businessInfo.name}`);

            const researchData = await this.doBasicResearch(businessInfo);

            const analysis = await this.analyzeWithAI(businessInfo, researchData);

            log.info(`Saving analysis to database for ${businessInfo.name}`);

            analysisId = await this.saveBusinessAnalysis(businessInfo, analysis, researchData);

            await this.postAnalysisToChannel(businessInfo, analysis, researchData);



            if (analysisId) {

                await markAsSentToSlack(analysisId);

            }



        } catch (error) {

            log.error(`Error processing ${businessInfo.name}:`, error.message);

            if (analysisId) {

                log.info(`Analysis ${analysisId} saved to database but not sent to Slack due to error`);

            }

            throw error;

        }

    }



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
            results.push({ type: "benchmarks", data: benchmarkSummary(results) });

        } catch (error) {

            log.error(`Error during basic research for ${businessInfo.name}:`, error.message);

        }

        return results;

    }



    async getCompanyInfo(domain) {

        try {

            const response = await axios.get(`https://www.${domain}`, {

                timeout: 5000, // 5 seconds timeout

                headers: {"User-Agent": "Mozilla/5.0"}

            });

            const titleMatch = response.data.match(/<title>(.*?)<\/title>/i);

            const title = titleMatch ? titleMatch[1] : `Company: ${domain}`;

            return {

                url: `https://www.${domain}`,

                title: title,

                content: `Company website for ${domain}`,

                type: 'Company'

            };

        } catch (error) {

            log.error(`Error getting company info for ${domain}:`, error.message);

            return null;

        }

    }





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
            const cleaned = responseText.replace(/```json
?|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (error) {
            log.error(`AI analysis failed for ${businessInfo.name}:`, error.message);
            return { insights: [], recommendations: [], alerts: [], prime_cost_status: "unknown", error: error.message };
        }
    }

    async postAnalysisToChannel(businessInfo, analysis, researchData) {

        try {

            const channelId = process.env.SLACK_CHANNEL_ID;

            

            const blocks = [

                {   

                    type: 'header',

                    text: {

                        type: 'plain_text',

                        text: `Analysis for ${businessInfo.name}`,

                    }

                },

                {

                    type: 'section',

                    fields: [

                        {

                            type: 'mrkdwn',

                            text: `*Business Info*\\nName: ${businessInfo.name}\\nEmail: ${businessInfo.email}\\nDomain: ${businessInfo.domain}`

                        },

                        {

                            type: 'mrkdwn',

                            text: `*AI Analysis*\\n${typeof analysis === "string" ? analysis : JSON.stringify(analysis, null, 2)}`

                        }

                    ]

                }

            ];



            await this.webClient.chat.postMessage({

                channel: channelId,

                text: `Analysis for ${businessInfo.name}`,

                blocks

            });



            log.info(`Analysis posted to channel for ${businessInfo.name}`)

        } catch (error) {

            log.error(`Error posting analysis to Slack for ${businessInfo.name}:`, error.message);

        }

    }





    async sendMorningDigest() {
        const channelId = process.env.SLACK_CHANNEL_ID;
        if (!channelId) return;
        const placeholderInfo = { name: "Your Restaurant", email: null, domain: null };
        const researchData = await this.doBasicResearch(placeholderInfo);
        const analysis = await this.analyzeWithAI(placeholderInfo, researchData);
        const insights = Array.isArray(analysis.insights) && analysis.insights.length > 0
            ? analysis.insights.map(i => `• ${i}`).join("
")
            : "No insights available yet - check your data connection.";
        await this.webClient.chat.postMessage({
            channel: channelId,
            text: `*Good morning! Here's your daily restaurant snapshot:*

${insights}`
        });
        log.info("Morning digest sent");
    }


    async checkAndSendAlerts() {
        const channelId = process.env.SLACK_CHANNEL_ID;
        if (!channelId) return;
        const placeholderInfo = { name: "Your Restaurant", email: null, domain: null };
        const researchData = await this.doBasicResearch(placeholderInfo);
        const alerts = checkAlerts(researchData);
        if (alerts.length > 0) {
            const text = `*Alert:*
` + alerts.map(a => `• ${a}`).join("
");
            await this.webClient.chat.postMessage({ channel: channelId, text });
            log.info(`Sent ${alerts.length} alert(s)`);
        }
    }


    async answerQuestion(question, researchData) {
        try {
            const prompt = `You are a restaurant business analyst assistant. Answer this owner's question using their operational data.

Question: ${question}

Their data:
${JSON.stringify(researchData, null, 2)}

Give a direct, plain-English answer. If the data doesn't have what you need, say so and tell them what data they'd need. Keep it under 3 sentences.`;
            const result = await this.openai.invoke(prompt);
            return result.content || result;
        } catch (error) {
            log.error("answerQuestion failed:", error.message);
            return "I ran into an error trying to answer that - check the logs.";
        }
    }

    async start() {

        try{

            log.info('Initializing database...');

            await initDatabase();

            

            const port = process.env.PORT || 3000;

            this.server = this.app.listen(port, () => {

                log.info(`Express server running on port ${port}`)

            })



            await this.slack.start();
            log.info('Slack bot connected');
            startScheduler(this);

            log.info('Slack AI agent is up and running');

            if (process.env.NODE_ENV === 'development') {

                log.info(`Test endpoint: POST http://localhost:${port}/test/analyze-member`);

            }



        } catch (error) {

            log.error('Failed to start', error.message);

            process.exit(1);

        }

    }



    async stop() {

        log.info('Shutting down...');

        try {

            await this.slack.stop()

            if (this.server) {

                await new Promise(resolve => this.server.close(resolve));

            }

            await closeDatabase();

            log.info('Stopped successfully');

            process.exit(0);

        } catch (error) {

            log.error('Shutdown error', error.message);

        }

    }



}



const agent = new Agent();



process.on('SIGINT', () => agent.stop());

process.on('SIGTERM', () => agent.stop());



agent.start().catch(error => {

    console.error('Startup failed', error.message);

    process.exit(1);

});



export default agent;

