import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

export async function initDatabase() {
    db = new Database(join(__dirname, "analyses.db"));
    db.exec(`
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_name TEXT,
            business_email TEXT,
            business_domain TEXT,
            analysis TEXT,
            research_data TEXT,
            sent_to_slack INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
}

export async function saveBusinessAnalysis(businessInfo, analysis, researchData) {
    const stmt = db.prepare(`
        INSERT INTO analyses (business_name, business_email, business_domain, analysis, research_data)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        businessInfo.name,
        businessInfo.email,
        businessInfo.domain,
        typeof analysis === "string" ? analysis : JSON.stringify(analysis),
        JSON.stringify(researchData)
    );
    return result.lastInsertRowid;
}

export async function markAsSentToSlack(analysisId) {
    const stmt = db.prepare(`UPDATE analyses SET sent_to_slack = 1 WHERE id = ?`);
    stmt.run(analysisId);
}

export async function closeDatabase() {
    if (db) {
        db.close();
    }
}
