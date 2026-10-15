const express = require("express");
const db = require("../db");
const {
    symptomDefinitions,
    calculateRuleMetrics,
    mapRule,
    evaluateRules,
} = require("../services/assessmentService");

const router = express.Router();
const allowedPageSizes = [10, 20, 50];
const datasetSymptomFields = symptomDefinitions.map(({ id }) => id);
const diagnosisLabels = {
    GDM: "เบาหวานขณะตั้งครรภ์",
    Anemia: "ภาวะโลหิตจาง",
    "Thyroid Disorder": "ความผิดปกติของต่อมไทรอยด์",
};

function pagination(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const requestedSize = Number.parseInt(query.pageSize, 10) || 10;
    const pageSize = allowedPageSizes.includes(requestedSize) ? requestedSize : 10;
    return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseJson(value, fallback = null) {
    if (value == null || value === "") return fallback;
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

async function requireDatabase(req, res, next) {
    try {
        await db.query("SELECT 1");
        next();
    } catch (error) {
        res.status(503).json({ error: "เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบ MySQL" });
    }
}

router.use(requireDatabase);

router.get("/overview", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const isValidDate = (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
        new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    if ((from && !isValidDate(from)) || (to && !isValidDate(to)) || (from && to && from > to)) {
        return res.status(400).json({ error: "ช่วงวันที่ไม่ถูกต้อง" });
    }

    const [[datasetCount]] = await db.query("SELECT COUNT(*) AS total FROM dataset");
    const [[ruleCount]] = await db.query("SELECT COUNT(*) AS total FROM expert_rules");
    const [[predictionCount]] = await db.query("SELECT COUNT(*) AS total FROM predictions");
    const periodConditions = [];
    const periodValues = [];
    if (from) {
        periodConditions.push("DATE(p.created_at) >= ?");
        periodValues.push(from);
    }
    if (to) {
        periodConditions.push("DATE(p.created_at) <= ?");
        periodValues.push(to);
    }
    const periodWhere = periodConditions.length ? `WHERE ${periodConditions.join(" AND ")}` : "";
    const [[periodPredictionCount]] = await db.execute(
        `SELECT COUNT(*) AS total FROM predictions p ${periodWhere}`,
        periodValues,
    );
    const [predictionGroups] = await db.execute(
        `SELECT p.disease, COUNT(*) AS total
         FROM predictions p ${periodWhere}
         GROUP BY p.disease ORDER BY p.disease`,
        periodValues,
    );
    const [groups] = await db.query(
        "SELECT disease, COUNT(*) AS total FROM dataset GROUP BY disease ORDER BY disease",
    );

    res.json({
        datasetCount: Number(datasetCount.total),
        ruleCount: Number(ruleCount.total),
        predictionCount: Number(predictionCount.total),
        periodPredictionCount: Number(periodPredictionCount.total),
        predictionGroups: predictionGroups.map(({ disease, total }) => ({
            code: disease,
            label: diagnosisLabels[disease] ?? disease,
            count: Number(total),
        })),
        datasetGroups: groups.map(({ disease, total }) => ({
            code: disease,
            label: diagnosisLabels[disease] ?? disease,
            count: Number(total),
        })),
        source: "mysql",
    });
});

router.get("/symptoms", async (req, res) => {
    const [columns] = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        ["dataset"],
    );
    const availableFields = new Set(columns.map(({ COLUMN_NAME }) => COLUMN_NAME));
    const availableSymptoms = symptomDefinitions.filter(({ id }) => availableFields.has(id));
    res.json({ symptoms: availableSymptoms, count: availableSymptoms.length });
});

router.get("/rules", async (req, res) => {
    const { page, pageSize, offset } = pagination(req.query);
    const search = String(req.query.q ?? "").trim();
    const diagnosis = String(req.query.diagnosis ?? "").trim();
    const conditions = [];
    const values = [];

    if (search) {
        conditions.push("(rule_code LIKE ? OR diagnosis LIKE ? OR symptom_conditions LIKE ?)");
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (diagnosis) {
        conditions.push("diagnosis = ?");
        values.push(diagnosis);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[count]] = await db.execute(`SELECT COUNT(*) AS total FROM expert_rules ${where}`, values);
    const [rows] = await db.execute(
        `SELECT rule_code, diagnosis, min_weeks, max_weeks, symptom_conditions,
                condition_count, match_count, support, confidence, cf
         FROM expert_rules ${where}
         ORDER BY CAST(SUBSTRING(rule_code, 2) AS UNSIGNED)
         LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
    );
    const datasetColumns = datasetSymptomFields.map((column) => `\`${column}\``).join(", ");
    const [datasetRows] = await db.query(`SELECT ${datasetColumns}, disease FROM dataset`);
    const [diagnosisRows] = await db.query("SELECT DISTINCT diagnosis FROM expert_rules ORDER BY diagnosis");

    res.json({
        items: rows.map((row) => ({
            ...mapRule(row),
            ...calculateRuleMetrics(row, datasetRows),
        })),
        total: Number(count.total),
        page,
        pageSize,
        diagnoses: diagnosisRows.map(({ diagnosis }) => diagnosis),
    });
});

router.get("/dataset", async (req, res) => {
    const { page, pageSize, offset } = pagination(req.query);
    const search = String(req.query.q ?? "").trim();
    const disease = String(req.query.disease ?? "").trim();
    const conditions = [];
    const values = [];

    if (search) {
        const searchPattern = `%${search}%`;
        const searchableFields = ["id", "disease", ...datasetSymptomFields];
        conditions.push(`(${searchableFields.map((column) => `CAST(\`${column}\` AS CHAR) LIKE ?`).join(" OR ")})`);
        values.push(...searchableFields.map(() => searchPattern));
    }
    if (disease) {
        conditions.push("disease = ?");
        values.push(disease);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[count]] = await db.execute(`SELECT COUNT(*) AS total FROM dataset ${where}`, values);
    const [groups] = await db.query(
        "SELECT disease, COUNT(*) AS total FROM dataset GROUP BY disease ORDER BY disease",
    );
    const selectedColumns = ["id", ...datasetSymptomFields, "disease"];
    const columns = selectedColumns.map((column) => `\`${column}\``).join(", ");
    const [rows] = await db.execute(
        `SELECT ${columns} FROM dataset ${where} ORDER BY id LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
    );

    res.json({
        columns: selectedColumns,
        items: rows,
        total: Number(count.total),
        page,
        pageSize,
        groups: groups.map(({ disease: code, total }) => ({
            code,
            label: diagnosisLabels[code] ?? code,
            count: Number(total),
        })),
    });
});

router.get("/history", async (req, res) => {
    const { page, pageSize, offset } = pagination(req.query);
    const search = String(req.query.q ?? "").trim();
    const conditions = [];
    const values = [];

    if (search) {
        conditions.push("(p.disease LIKE ? OR p.rule_code LIKE ? OR m.name LIKE ?)");
        values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[count]] = await db.execute(
        `SELECT COUNT(*) AS total FROM predictions p LEFT JOIN mothers m ON m.id = p.mother_id ${where}`,
        values,
    );
    const [rows] = await db.execute(
        `SELECT p.id, p.mother_id, p.created_at, p.disease, p.rule_code, p.support, p.confidence, p.cf,
                m.name AS mother_name,
                COALESCE(p.age, m.age) AS age,
                COALESCE(p.pregnancy_weeks, m.gestational_age_weeks) AS gestational_weeks,
                p.selected_symptoms, p.results
         FROM predictions p
         LEFT JOIN mothers m ON m.id = p.mother_id
         ${where}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
    );

    res.json({
        items: rows.map((row) => ({
            ...row,
            diseaseLabel: diagnosisLabels[row.disease] ?? row.disease,
            support: row.support == null ? null : Number(row.support),
            confidence: row.confidence == null ? null : Number(row.confidence),
            cf: row.cf == null ? null : Number(row.cf),
            selectedSymptoms: parseJson(row.selected_symptoms, []),
            results: parseJson(row.results, null),
        })),
        total: Number(count.total),
        page,
        pageSize,
    });
});

router.get("/history/mother/:id", async (req, res) => {
    const motherId = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(motherId) || motherId < 1) {
        return res.status(400).json({ error: "รหัสคุณแม่ไม่ถูกต้อง" });
    }

    const { page, pageSize, offset } = pagination(req.query);
    const [[count]] = await db.execute(
        "SELECT COUNT(*) AS total FROM predictions WHERE mother_id = ?",
        [motherId],
    );
    const [rows] = await db.execute(
        `SELECT p.id, p.mother_id, p.created_at, p.disease, p.rule_code, p.support, p.confidence, p.cf,
                m.name AS mother_name,
                COALESCE(p.age, m.age) AS age,
                COALESCE(p.pregnancy_weeks, m.gestational_age_weeks) AS gestational_weeks,
                p.selected_symptoms, p.results
         FROM predictions p
         LEFT JOIN mothers m ON m.id = p.mother_id
         WHERE p.mother_id = ?
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
        [motherId, pageSize, offset],
    );

    res.json({
        items: rows.map((row) => ({
            ...row,
            diseaseLabel: diagnosisLabels[row.disease] ?? row.disease,
            support: row.support == null ? null : Number(row.support),
            confidence: row.confidence == null ? null : Number(row.confidence),
            cf: row.cf == null ? null : Number(row.cf),
            selectedSymptoms: parseJson(row.selected_symptoms, []),
            results: parseJson(row.results, null),
        })),
        total: Number(count.total),
        page,
        pageSize,
    });
});

router.get("/history/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "รหัสรายการไม่ถูกต้อง" });

    const [rows] = await db.execute(
        `SELECT p.id, p.mother_id, p.created_at, p.disease, p.rule_code, p.support, p.confidence, p.cf,
                m.name AS mother_name,
                COALESCE(p.age, m.age) AS age,
                COALESCE(p.pregnancy_weeks, m.gestational_age_weeks) AS gestational_weeks,
                p.selected_symptoms, p.results
         FROM predictions p
         LEFT JOIN mothers m ON m.id = p.mother_id
         WHERE p.id = ?`,
        [id],
    );
    if (!rows.length) return res.status(404).json({ error: "ไม่พบรายการคัดกรอง" });

    const row = rows[0];
    res.json({
        item: {
            ...row,
            diseaseLabel: diagnosisLabels[row.disease] ?? row.disease,
            support: row.support == null ? null : Number(row.support),
            confidence: row.confidence == null ? null : Number(row.confidence),
            cf: row.cf == null ? null : Number(row.cf),
            selectedSymptoms: parseJson(row.selected_symptoms, []),
            results: parseJson(row.results, null),
        },
    });
});

router.post("/predict", async (req, res) => {
    const { patientName, age, gestationalWeeks, symptoms: inputSymptoms } = req.body ?? {};
    const normalizedName = typeof patientName === "string" ? patientName.trim() : "";
    const normalizedAge = Number(age);
    const normalizedWeeks = Number(gestationalWeeks);

    if (!normalizedName || normalizedName.length > 100) {
        return res.status(400).json({ error: "กรุณากรอกชื่อ (ไม่เกิน 100 ตัวอักษร ตามฐานข้อมูล mothers)" });
    }
    if (!Number.isInteger(normalizedAge) || normalizedAge < 10 || normalizedAge > 100) {
        return res.status(400).json({ error: "กรุณากรอกอายุเป็นจำนวนเต็มระหว่าง 10–100 ปี" });
    }
    if (!Number.isInteger(normalizedWeeks) || normalizedWeeks < 1 || normalizedWeeks > 42) {
        return res.status(400).json({ error: "อายุครรภ์ต้องเป็นจำนวนเต็มระหว่าง 1–42 สัปดาห์" });
    }
    if (!inputSymptoms || typeof inputSymptoms !== "object" || Array.isArray(inputSymptoms)) {
        return res.status(400).json({ error: "กรุณาส่งรายการอาการในรูปแบบ object" });
    }

    const knownSymptoms = new Set(symptomDefinitions.map(({ id }) => id));
    const unknown = Object.keys(inputSymptoms).filter((key) => !knownSymptoms.has(key));
    if (unknown.length || Object.values(inputSymptoms).some((value) => typeof value !== "boolean")) {
        return res.status(400).json({ error: "รายการอาการไม่ตรงกับคอลัมน์ใน Dataset" });
    }

    const [ruleRows] = await db.query(
        "SELECT rule_code, diagnosis, min_weeks, max_weeks, symptom_conditions, condition_count, match_count, support, confidence, cf FROM expert_rules ORDER BY CAST(SUBSTRING(rule_code, 2) AS UNSIGNED)",
    );
    const datasetColumns = datasetSymptomFields.map((column) => `\`${column}\``).join(", ");
    const [datasetRows] = await db.query(`SELECT ${datasetColumns}, disease FROM dataset`);
    const selectedSymptoms = datasetSymptomFields.filter((id) => inputSymptoms[id] === true);
    const evaluation = evaluateRules(ruleRows, selectedSymptoms, normalizedWeeks, datasetRows);
    const noMatchLabel = "ไม่พบกฎที่ตรงกับข้อมูล";
    const rowsToSave = evaluation.matches.length
        ? evaluation.matches.map((match) => ({
            disease: match.diagnosis,
            rule_code: match.ruleCode,
            support: match.support,
            confidence: match.confidence,
            cf: match.cf,
        }))
        : [{ disease: noMatchLabel, rule_code: null, support: null, confidence: null, cf: null }];

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [motherResult] = await connection.execute(
            "INSERT INTO mothers (name, age, gestational_age_weeks) VALUES (?, ?, ?)",
            [normalizedName, normalizedAge, normalizedWeeks],
        );
        const motherId = motherResult.insertId;
        const predictionIds = [];

        for (const row of rowsToSave) {
            const valuesByColumn = {
                mother_id: motherId,
                disease: row.disease,
                rule_code: row.rule_code,
                support: row.support,
                confidence: row.confidence,
                cf: row.cf,
                age: normalizedAge,
                pregnancy_weeks: normalizedWeeks,
                selected_symptoms: JSON.stringify(selectedSymptoms),
                results: JSON.stringify(evaluation),
                matched_rule_count: evaluation.matchedRuleCount,
            };
            const writableColumns = Object.keys(valuesByColumn);
            const columnSql = writableColumns.map((column) => `\`${column}\``).join(", ");
            const placeholders = writableColumns.map(() => "?").join(", ");
            const [insertResult] = await connection.execute(
                `INSERT INTO predictions (${columnSql}) VALUES (${placeholders})`,
                writableColumns.map((column) => valuesByColumn[column]),
            );
            predictionIds.push(insertResult.insertId);
        }

        await connection.commit();
        res.status(201).json({
            predictionIds,
            motherId,
            ...evaluation,
            results: evaluation.matches,
            noMatch: evaluation.matches.length === 0,
        });
    } catch (error) {
        await connection.rollback();
        console.error("Could not save screening:", error.message);
        res.status(500).json({ error: "บันทึกผลคัดกรองไม่สำเร็จ กรุณาลองใหม่" });
    } finally {
        connection.release();
    }
});

module.exports = router;
