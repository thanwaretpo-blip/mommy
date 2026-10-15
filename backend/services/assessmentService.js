const symptomDefinitions = [
    { id: "fatigue", label: "อ่อนเพลีย", english: "Fatigue" },
    { id: "dizziness", label: "เวียนศีรษะ", english: "Dizziness" },
    { id: "palpitations", label: "ใจสั่น", english: "Palpitations" },
    { id: "shortness_of_breath", label: "หายใจลำบาก", english: "Shortness of Breath" },
    { id: "weight_change", label: "น้ำหนักเปลี่ยนแปลง", english: "Weight Change" },
    { id: "swelling_edema", label: "อาการบวม", english: "Swelling / Edema" },
    { id: "poor_concentration", label: "สมาธิลดลง", english: "Poor Concentration" },
    { id: "pale_skin_conjunctiva", label: "ผิวหนังหรือเยื่อบุตาซีด", english: "Pale Skin / Conjunctiva" },
    { id: "hair_loss", label: "ผมร่วง", english: "Hair Loss" },
    { id: "cold_intolerance", label: "ทนต่อความหนาวเย็นได้น้อย", english: "Cold Intolerance" },
    { id: "excessive_thirst", label: "กระหายน้ำมาก", english: "Excessive Thirst" },
    { id: "frequent_urination", label: "ปัสสาวะบ่อย", english: "Frequent Urination" },
    { id: "blurred_vision", label: "ตามัว", english: "Blurred Vision" },
];

const symptomById = new Map(symptomDefinitions.map((symptom) => [symptom.id, symptom]));

function parseSymptomConditions(value) {
    const normalize = (items) => items.flatMap((item) => {
        if (typeof item === "string") {
            const id = item.trim().toLowerCase();
            return id ? [{ id, present: true }] : [];
        }
        if (!item || typeof item !== "object" || typeof item.id !== "string") return [];
        const id = item.id.trim().toLowerCase();
        return id ? [{ id, present: typeof item.present === "boolean" ? item.present : true }] : [];
    });
    if (Array.isArray(value)) return normalize(value);
    if (typeof value !== "string" || !value.trim()) return [];

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return normalize(parsed);
        if (typeof parsed === "string") return normalize(parsed.split(","));
    } catch {
        return normalize(value.split(","));
    }
    return [];
}

function calculateRuleMetrics(row, datasetRows) {
    const symptomConditions = parseSymptomConditions(row.symptom_conditions);
    const matchingRows = symptomConditions.length
        ? datasetRows.filter((datasetRow) => symptomConditions.every(
            ({ id, present }) => (Number(datasetRow[id]) === 1) === present,
        ))
        : [];
    const targetMatches = matchingRows.filter((datasetRow) => datasetRow.disease === row.diagnosis).length;

    return {
        conditionCount: symptomConditions.length,
        matchCount: matchingRows.length,
        support: datasetRows.length ? targetMatches / datasetRows.length : 0,
        confidence: matchingRows.length ? targetMatches / matchingRows.length : 0,
    };
}

function normalizeProbability(value) {
    const number = Number(value);
    return number > 1 ? number / 100 : number;
}

function mapRule(row) {
    const symptomConditions = parseSymptomConditions(row.symptom_conditions);
    return {
        ruleCode: row.rule_code,
        diagnosis: row.diagnosis,
        minWeeks: Number(row.min_weeks),
        maxWeeks: Number(row.max_weeks),
        symptomConditions,
        symptomLabels: symptomConditions.map(({ id, present }) => {
            const label = symptomById.get(id)?.label ?? id;
            return present ? label : `ไม่มีอาการ: ${label}`;
        }),
        conditionCount: symptomConditions.length,
        matchCount: Number(row.match_count),
        support: normalizeProbability(row.support),
        confidence: normalizeProbability(row.confidence),
        cf: Number(row.cf),
    };
}

function evaluateRules(ruleRows, selectedSymptoms, gestationalWeeks, datasetRows) {
    const selected = new Set(selectedSymptoms);
    const mappedRules = ruleRows.map((row) => {
        const rule = mapRule(row);
        return datasetRows ? { ...rule, ...calculateRuleMetrics(row, datasetRows) } : rule;
    });
    const unsupportedConditions = [...new Set(
        mappedRules.flatMap((rule) => rule.symptomConditions
            .filter(({ id }) => !symptomById.has(id))
            .map(({ id }) => id)),
    )];

    const matches = mappedRules
        .filter((rule) => rule.minWeeks <= gestationalWeeks
            && rule.maxWeeks >= gestationalWeeks
            && rule.symptomConditions.length > 0
            && rule.symptomConditions.every(({ id, present }) => selected.has(id) === present))
        .map((rule) => ({
            ...rule,
            matchedSymptoms: rule.symptomLabels,
        }));

    const diagnoses = [...new Set(matches.map((rule) => rule.diagnosis))];
    return {
        matches,
        diagnoses,
        matchedRuleCount: matches.length,
        inference: {
            inputSymptoms: symptomDefinitions
                .filter(({ id }) => selected.has(id))
                .map(({ id, label }) => ({ id, label })),
            gestationalWeeks,
            matchedRuleCodes: matches.map(({ ruleCode }) => ruleCode),
            method: "กฎจะตรงเมื่ออายุครรภ์อยู่ในช่วงที่กำหนด และอาการที่ระบุว่ามี/ไม่มีตรงกับข้อมูลที่เลือกทุกข้อ",
            unsupportedConditions,
        },
    };
}

module.exports = {
    symptomDefinitions,
    parseSymptomConditions,
    calculateRuleMetrics,
    normalizeProbability,
    mapRule,
    evaluateRules,
};
