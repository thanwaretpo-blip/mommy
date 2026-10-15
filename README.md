# MOMMY

ระบบผู้เชี่ยวชาญทางการแพทย์สำหรับคัดกรองภาวะผิดปกติระหว่างตั้งครรภ์ โครงงานใช้ React (HTML/CSS/JavaScript), Node.js/Express REST API และ MySQL ซึ่งดูแลฐานข้อมูลได้ผ่าน phpMyAdmin

## คำอธิบายสำหรับอาจารย์

ระบบนี้ทำหน้าที่เป็น prototype expert system สำหรับคัดกรองภาวะผิดปกติระหว่างตั้งครรภ์ โดยใช้ข้อมูลอาการจริงจากตาราง `dataset` และกฎจริงจากตาราง `expert_rules` ในฐานข้อมูล MySQL ผู้ใช้กรอกข้อมูลพื้นฐาน เช่น ชื่อ, อายุ, อายุครรภ์ และอาการที่พบ ระบบจะตรวจสอบเงื่อนไขตามกฎ IF–THEN ที่มีอยู่ และทำการจับคู่กับช่วงอายุครรภ์และอาการที่เลือก เพื่อสรุปว่าอาการที่พบสอดคล้องกับกลุ่มโรคใด เช่น เบาหวานขณะตั้งครรภ์ (GDM), ภาวะโลหิตจาง (Anemia) หรือความผิดปกติของต่อมไทรอยด์ (Thyroid Disorder)

ระบบทำงานใน 3 ชั้นหลัก ได้แก่ Frontend สำหรับแสดงหน้า Dashboard, Screening, History, Knowledge Base และ Dataset, Backend API สำหรับรับข้อมูลจากผู้ใช้และสื่อสารกับฐานข้อมูล, และ Rule Engine ที่ประเมินอาการตามกฎในฐานข้อมูล โดยมีการตรวจสอบ schema ของฐานข้อมูลก่อนใช้งานเพื่อยืนยันว่าตารางและคอลัมน์ที่ระบบต้องใช้มีอยู่จริง การทำงานนี้ช่วยให้ระบบสามารถอ้างอิงข้อมูลจริงจากฐานข้อมูลและให้ผลลัพธ์ที่ตรวจสอบได้ แม้ว่าจะไม่ได้ใช้งานแบบ clinical diagnosis อย่างสมบูรณ์ แต่สามารถทำหน้าที่เป็นเครื่องมือช่วยประเมินเบื้องต้นสำหรับการศึกษาและการสาธิตระบบผู้เชี่ยวชาญทางการแพทย์ได้

## ความน่าเชื่อถือของระบบ

ความน่าเชื่อถือของระบบมาจากการใช้ฐานข้อมูลจริงและการประเมินตามกฎที่จัดเก็บอยู่ใน `expert_rules` ไม่ใช่การใช้ข้อมูลจำลองหรือ hardcode ใน frontend ระบบตรวจสอบ MySQL ก่อนเริ่มทำงาน และแจ้งหากคอลัมน์หรือ table ที่ต้องใช้ไม่ครบถ้วน รวมถึงมีการบันทึกประวัติการคัดกรองลงใน `predictions` เพื่อให้สามารถตรวจสอบผลลัพธ์ย้อนหลังได้ โดยฐานข้อมูลที่ตรวจในเครื่องนี้มี Dataset 420 รายการ และกฎจริง 15 กฎ

## สรุปสั้นสำหรับการส่งอาจารย์

ระบบนี้เป็น prototype expert system สำหรับคัดกรองภาวะผิดปกติระหว่างตั้งครรภ์ที่พัฒนาขึ้นจากฐานข้อมูลจริง โดยมีการรวม Frontend, Backend API และ Rule-based inference เข้าด้วยกัน เพื่อช่วยประเมินความเสี่ยงเบื้องต้นจากอาการและอายุครรภ์ที่ผู้ใช้กรอก ระบบนี้แสดงผลลัพธ์ด้วยกฎ IF–THEN ที่มีอยู่ใน `expert_rules` และบันทึกประวัติการประเมินใน `predictions` เพื่อให้สามารถตรวจสอบและติดตามการใช้งานได้ การออกแบบนี้เหมาะสำหรับงานอธิบายหลักการของ expert system ในบริบททางการแพทย์ โดยเน้นที่การใช้ข้อมูลจริงและกฎที่ตรวจสอบได้ มากกว่าการพึ่งพาความรู้ที่ตั้งไว้แบบตายตัว

## โครงสร้างโปรเจกต์

```text
mommy/
  backend/
    db.js
    server.js
    routes/api.js
    services/assessmentService.js
    services/assessmentService.test.js
    .env.example
  frontend/
    src/App.jsx
    src/App.css
    src/index.css
    src/main.jsx
    vite.config.js
```

