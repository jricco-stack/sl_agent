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
        // Most of user logic is leftover from the agent tutorial; users join the channel and then are analyzed. This would just be changed to a business joining the channel and its info being analyzed.
        this.slack.event('team_join', async ({ event }) => {
            try {
                log.info(`New user joined: ${event.user.name}`);
                const userInfo = await this.getUserInfo(event.user.id);
                await this.analyzeAndPostMember(userInfo);

            } catch (error) {
                log.error("Error handling team_join event:", error.message);
            }
        });

        this.slack.event('member_joined_channel', async ({ event }) => {
            try {
                if (event.channel_type === "C") { // Only handle public channels
                    log.info(`User joined channel: ${event.user} in ${event.channel}`);
                    const userInfo = await this.getUserInfo(event.user);
                    await this.analyzeAndPostMember(userInfo, event.channel);
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
        // Only for testing purposes, not for production
        // This endpoint allows us to simulate a user joining and analyze their profile without needing to actually join a channel
        if (process.env.NODE_ENV === "development") {
            this.app.post('/test/analyze-member', async (req, res) => {
                try {
                    const memberInfo = req.body;
                    if (!memberInfo) return res.status(400).json({ error: "Member info is required" });
                    const analysis = await this.analyzeAndPostMember(memberInfo);
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

    // Getting info from user. this logic would instead get info from business, by connecting to Toast API or pulling info from their website, etc.
    async getUserInfo(userId) {
        const result = await this.webClient.users.info({ user: userId });
        const user = result.user;
        return {
            id: user.id,
            name: user.real_name || user.name,
            username: user.name,
            email: user.profile?.email,
            title: user.profile?.title,
            timezone: user.tz,
            profile: {
                firstName: user.profile?.first_name,
                lastName: user.profile?.last_name,
                statusText: user.profile?.status_text,
            },
        };
    }

    // The full outline of analysis pipeline - this is where the main logic of the agent lives, and where you would customize the analysis for your specific use case. The current implementation is just a placeholder to show how the different pieces fit together.
    async analyzeAndPostMember(memberInfo) {
        let analysisId = null;
        try {
            log.info(`Processing member ${memberInfo.name}`);
            const researchData = await this.doBasicResearch(memberInfo);
            const analysis = await this.analyzeWithAI(memberInfo, researchData);
            log.info("Saving analysis to database for  ${memberInfo.name}");
            analysisId = await this.saveMemberAnalysis(memberInfo, analysis, researchData);
            await this.postAnalysisToChannel(memberInfo, analysis, researchData);

            if (analysisId) {
                await markAsSentToSlack(analysisId);
            }
            

        } catch (error) {
            log.error("Error processing ${memberInfo.name}:", error.message);
            if (analysisId) {
                log.info("Analysis ${analysisId} saved to database but not sent to Slack due to error");
            }
            throw error;
        }
    }

    // This is the preliminary research step, where you would do the hard-coded techniques on the businessData you collected.
    async doBasicResearch(memberInfo) {
        const results = [];

        try {
            let meMatrix = runPythonScript("menuengineering.py");
            let fcMatrix = runPythonScript("foodcost.py");
            let dataMatrix = runPythonScript("data.py");
            let domain = memberInfo.email.split("@")[1];
            const companyInfo = await this.getCompanyInfo(domain);
            results.push({ type: "menu_engineering", data: meMatrix });
            results.push({ type: "food_cost", data: fcMatrix });
            results.push({ type: "data", data: dataMatrix });
            results.push({ type: "company_info", data: companyInfo });
        } catch (error) {
            log.error("Error during basic research for ${memberInfo.name}:", error.message);
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
            const title = titleMatch ? titleMatch[1] : 'Company: ${domain}';
            return {
                url: `https://www.${domain}`,
                title: title,
                content: 'Company website for ${domain}', // additional scraping and parsing logic would go here to fill this in with more detailed info about the company 
                type: 'Company'
            };
        } catch (error) {
            log.error("Error getting company info for ${memberInfo.name}:", error.message);
            return null;
        }
    }

    async AnalyzeWithAI(memberInfo, researchData) {
        const prompt = ChatPromptTemplate.fromTemplate(`Analyze the following business information and research data, 
            and provide insights and recommendations based on this data. Business Info: 
            ${JSON.stringify(memberInfo)} Research Data: ${JSON.stringify(researchData)}`);
        try {
            const researchSummary = researchData.length > 0 ?
            researchData.map(r => `${r.title}: ${r.content}`).join('\\n') 
            : "No research data available";

            const chain = prompt.pipe(this.openai);
            const result = await chain.invoke({
                name: memberInfo.name,
                email: memberInfo.email,
                title: memberInfo.title,
                research: researchSummary
            })

            const responseText = result.content || result;
            const cleanedReponse = responseText.replace(/'''json\\n?'''/g, '').trim();

            const analysis = JSON.parse(cleanedReponse);

            return analysis;
        } catch (error) {
            log.error("Error during AI analysis for ${memberInfo.name}:", error.message);
            return "AI analysis failed: ${error.message}";
        }
    }

}

