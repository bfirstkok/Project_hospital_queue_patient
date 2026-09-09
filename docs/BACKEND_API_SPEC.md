# Backend API — สถานะปัจจุบัน (Patient Portal)

เอกสารนี้ = **สภาพจริงของ API ตอนนี้** ที่ frontend (`Project_hospital_queue_patient`)
เรียกใช้กับ backend (`Project_hospital_queue`, Django).
งานที่ต้องเพิ่ม (ระบบ PIN + OTP) อยู่ใน [`BACKEND_HANDOFF.md`](BACKEND_HANDOFF.md).

---

## 1. ภาพรวม

- frontend = Next.js App Router, เรียก REST ตรง ไม่มี proxy / Next API route
- base URL: env `PATIENT_API_BASE_URL` (บังคับ HTTPS ยกเว้น localhost)
- token: เก็บใน `localStorage["hospital_patient_access_token"]`, ส่งเป็น `Authorization: Bearer <token>`
- polling คิว: ทุก `PATIENT_STATUS_REFRESH_MS` (default 10000 ms)

## 2. Conventions

| หัวข้อ | ค่า |
|---|---|
| Content-Type | `application/json; charset=utf-8` ทั้ง request/response |
| Envelope | สำเร็จ: `{ "ok": true, ... }` — ล้มเหลว: `{ "ok": false, "error": "<ข้อความไทย>", "errors": { "<field>": ["..."] } }` |
| ต้องส่ง envelope แม้ status 4xx/5xx | frontend หา key `ok` เสมอ ไม่งั้นขึ้น "เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง" |

### HTTP status ที่ frontend ตีความ

| status | frontend ทำอะไร |
|---|---|
| `200` / `201` | อ่าน `ok` ต่อ |
| `400` | validation — อ่าน `error` + `errors[field]` โชว์ใต้ช่อง |
| `401` | session หมดอายุ → ล้าง token, กลับหน้า login |
| `404` **เฉพาะ `GET /api/patient/queue/`** | = ไม่มีคิววันนี้ (ไม่ใช่ error) |
| `409` | ข้อมูลชนกัน → โชว์ `error` |
| `5xx` | โชว์ `error` ถ้ามี ไม่งั้นข้อความ generic |

### CORS

allow origin ของ portal เท่านั้น (dev `http://127.0.0.1:5500`, prod โดเมนจริง),
`Access-Control-Allow-Headers: Content-Type, Authorization`, ตอบ preflight `OPTIONS`

---

## 3. Endpoints ที่ backend มีจริงตอนนี้ (4 ตัว)

### 3.1 `POST /api/patient/register/` — ลงทะเบียนผู้ป่วยใหม่ + ออกคิว
ไม่ต้อง auth. frontend normalize string ว่าง → `null` ให้แล้ว

Request body:
```
website               honeypot — ถ้าไม่ null ให้ปฏิเสธเงียบ (บอท)
first_name, last_name
national_id            13 หลัก (frontend ตรวจ mod-11 check digit แล้ว)
gender                 M | F | O | UNKNOWN
age                    number | null
phone                  บังคับ (frontend)
email                  บังคับ (frontend)
blood_type             A | B | AB | O | UNKNOWN
height_cm, weight_kg   number | null
chronic_diseases, allergies, medications
note                   อาการวันนี้ → เก็บลง symptom ของคิว
province, district, subdistrict, postal_code
emergency_name, emergency_relationship, emergency_phone   (หลายรายการ frontend join ", ")
consent                ต้อง true
```

Response `201`:
```json
{
  "ok": true,
  "access_token": "<token>",
  "queue_number": "A012",
  "status_label": "รอตรวจ",
  "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
  "queue_position": 3,
  "room": "ห้องตรวจ 2",
  "updated_at": "2026-09-09T09:30:00Z"
}
```

**Known issue:** ไม่ dedupe `national_id` → สมัครซ้ำเลขเดิม = สร้างคิวซ้อน 2 อัน ทั้งคู่พัง.
frontend กันชั้นหนึ่งแล้ว (เช็ค `login/` + `queue/` ก่อน `register/` ถ้ามีคิว active → พาไปหน้าคิวเดิม)
แต่ backend ควร `409` ด้วยถ้า national_id มีคิว active อยู่ / เป็น patient ที่มีอยู่แล้ว