กฎถูกอ่านจาก `expert_rules` ในฐานข้อมูลโดยตรง ไม่มีชุดกฎซ้ำใน frontend ส่วน `assessmentService.js` แปลงเงื่อนไขจากฐานข้อมูลให้ตรงกับคอลัมน์อาการจริงของ `dataset` และประเมินตามช่วงอายุครรภ์

## ฐานข้อมูลเดิม

แอปเชื่อมต่อฐานข้อมูล `pregnancy_expert_system` ที่มีอยู่แล้ว โดยตรวจสอบตารางและคอลัมน์ก่อนเริ่ม API และ **ไม่สร้าง แก้ชื่อ หรือลบตารางอัตโนมัติ**

จาก schema ที่ตรวจพบในเครื่องนี้ ตารางกฎจริงชื่อ `expert_rules` และมีคอลัมน์ `rule_code`, `diagnosis`, `min_weeks`, `max_weeks`, `symptom_conditions`, `condition_count`, `match_count`, `support`, `confidence`, `cf`; `dataset` มี 13 คอลัมน์อาการและ `disease`; `mothers` เก็บข้อมูลผู้รับการคัดกรอง; `predictions` ต้องมีคอลัมน์สำหรับผลคัดกรอง รวมถึง `mother_id`, `selected_symptoms`, `results` และ `matched_rule_count` โดย `mother_id` อ้างอิง `mothers.id`

ระบบอ่าน `symptom_conditions` ได้ทั้ง JSON array แบบ `{ "id": "fatigue", "present": true/false }` และข้อความอาการคั่นด้วยจุลภาคจากกฎเดิม เงื่อนไข `present: false` หมายถึงผู้ใช้ต้องไม่ได้เลือกอาการนั้น การจับคู่ตรวจทุกเงื่อนไขทั้งมีและไม่มีอาการ พร้อมช่วงอายุครรภ์ก่อนแสดงผล

หาก schema ในเครื่องอื่นต่างออกไป ให้ตรวจดูผ่าน phpMyAdmin ก่อน ระบบจะแจ้งคอลัมน์ที่ขาดใน `GET /api/health` แทนการแก้ฐานข้อมูลเอง

เมื่อมีการเปลี่ยนแปลงข้อมูลใน `dataset` ให้คำนวณค่า `condition_count`, `match_count`, `support` และ `confidence` ใน `expert_rules` ใหม่ด้วยคำสั่ง `cd backend; npm run sync-rule-metrics` คำสั่งนี้อัปเดตเฉพาะค่าที่คำนวณจาก Dataset และไม่แก้เงื่อนไข/ผลลัพธ์/ช่วงอายุครรภ์หรือค่า CF ของกฎ

## ติดตั้งและตั้งค่า

ต้องมี Node.js 20.19+ หรือ 22.12+ และ MySQL ที่เปิดใช้งานอยู่

1. ตรวจใน phpMyAdmin ว่ามีฐานข้อมูล `pregnancy_expert_system` และตาราง `dataset`, `mothers`, `predictions`, `expert_rules` อยู่แล้ว ไม่ต้องรันคำสั่งสร้างตาราง
2. คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วกรอกค่าการเชื่อมต่อ MySQL ในเครื่อง โดยเก็บ `.env` ไว้เฉพาะเครื่อง ห้ามใส่รหัสผ่านใน frontend
3. ติดตั้ง dependencies:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

## เปิดใช้งาน

เปิด terminal แรก:

```powershell
cd backend
npm run dev
```

เปิด terminal ที่สอง:

```powershell
cd frontend
npm run dev
```

เปิด URL ที่ Vite แสดง ปกติคือ `http://localhost:5173` โดย Vite proxy `/api` ไป backend ที่ `http://localhost:5000`

ตรวจ backend และ MySQL ได้ที่ `http://localhost:5000/api/health` ค่าที่คาดหวังคือ `database: ready` และ `schema.ready: true`

## หน้าระบบและการทดสอบ

- **Dashboard**: เปิดหน้าแรก ตรวจว่าจำนวน Dataset, rule และ predictions ถูกโหลดจาก MySQL และสถานะเชื่อมต่อเป็นพร้อมใช้งาน
- **คัดกรอง**: กรอกชื่อ อายุ อายุครรภ์ และอาการ จากนั้นประมวลผล ตรวจว่าผลอ้างอิง `expert_rules` และบันทึกใน `mothers`/`predictions`
- **ผลคัดกรอง**: ตรวจ diagnosis, รหัสกฎ, ช่วงอายุครรภ์, อาการตามเงื่อนไข และ Support/Confidence/CF ที่อ่านจากกฎจริง หากไม่ตรงกฎจะแสดงว่าไม่พบกฎโดยไม่สร้าง diagnosis
- **ประวัติ**: ตรวจรายการจาก `predictions`; หน้าจอไม่แสดงชื่อผู้รับการคัดกรองในรายการประวัติ
- **เกี่ยวกับระบบ**: ตรวจคำอธิบายโครงสร้างและคำเตือนการใช้งาน

