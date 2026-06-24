import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runAnalysis, askQuestion } from "./engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// GET /api/alerts — operational alerts only
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

    // Serve web dashboard — path.join ensures this works regardless of where node is invoked from
    app.use(express.static(join(__dirname, "web")));

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