### 3.2 `POST /api/patient/login/` — เข้าสู่ระบบ
ไม่ต้อง auth.
```json
// request
{ "national_id": "1101700230708" }
// response 200
{ "ok": true, "access_token": "<token>" }
```
ไม่พบ → `404 { "ok": false, "error": "ไม่พบข้อมูลผู้ป่วย ..." }`

**Known issue:** national_id อย่างเดียว = ไม่ปลอดภัย (เลขบัตรอยู่บนบัตร/ถ่ายสำเนาบ่อย).
นี่คือเพดานความปลอดภัยของทั้งแอปตอนนี้. frontend ใช้ endpoint นี้เป็น "การยืนยันตัวตน" ในหลาย flow
(กู้คืน PIN แบบ fallback, เช็คสมัครซ้ำ)

### 3.3 `GET /api/patient/me/` — โปรไฟล์ + คิว + ประวัติ + นัด
`Authorization: Bearer <token>`

Response `200`:
```json
{
  "ok": true,
  "profile": {
    "first_name": "สมชาย", "last_name": "ใจดี",
    "national_id": "1101700230708", "hn": "HN-67001",
    "phone": "0812345678", "email": "patient@example.com", "gender": "M",
    "birth_date": "1989-04-01", "age": 36,
    "blood_type": "O", "height_cm": 170, "weight_kg": 65,
    "address": "...", "chronic_diseases": "...", "allergies": "...", "medications": "...",
    "emergency_name": "สมศรี ใจดี", "emergency_phone": "0899999999",
    "emergency_contacts": [
      { "id": "c1", "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "0899999999" }
    ]
  },
  "active_queue": { "queue_number": "A012", "status_label": "รอตรวจ", "instruction": "...",
                    "queue_position": 3, "room": "ห้องตรวจ 2", "updated_at": "..." },
  "visits": [
    { "queue_number": "A005", "status_label": "ตรวจเสร็จสิ้น", "registered_at": "...",
      "note": "...", "diagnosis": "...", "treatment": "...",
      "vitals": { "sys_bp": 120, "dia_bp": 80, "pr": 72, "bt": 36.5, "o2sat": 99 } }
  ],
  "appointments": [
    { "status": "SCHEDULED", "status_label": "นัดตรวจติดตาม", "date": "2026-09-15",
      "time": "09:00 - 10:00", "note": "..." }
  ]
}
```
- `active_queue` = `null` ถ้าไม่มีคิว / ยกเลิก / ปิดเคสแล้ว
- `emergency_contacts` = source of truth; `emergency_name`/`emergency_phone` = สำเนารายการแรก

**frontend อยากได้เพิ่ม:**
- `profile.email` — สำหรับกู้คืน PIN ทางอีเมล (frontend รองรับทั้งมี/ไม่มี)
- `has_profile: false` + `profile: null` — ถ้าบัญชียังไม่กรอกประวัติ
- `active_queue.eta_minutes` (int|null) — ตอนนี้ frontend เดาเป็น `position × 5–7` นาที
- เบอร์: เก็บ canonical form เดียว (`+66…` หรือ `0…` ก็ได้ ขอให้สม่ำเสมอทุก endpoint)

### 3.4 `PATCH /api/patient/me/` — แก้ไขโปรไฟล์
`Authorization: Bearer <token>`. frontend เรียกจากปุ่ม "แก้ไขข้อมูล" ในหน้าบัญชี
ส่งเฉพาะ field ที่เปลี่ยน (ทุก field optional): field ชุดเดียวกับ `profile` ด้านบน +
`province`/`district`/`subdistrict`/`postal_code`
- **ห้ามแก้** `national_id`, `hn` → ส่งมาให้ ignore
- Response `200`: account object ทั้งก้อน (โครงเดียวกับ `GET /me/`)
- `401` → frontend logout

**Known issue:** mock backend แค่ echo กลับ — **ต้องเขียนลง DB จริง**

### 3.5 `GET /api/patient/queue/` — คิว OPD วันนี้
`Authorization: Bearer <token>`. frontend poll ทุก ~10 วิ
- มีคิว → `200 { "ok": true, "queue_number": "A012", "status_label": "...", "instruction": "...",
  "queue_position": 3, "room": "...", "updated_at": "..." }`
