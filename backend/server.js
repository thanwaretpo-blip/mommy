const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./db");
const apiRouter = require("./routes/api");
const { symptomDefinitions } = require("./services/assessmentService");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const requiredSchema = {
    dataset: ["id", ...symptomDefinitions.map(({ id }) => id), "disease"],
    mothers: ["id", "name", "age", "gestational_age_weeks"],
    predictions: ["id", "mother_id", "disease", "rule_code", "support", "confidence", "cf", "created_at", "age", "pregnancy_weeks", "selected_symptoms", "results", "matched_rule_count"],
    expert_rules: ["rule_code", "diagnosis", "min_weeks", "max_weeks", "symptom_conditions", "condition_count", "match_count", "support", "confidence", "cf"],
};
let schemaStatus = { ready: false, missing: [] };

app.use(cors());
app.use(express.json({ limit: "100kb" }));

async function inspectExistingSchema() {
    const [columns] = await db.execute(
        `SELECT TABLE_NAME, COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ('dataset', 'mothers', 'predictions', 'expert_rules')`,
    );
    const columnsByTable = new Map();
    for (const { TABLE_NAME, COLUMN_NAME } of columns) {
        const tableColumns = columnsByTable.get(TABLE_NAME) ?? new Set();
        tableColumns.add(COLUMN_NAME);
        columnsByTable.set(TABLE_NAME, tableColumns);
    }

    const missing = [];
    for (const [table, requiredColumns] of Object.entries(requiredSchema)) {
        const actualColumns = columnsByTable.get(table);
        if (!actualColumns) {
            missing.push(`table:${table}`);
            continue;
        }
        for (const column of requiredColumns) {
            if (!actualColumns.has(column)) missing.push(`${table}.${column}`);
        }
    }

    if (missing.length) throw new Error(`Required existing schema is incomplete: ${missing.join(", ")}`);
    return { ready: true, tables: Object.keys(requiredSchema) };
}

app.get("/", (req, res) => {
    res.json({ service: "MOMMY Medical Expert System", api: "/api/health" });
});

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        if (!schemaStatus.ready) {
            return res.status(503).json({ database: "schema_incomplete", schema: schemaStatus });
        }
        const [counts] = await db.execute("SELECT COUNT(*) AS total FROM expert_rules");
        res.json({
            database: "ready",
            databaseName: process.env.DB_NAME,
            schema: schemaStatus,
            ruleCount: Number(counts[0].total),
        });
    } catch (error) {
        res.status(503).json({ database: "unavailable", error: error.message });
    }
});

app.use("/api", (req, res, next) => {
    if (!schemaStatus.ready) {
        return res.status(503).json({ error: "โครงสร้างฐานข้อมูลไม่ตรงกับ schema ที่ระบบต้องใช้", schema: schemaStatus });
    }
    next();
});

app.use("/api", apiRouter);
app.use((error, req, res, next) => {
    console.error("Unhandled API error:", error.message);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่" });
});

async function startServer() {
    try {
        schemaStatus = await inspectExistingSchema();
        console.log("Connected to existing MySQL tables:", schemaStatus.tables.join(", "));
    } catch (error) {
        schemaStatus = { ready: false, missing: error.message };
        console.error("Existing database schema is not ready:", error.message);
    }

    app.listen(PORT, () => {
        console.log(`MOMMY API running at http://localhost:${PORT}`);
    });
}

startServer();
