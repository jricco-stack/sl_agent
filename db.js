import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, "analyses.json");

let db = { analyses: [], nextId: 1 };

export async function initDatabase() {
    if (existsSync(DB_PATH)) {
        db = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    } else {
        save();
    }
}

function save() {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function saveBusinessAnalysis(businessInfo, analysis, researchData) {
    const record = {
        id:            db.nextId++,
        business_name: businessInfo.name,
        business_email: businessInfo.email,
        business_domain: businessInfo.domain,
        analysis:      typeof analysis === "string" ? analysis : JSON.stringify(analysis),
        research_data: JSON.stringify(researchData),
        sent_to_slack: 0,
        created_at:    new Date().toISOString(),
    };
    db.analyses.push(record);
    save();
    return record.id;
}

export async function markAsSentToSlack(analysisId) {
    const record = db.analyses.find(a => a.id === analysisId);
    if (record) {
        record.sent_to_slack = 1;
        save();
    }
}

export async function closeDatabase() {
    // nothing to close for a JSON file store
}