- ไม่มีคิว → `404 { "ok": false, "error": "" }` **หรือ** `200 { "ok": true, "queue_number": null }`
- `queue_position`: จำนวนคิวก่อนหน้าในห้องเดียวกัน (0 = เรียก/ถึงคิว), `null` = ยังจัดลำดับไม่เสร็จ
- `status_label` ที่ frontend จับ keyword: มี `"เรียก"` / `"ห้องตรวจ"` → เตือนใกล้ถึงคิว;
  `"ตรวจเสร็จ"` / `"รับยา"` → จบ

**frontend อยากได้:** `eta_minutes`; หลัง cancel คิวเดิม**ต้องไม่**กลับมาโผล่อีก

### 3.6 `POST /api/patient/queue/cancel/` — สละสิทธิ์คิว
`Authorization: Bearer <token>`. ไม่มี body
- soft delete (`status = CANCELLED`)
- `200 { "ok": true, "message": "ยกเลิกคิวเรียบร้อยแล้ว" }`
- หลังจากนี้ `GET /queue/` และ `me/`.`active_queue` ต้องเป็น "ไม่มีคิว"
- ไม่มีคิว → `409 { "ok": false, "error": "ไม่พบคิวที่กำลังใช้งาน" }`

---

## 4. Endpoints ที่ frontend เรียก แต่ backend ยังไม่มี

frontend เรียก path เหล่านี้อยู่ **แต่มี auto-fallback** — backend ตอบ 404 ก็ไม่พัง

| path | ตอนนี้ frontend ทำอะไรแทน |
|---|---|
| `POST /api/patient/pin/setup/` | เก็บ PIN hash ใน `localStorage` |
| `POST /api/patient/pin/verify/` | เช็ค PIN hash ใน `localStorage` (server-first: ลอง endpoint ก่อน → 404 = fallback local) |
| `POST /api/patient/pin/change/` | เขียน `localStorage` |
| `POST /api/patient/pin/reset/request/` | 404 → fallback: ยืนยันตัวตนด้วย `POST /api/patient/login/` (national_id) |
| `POST /api/patient/pin/reset/confirm/` | ไม่ถูกเรียก (ยังไม่ถึง flow OTP) |

→ รายละเอียด spec ครบ: [`BACKEND_HANDOFF.md`](BACKEND_HANDOFF.md)

---

## 5. ระบบ PIN ตอนนี้

- **PIN 6 หลัก = client-side ล้วน** (`localStorage`, hash เอง). เป็น stopgap
- frontend ทำ **server-first verify**: unlock → เรียก `pin/verify` → 404/offline ค่อย fallback เช็ค local
- lockout กรอกผิด: escalating `[60s, 300s, 1800s]` — ตอนนี้เก็บใน `localStorage` (ล้าง = reset ได้)
- กู้คืน PIN: ลอง OTP endpoint → ไม่มี → ยืนยันด้วยเลขบัตร ปชช. (`login/`) แล้วตั้ง PIN ใหม่
- ทั้งหมดนี้จะกลายเป็น server-authoritative เมื่อ backend ทำตาม `BACKEND_HANDOFF.md` — **frontend ไม่ต้องแก้เพิ่ม**

---

## 6. สิ่งที่อยากให้ backend ทำ (เรียงลำดับ)

1. **ระบบ PIN ที่ server + กู้คืนผ่าน OTP อีเมล/เบอร์** → [`BACKEND_HANDOFF.md`](BACKEND_HANDOFF.md)
2. `register/` ตอบ `409` เมื่อ `national_id` มีคิว active อยู่แล้ว / เป็น patient เดิม
3. `PATCH /api/patient/me/` เขียน DB จริง (ตอนนี้ mock echo)
4. `GET /me/` เพิ่ม `email`, `has_profile`; `active_queue` + `GET /queue/` เพิ่ม `eta_minutes`
5. หลัง `queue/cancel/` — `GET /queue/` ต้องไม่คืนคิวเดิม
6. เก็บเบอร์เป็น canonical form เดียว (frontend จะ normalize เป็น `0…` ตอนแสดงผล)
7. *(อนาคต)* login เพิ่มปัจจัยที่สอง (PIN/OTP) แทน national_id อย่างเดียว;
   token มีวันหมดอายุ + endpoint refresh; PDPA (ถอนยินยอม / export / ลบข้อมูล)
