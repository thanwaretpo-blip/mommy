require("dotenv").config();
const db = require("../db");
const { symptomDefinitions, calculateRuleMetrics, parseSymptomConditions } = require("../services/assessmentService");

async function recalculateRuleMetrics() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const columns = symptomDefinitions.map(({ id }) => `\`${id}\``).join(", ");
        const [datasetRows] = await connection.query(`SELECT ${columns}, disease FROM dataset`);
        if (!datasetRows.length) throw new Error("Cannot calculate rule metrics from an empty dataset");

        const [rules] = await connection.query(
            "SELECT rule_code, diagnosis, symptom_conditions FROM expert_rules FOR UPDATE",
        );
        const knownSymptoms = new Set(symptomDefinitions.map(({ id }) => id));
        const unsupported = rules.flatMap((rule) =>
            parseSymptomConditions(rule.symptom_conditions)
                .filter(({ id }) => !knownSymptoms.has(id))
                .map(({ id }) => `${rule.rule_code}:${id}`),
        );
        if (unsupported.length) {
            throw new Error(`Rules contain unsupported symptoms: ${unsupported.join(", ")}`);
        }

        const report = [];
        for (const rule of rules) {
            const metrics = calculateRuleMetrics(rule, datasetRows);
            await connection.execute(
                `UPDATE expert_rules
                 SET condition_count = ?, match_count = ?, support = ?, confidence = ?
                 WHERE rule_code = ?`,
                [
                    metrics.conditionCount,
                    metrics.matchCount,
                    Number(metrics.support.toFixed(6)),
                    Number(metrics.confidence.toFixed(6)),
                    rule.rule_code,
                ],
            );
            report.push({
                ruleCode: rule.rule_code,
                conditionCount: metrics.conditionCount,
                matchCount: metrics.matchCount,
                supportPercent: Number((metrics.support * 100).toFixed(2)),
                confidencePercent: Number((metrics.confidence * 100).toFixed(2)),
                targetMatches: Math.round(metrics.confidence * metrics.matchCount),
            });
        }

        await connection.commit();
        console.log(JSON.stringify({
            datasetCount: datasetRows.length,
            updatedRuleCount: report.length,
            rulesWithoutTargetDatasetMatches: report
                .filter(({ targetMatches }) => targetMatches === 0)
                .map(({ ruleCode }) => ruleCode),
            rules: report,
        }, null, 2));
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

recalculateRuleMetrics()
    .catch((error) => {
        console.error("Could not recalculate expert rule metrics:", error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