ชุดทดสอบและ production build:

```powershell
cd backend
npm test
node --check server.js
node --check routes/api.js
cd ..\frontend
npm run lint
npm run build
```

## REST API

- `GET /api/health` สถานะ MySQL และ schema ที่ตรวจพบ
- `GET /api/overview` จำนวน Dataset, rule, prediction และจำนวนแถวต่อ diagnosis
- `GET /api/symptoms` รายการอาการที่อิงคอลัมน์จริงใน Dataset
- `GET /api/rules?q=&diagnosis=&page=&pageSize=` ค้นหาและแบ่งหน้ากฎจาก `expert_rules`
- `GET /api/dataset?q=&disease=&page=&pageSize=` อ่าน Dataset จริงแบบแบ่งหน้า
- `GET /api/history?q=&page=&pageSize=` ประวัติจาก `predictions`
- `GET /api/history/:id` รายละเอียดประวัติ โดยไม่ส่งชื่อผู้รับการคัดกรอง
- `POST /api/predict` ตรวจข้อมูล จับคู่กฎ และบันทึกแม่/ผลคัดกรองใน transaction

ตัวอย่าง body สำหรับ `POST /api/predict` (ใช้ชื่อคอลัมน์อาการจริง):

```json
{
  "patientName": "ชื่อผู้รับการคัดกรอง",
  "age": 28,
  "gestationalWeeks": 30,
  "symptoms": {
    "fatigue": true,
    "dizziness": false,
    "palpitations": false,
    "shortness_of_breath": false,
    "weight_change": true,
    "swelling_edema": false,
    "poor_concentration": false,
    "pale_skin_conjunctiva": false,
    "hair_loss": false,
    "cold_intolerance": false,
    "excessive_thirst": false,
    "frequent_urination": true,
    "blurred_vision": false
  }
}
```

## ข้อจำกัดและความเป็นส่วนตัว

ผลเป็นการจับคู่กฎเพื่อการศึกษา ไม่ใช่การวินิจฉัย และไม่มีการกล่าวอ้างความแม่นยำทางคลินิก Support, Confidence และ CF แสดงตามค่าจริงใน `expert_rules` หากมีหลายกฎตรง ระบบแสดงทุกกฎที่เข้าเงื่อนไขโดยไม่จัดอันดับว่าโรคใดรุนแรงกว่า

ระบบจัดเก็บชื่อ อายุ อายุครรภ์ อาการ และผลคัดกรอง ซึ่งอาจเป็นข้อมูลสุขภาพส่วนบุคคล ต้นแบบนี้ไม่มีระบบยืนยันตัวตนหรือกำหนดสิทธิ์ผู้ใช้ จึงควรใช้ข้อมูลสาธิตที่ได้รับอนุญาตเท่านั้น ก่อนใช้งานจริงต้องให้ผู้เชี่ยวชาญตรวจสอบกฎและการคุ้มครองข้อมูล

## ความหมายของค่าในกฎ
Support และ Confidence คำนวณจากข้อมูลในตาราง `dataset` ส่วน CF เป็นค่าที่กำหนดไว้ใน `expert_rules` โดยตรง ค่า Support/Confidence จัดเก็บเป็นเปอร์เซ็นต์ 0–100 ในฐานข้อมูล และ API แปลงเป็นอัตราส่วนเพื่อแสดงผลเป็นเปอร์เซ็นต์
1) Support
คือเปอร์เซ็นต์หรืออัตราส่วนของข้อมูลใน dataset ที่ตรงกับกฎนี้

สูตร: จำนวนแถวที่มีอาการครบตามกฎ / จำนวนแถวทั้งหมดใน Dataset
2) Confidence
คือความมั่นใจว่าเมื่อกฎนี้ตรงแล้ว โรคที่ระบุในกฎจะเป็นจริง

สูตร: จำนวนแถวที่มีอาการครบและ `disease` ตรงกับ diagnosis / จำนวนแถวที่มีอาการครบ
3) CF (Certainty Factor)
คงค่าตามที่กำหนดใน `expert_rules` เพราะไม่มีสูตรหรือข้อมูลต้นทางเพียงพอให้คำนวณใหม่จาก Dataset เพียงอย่างเดียว

ระบบนับ `condition_count` จากจำนวนอาการใน `symptom_conditions` จริง และ `match_count` จากจำนวนแถวใน Dataset ที่มีอาการครบตามกฎ ค่า Support/Confidence ที่แสดงคำนวณจาก Dataset ปัจจุบัน การคำนวณซ้ำจะแจ้ง rule ที่ไม่มีแถวซึ่งตรงกับ diagnosis เพื่อให้ตรวจสอบเงื่อนไขหรือผลลัพธ์ต้นทาง; หาก confidence เป็น 0 หน้าฐานความรู้จะแสดงคำเตือนเมื่อเปิดรายละเอียดกฎ