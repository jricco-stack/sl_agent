// Using ChatGPT right now because I have API credits left over from a school project that I've already bought. Can be easily exchanged for another brain.
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import pkg from "@slack/bolt";
const { App } = pkg;
import { WebClient } from "@slack/web-api";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runPythonScript(scriptName) {
    const scriptPath = join(__dirname, scriptName);
    const output = execSync(`python "${scriptPath}"`, { encoding: "utf-8" });
    return JSON.parse(output.trim());
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
        this.slack.event('team_join', async ({ event }) => {
            try {
                log.info(`New user joined: ${event.user.name}`);
                const businessInfo = await this.getBusinessInfo(event.user.id);
                await this.analyzeAndPostBusiness(businessInfo);

            } catch (error) {
                log.error("Error handling team_join event:", error.message);
            }
        });

        this.slack.event('member_joined_channel', async ({ event }) => {
            try {
                if (event.channel_type === "C") {
                    log.info(`User joined channel: ${event.user} in ${event.channel}`);
                    const businessInfo = await this.getBusinessInfo(event.user);
                    await this.analyzeAndPostBusiness(businessInfo, event.channel);
                }
            } catch (error) {
                log.error("Error handling member_joined_channel event:", error.message);
            }
        });
        this.slack.error(async (error) => log.error("Slack error:", error.message));
    }

    setupExpress() {
        this.app.use(express.json());

        this.app.get('health', (req, res) => {
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
            let meMatrix = runPythonScript("menuengineering.py");
            let fcMatrix = runPythonScript("foodcost.py");
            let dataMatrix = runPythonScript("data.py");
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
        const prompt = ChatPromptTemplate.fromTemplate(`Analyze the following business information and research data,
            and provide insights and recommendations based on this data. Business Info:
            ${JSON.stringify(businessInfo)} Research Data: ${JSON.stringify(researchData)}`);
        try {
            const researchSummary = researchData.length > 0 ?
            researchData.map(r => `${r.title}: ${r.content}`).join('\\n')
            : "No research data available";

            const chain = prompt.pipe(this.openai);
            const result = await chain.invoke({
                name: businessInfo.name,
                email: businessInfo.email,
                domain: businessInfo.domain,
                research: researchSummary
            })

            const responseText = result.content || result;
            const cleanedReponse = responseText.replace(/'''json\\n?'''/g, '').trim();

            const analysis = JSON.parse(cleanedReponse);

            return analysis;
        } catch (error) {
            log.error(`Error during AI analysis for ${businessInfo.name}:`, error.message);
            return `AI analysis failed: ${error.message}`;
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
