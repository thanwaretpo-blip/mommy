const assert = require("node:assert/strict");
const test = require("node:test");
const {
    evaluateRules,
    mapRule,
    parseSymptomConditions,
    calculateRuleMetrics,
    normalizeProbability,
} = require("./assessmentService");

const databaseRule = {
    rule_code: "R1",
    diagnosis: "GDM",
    min_weeks: 28,
    max_weeks: 40,
    symptom_conditions: '["Weight_Change","Frequent_Urination"]',
    condition_count: 2,
    match_count: 20,
    support: "11.11",
    confidence: "100.00",
    cf: "1.000000",
};

test("database rule conditions map to the actual dataset field names and Thai labels", () => {
    const rule = mapRule(databaseRule);

    assert.deepEqual(rule.symptomConditions, [
        { id: "weight_change", present: true },
        { id: "frequent_urination", present: true },
    ]);
    assert.deepEqual(rule.symptomLabels, ["น้ำหนักเปลี่ยนแปลง", "ปัสสาวะบ่อย"]);
    assert.ok(Math.abs(rule.support - 0.1111) < 0.000001);
    assert.equal(rule.confidence, 1);
    assert.equal(rule.cf, 1);
});

test("probability mapping accepts fraction and percentage storage formats", () => {
    assert.equal(normalizeProbability("0.954545"), 0.954545);
    assert.equal(normalizeProbability("95.45"), 0.9545);
});

test("rule metrics honor present and absent symptoms and calculate association support", () => {
    const rule = {
        ...databaseRule,
        symptom_conditions: JSON.stringify([
            { id: "weight_change", present: true },
            { id: "frequent_urination", present: false },
        ]),
    };
    const datasetRows = [
        { weight_change: 1, frequent_urination: 0, disease: "GDM" },
        { weight_change: 1, frequent_urination: 0, disease: "Anemia" },
        { weight_change: 1, frequent_urination: 0, disease: "GDM" },
        { weight_change: 1, frequent_urination: 1, disease: "GDM" },
    ];
    const metrics = calculateRuleMetrics(rule, datasetRows);

    assert.deepEqual(metrics, {
        conditionCount: 2,
        matchCount: 3,
        support: 2 / 4,
        confidence: 2 / 3,
    });
});

test("parses comma-separated symptom conditions from existing database rules", () => {
    const conditions = parseSymptomConditions(
        "Fatigue,Dizziness,Palpitations,Shortness_of_Breath,Pale_Skin_Conjunctiva",
    );

    assert.deepEqual(conditions, [
        { id: "fatigue", present: true },
        { id: "dizziness", present: true },
        { id: "palpitations", present: true },
        { id: "shortness_of_breath", present: true },
        { id: "pale_skin_conjunctiva", present: true },
    ]);
});

test("a rule activates only when all symptoms and gestational-week limits match", () => {
    const matching = evaluateRules([databaseRule], ["weight_change", "frequent_urination"], 28);
    const missingOneSymptom = evaluateRules([databaseRule], ["weight_change"], 28);
    const outsideWeekRange = evaluateRules([databaseRule], ["weight_change", "frequent_urination"], 27);

    assert.deepEqual(matching.diagnoses, ["GDM"]);
    assert.equal(matching.matches[0].ruleCode, "R1");
    assert.equal(matching.matchedRuleCount, 1);
    assert.deepEqual(missingOneSymptom.matches, []);
    assert.deepEqual(outsideWeekRange.matches, []);
});

test("a comma-separated rule matches when all required symptoms and weeks match", () => {
    const anemiaRule = {
        ...databaseRule,
        rule_code: "R6",
        diagnosis: "Anemia",
        min_weeks: 14,
        max_weeks: 42,
        symptom_conditions: "Fatigue,Dizziness,Palpitations,Shortness_of_Breath,Pale_Skin_Conjunctiva",
    };
    const selectedSymptoms = [
        "fatigue",
        "dizziness",
        "palpitations",
        "shortness_of_breath",
        "pale_skin_conjunctiva",
        "cold_intolerance",
    ];
    const matching = evaluateRules([anemiaRule], selectedSymptoms, 17);

    assert.deepEqual(matching.diagnoses, ["Anemia"]);
    assert.equal(matching.matches[0].ruleCode, "R6");
});

test("a database rule with present and absent conditions matches and renders labels", () => {
    const rule = {
        ...databaseRule,
        rule_code: "R01",
        min_weeks: 1,
        max_weeks: 42,
        symptom_conditions: JSON.stringify([
            { id: "fatigue", present: true },
            { id: "dizziness", present: false },
        ]),
    };
    const matching = evaluateRules([rule], ["fatigue"], 17);
    const missingRequiredSymptom = evaluateRules([rule], ["dizziness"], 17);
    const selectedAbsentCondition = evaluateRules([rule], ["fatigue", "dizziness"], 17);

    assert.deepEqual(matching.diagnoses, ["GDM"]);
    assert.deepEqual(matching.matches[0].symptomLabels, ["อ่อนเพลีย", "ไม่มีอาการ: เวียนศีรษะ"]);
    assert.deepEqual(missingRequiredSymptom.matches, []);
    assert.deepEqual(selectedAbsentCondition.matches, []);
});
