# Hospital Queue — Backend API Spec (RESTful, real persistence)

เป้าหมาย: backend ต้องเก็บข้อมูลจริงลงฐานข้อมูลและให้ CRUD ผ่าน REST API ไม่ใช่ mock
ที่ตอบค่าคงที่. เอกสารนี้คือสัญญา (contract) ที่ frontend เรียกใช้ — field names, methods,
และ path ทั้งหมดต้องตรงเป๊ะ.

Frontend อยู่นอก repo backend และเรียกผ่าน `fetch` ตรง ไม่มี proxy / server action.
Base URL มาจาก env `PATIENT_API_BASE_URL` (เช่น `https://hospital.bfirstkok.me`).

**สถานะ ณ ตอนนี้:** frontend ยังเรียก auth แบบเลขบัตร ปชช. อย่างเดียว (ข้อ 8 = "ของเดิม").
แผนคือย้ายไป **เบอร์โทร + SMS OTP + PIN** (ข้อ 2–4). ทำ backend ตามข้อ 2–7 แล้ว frontend
จะสลับมาใช้พร้อมกัน. เอกสารนี้ครอบทั้งของใหม่และของเดิมที่ต้องเลิกใช้.

---

## 1. Conventions (ใช้กับทุก endpoint)

| หัวข้อ | ค่า |
|---|---|
| Content-Type | `application/json; charset=utf-8` ทั้ง request และ response |
| Response envelope | สำเร็จ: `{ "ok": true, ...data }` — ล้มเหลว: `{ "ok": false, "error": "<ข้อความไทย>", "errors": { "<field>": ["<detail>"] } }` |
| Auth header | `Authorization: Bearer <access_token>` |
| วันที่-เวลา | ISO 8601 UTC เช่น `2026-09-08T09:30:00Z` |
| เบอร์โทร | ตัวเลขไทย 10 หลักล้วน ไม่มีขีด เช่น `0812345678` (frontend normalize ให้) |
| `national_id` | ตัวเลข 13 หลักล้วน — ใช้ **match เวชระเบียนเท่านั้น ไม่ใช่รหัสเข้าระบบ**; backend ต้องตรวจ mod-11 check digit ซ้ำ |
| ภาษา error | ข้อความใน `error` แสดงให้ผู้ป่วยเห็นตรง ๆ → ภาษาไทย สุภาพ |

### HTTP status ที่ frontend ใช้ตัดสินใจ

| status | frontend ทำอะไร |
|---|---|
| `200` / `201` | อ่าน `ok` ต่อ |
| `400` | validation — อ่าน `error` + `errors[field]` โชว์ใต้ช่องกรอก |
| `401` | session หมดอายุ → ล้าง token, เด้งกลับหน้า auth ทันที |
| `404` (เฉพาะ `GET /queue/`) | "ไม่มีคิววันนี้" ไม่ใช่ error |
| `409` | ข้อมูลชนกัน เช่น มีคิว active อยู่แล้ว / เบอร์ซ้ำ → โชว์ `error` |
| `423` / `429` | ถูกล็อก PIN ชั่วคราว / ขอ OTP ถี่เกิน → โชว์ `error` (+ `locked_until` ถ้ามี) |
| `5xx` | โชว์ `error` ถ้ามี ไม่งั้นข้อความ generic |

ต้องส่ง envelope `{ "ok": false, "error": ... }` มาด้วยแม้ status 4xx/5xx
(frontend `parseResponse` ต้องเจอ key `ok` ไม่งั้นขึ้น "เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง").

### CORS

Frontend serve จาก origin แยก (dev: `http://127.0.0.1:5500`, prod: โดเมน portal).
ตอบ preflight `OPTIONS` + header:

```
Access-Control-Allow-Origin: <origin ของ portal เท่านั้น ไม่ใช่ *>
Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: false
```

---

## 2. Auth model — เบอร์โทร + อีเมล (ยืนยันทั้งคู่) + PIN

**ตอนสมัครครั้งแรก ต้องกรอกทั้งเบอร์โทรและอีเมล และต้องยืนยันทั้งสองอย่าง** (OTP ทาง SMS
+ OTP/ลิงก์ทางอีเมล) ก่อนบัญชีจะใช้งานได้. เลขบัตร ปชช. เป็นแค่ตัวระบุเวชระเบียน ไม่ใช่ความลับ.
PIN 6 หลักเป็นตัว "ปลดล็อกเร็ว" บนเครื่องที่เคยยืนยันแล้ว.

### บทบาทของแต่ละอย่าง

| สิ่ง | บังคับตอนสมัคร | ใช้ทำอะไร |
|---|---|---|
| **เบอร์โทร** | ✅ + ยืนยันด้วย SMS OTP | identity หลัก (unique), ช่องทางกู้คืน, แจ้งเตือน |
| **อีเมล** | ✅ + ยืนยันด้วย OTP/ลิงก์ทางอีเมล | identity รอง (unique), ช่องทางกู้คืนสำรอง, รองรับ Google OAuth ภายหลัง |
| **PIN 6 หลัก** | ✅ ตั้งหลังยืนยันทั้ง 2 ช่องทาง | ปลดล็อกใช้งานประจำวัน — hash + escalating lockout ที่ server |
| **เลขบัตร ปชช.** | (อยู่ในขั้นกรอกประวัติ) | match HN / เวชระเบียนเดิมของ รพ. — ไม่ใช่รหัสเข้าระบบ |

บัญชีจะ "สมบูรณ์" (`account_status = ACTIVE`) เมื่อ `phone_verified_at` **และ**
`email_verified_at` ไม่เป็น null และตั้ง PIN แล้ว. ก่อนหน้านั้นบัญชีอยู่สถานะ `PENDING`
และเข้าถึงได้เฉพาะ endpoint การยืนยัน/ตั้ง PIN.

### Token 3 ระดับ

- **signup token** — ออกจาก `auth/signup/start`. ใช้ได้เฉพาะ `auth/otp/*` (ยืนยัน phone/email)
  และ `pin/setup`. มี claim ว่าช่องทางไหนยืนยันแล้วบ้าง. อายุ 30 นาที.
- **pre-auth token** — บัญชี ACTIVE แต่เครื่องนี้ยังไม่มี PIN. ใช้ได้เฉพาะ `pin/setup`.
- **full token** — ออกเมื่อผ่าน PIN (`pin/verify` / `pin/reset/confirm`) หรือ `pin/setup` สำเร็จ.
  ใช้ทุก endpoint ที่ต้อง auth.
- ทุกแบบ **ต้องมีวันหมดอายุจริง** (signup/pre-auth 15–30 นาที, full token 30–60 นาที). หมดอายุ → `401`.
- แนะนำ `POST /api/patient/token/refresh/` (ข้อ 4.1).
- Token เก็บฝั่ง client ใน `localStorage["hospital_patient_access_token"]` (plaintext) → ห้ามใส่ข้อมูลอ่อนไหวใน payload.

### Flow ที่ frontend จะทำ

| สถานการณ์ | ลำดับ |
|---|---|
| **สมัครใหม่** | `auth/signup/start` (phone + email) → `otp/request`+`otp/verify` ช่องทาง `phone` → `otp/request`+`otp/verify` ช่องทาง `email` → ทั้งคู่ verified → `pin/setup` (ได้ full token) → บังคับกรอกประวัติ → จองคิว |
| กลับมา เครื่องเดิม | ใส่ PIN → `pin/verify` → full token |
| กลับมา เครื่องใหม่ | `otp/request`(LOGIN, phone หรือ email) → `otp/verify` → ได้ token + `has_pin` + `has_profile` → ตั้ง PIN เครื่องนี้ หรือใส่ PIN เดิม |
| ลืม PIN | `pin/reset/request` (OTP ทาง phone หรือ email) → `pin/reset/confirm` (OTP + PIN ใหม่) → full token |
| **เปลี่ยน PIN** (รู้ PIN เดิม) | `pin/change` (`current_pin` + `new_pin`, full token) |
| **เปลี่ยนเบอร์ / อีเมล** | `contact/change/request` (channel + ค่าใหม่, full token) → OTP ไปที่ค่าใหม่ + แจ้งเตือนค่าเดิม → `contact/change/confirm` (OTP) → สลับค่า |

---

## 3. Data models (ขั้นต่ำที่ต้อง persist)

### Account  (identity / auth)
`id`,
`phone` (**NOT NULL**, unique, indexed, เก็บเป็นตัวเลข 10 หลัก), `phone_verified_at` (timestamp|null),
`email` (**NOT NULL**, unique, เก็บเป็น lowercase+trim), `email_verified_at` (timestamp|null),
`account_status` (`PENDING` | `ACTIVE` | `DISABLED` — ACTIVE เมื่อยืนยันครบ 2 ช่องทาง + มี PIN),
`pending_phone` / `pending_email` (nullable — ค่าใหม่ที่รอยืนยันตอนเปลี่ยน contact),
`created_at`, `updated_at`, `disabled_at` (nullable).

### PinCredential  (1:1 กับ Account)
`account_id`, `pin_hash` (Argon2id หรือ bcrypt cost ≥ 12 — **ห้ามเก็บ PIN ดิบ / SHA ธรรมดา**),
`failed_attempts` (int), `locked_until` (timestamp|null),
`lockout_level` (int, default 0 — escalation tier, ดูข้อ 4.2b), `updated_at`.

### OtpChallenge
`id`, `channel` (`phone` | `email`), `target` (เบอร์หรืออีเมลที่ส่งไป),
`purpose` (`SIGNUP_VERIFY` | `LOGIN` | `PIN_RESET` | `CONTACT_CHANGE`),
`account_id` (nullable — null ตอน signup/login ที่ยังไม่มีบัญชี),
`code_hash`, `expires_at` (สร้าง + 5 นาที), `consumed_at` (nullable), `attempts` (int), `created_at`.
Index: (`channel`, `target`, `purpose`, `created_at`).
อีเมลจะส่งเป็น OTP 6 หลัก หรือ magic link ที่ฝัง token ก็ได้ — frontend รองรับการกรอก 6 หลัก
เป็นหลัก ถ้าใช้ magic link ต้อง redirect กลับมาที่ portal พร้อม query ที่ frontend เอาไปยิง verify ต่อได้.

### Patient  (เวชระเบียน — 1:1 กับ Account ตอนนี้; เผื่อ dependents ในอนาคต)
`id`, `account_id` (FK, nullable ระหว่าง migration), `national_id` (unique, indexed),
`hn` (รพ.ออกให้), `first_name`, `last_name`, `gender` (`M`/`F`/`O`/`UNKNOWN`),
`birth_date` (date|null), `age` (int|null), `phone`, `blood_type`
(`A`/`B`/`AB`/`O`/`UNKNOWN`), `height_cm` (decimal|null), `weight_kg` (decimal|null),
`address` (text|null), `province`, `district`, `subdistrict`, `postal_code`,
`chronic_diseases` (text|null), `allergies` (text|null), `medications` (text|null),
`created_at`, `updated_at`.

> `national_id` ที่ผู้ป่วยกรอกตอน "กรอกประวัติ" → backend พยายาม match กับเวชระเบียนเดิม
> (ผูก `hn`). ถ้า `national_id` ซ้ำกับ Patient ที่ผูก Account อื่นแล้ว → `409`.

### EmergencyContact  (FK → Patient, สูงสุด 3)
`id`, `patient_id`, `name`, `relationship`
(`FATHER`/`MOTHER`/`SPOUSE`/`CHILD`/`SIBLING`/`RELATIVE`/`FRIEND`/`CAREGIVER`/`OTHER`),
`phone`, `sort_order`.

### PdpaConsent  (FK → Patient)
`id`, `patient_id`, `consent_version`, `accepted_at`, `withdrawn_at` (nullable),
`source` (`registration`/`settings`).

### Queue  (คิว OPD 1 ใบต่อการมา 1 ครั้ง)
`id`, `patient_id`, `queue_number` (เช่น `A012`), `department` (default `OPD`),
`status` (`WAITING`/`CALLING`/`IN_ROOM`/`DONE`/`MISSED`/`CANCELLED`),
`status_label` (ไทย, derived), `instruction` (ไทย),
`queue_position` (int|null — จำนวนคิวก่อนหน้า, 0 = ถึงคิว), `room` (string|null),
`eta_minutes` (int|null — จาก position × เวลาเฉลี่ยจริงต่อคิวของแผนก),
`symptom_note`, `created_at`, `updated_at`, `cancelled_at` (nullable).

### Visit  (ประวัติการรักษาที่ปิดเคสแล้ว — read-only ฝั่งผู้ป่วย)
`id`, `patient_id`, `queue_number`, `status_label`, `registered_at`,
`note`, `diagnosis`, `treatment`,
`vitals` = { `sys_bp`, `dia_bp`, `pr`, `bt`, `o2sat` } (ทุกตัว number|null).

### Appointment  (FK → Patient)
`id`, `patient_id`, `status`
(`SCHEDULED`/`ATTENDED`/`MISSED`/`CANCELLED`/`confirmed`),
`status_label` (ไทย), `date` (`YYYY-MM-DD`), `time` (`HH:MM` หรือ `HH:MM - HH:MM`|null),
`note`, `created_at`, `updated_at`.

---

## 4. Endpoints

### 4.1 Auth — สมัคร + ยืนยัน 2 ช่องทาง + login

#### `POST /api/patient/auth/signup/start/`   — เริ่มสมัคร (บังคับเบอร์ + อีเมล)
ไม่ต้อง auth.

```json
{ "phone": "0812345678", "email": "patient@example.com" }
```
- Validate: เบอร์ 10 หลัก, อีเมลรูปแบบถูกต้อง (normalize เป็น lowercase+trim)
- **เบอร์หรืออีเมลถูกใช้กับบัญชี ACTIVE อยู่แล้ว** → `409 { "ok": false, "error": "เบอร์โทรหรืออีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ" }`
  (ถ้าเป็นบัญชี PENDING ที่สมัครค้างไว้ ให้ reuse บัญชีเดิมได้)
- สร้าง `Account` สถานะ `PENDING` (ทั้ง `phone_verified_at` / `email_verified_at` = null)
- ตอบ `201 { "ok": true, "access_token": "<signup token>", "phone_verified": false, "email_verified": false }`
- ยังไม่ส่ง OTP ที่นี่ — frontend จะเรียก `otp/request` แยกทีละช่องทาง

#### `POST /api/patient/auth/otp/request/`   — ขอ OTP (SMS หรืออีเมล)
Auth: signup token สำหรับ `SIGNUP_VERIFY`, full token สำหรับ `CONTACT_CHANGE`, ไม่ต้อง auth สำหรับ `LOGIN` / `PIN_RESET`.

```json
{ "channel": "phone", "purpose": "SIGNUP_VERIFY" }
{ "channel": "email", "purpose": "LOGIN", "target": "patient@example.com" }
```
- `channel`: `"phone"` | `"email"`
- `purpose`: `"SIGNUP_VERIFY"` | `"LOGIN"` | `"PIN_RESET"` | `"CONTACT_CHANGE"`
- `target` จำเป็นเฉพาะ `LOGIN` / `PIN_RESET` (ไม่มี token ให้ผูก); `SIGNUP_VERIFY` / `CONTACT_CHANGE`
  ดึง target จาก `Account` / `pending_*` ตาม token
- สร้าง `OtpChallenge` (6 หลักสุ่ม, เก็บ **hash**, TTL 5 นาที, single-use), ส่งจริงผ่าน SMS gateway / SMTP
- **ตอบ `{ "ok": true, "resend_after_seconds": 60 }` เสมอ** แม้ target ไม่มีในระบบ (กัน enumerate)
- Rate limit: ≤ 3 ครั้ง / 15 นาที / target → `429 { "ok": false, "error": "ขอรหัสถี่เกินไป กรุณารอสักครู่" }`

#### `POST /api/patient/auth/otp/verify/`   — ยืนยัน OTP
Auth: เหมือน `otp/request`.

```json
{ "channel": "phone", "otp": "123456", "purpose": "SIGNUP_VERIFY" }
```
ตรวจ OTP: ตรง hash, ยังไม่ `consumed_at` / `expires_at`, `attempts < 5`.
ไม่ผ่าน → `attempts += 1`, `400 { "ok": false, "error": "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }`.

ผ่าน (`consumed_at = now`) แยกตาม purpose:

- **`SIGNUP_VERIFY`** → เซ็ต `phone_verified_at` หรือ `email_verified_at` ตาม channel. ตอบ:
  ```json
  { "ok": true, "phone_verified": true, "email_verified": false }
  ```
  เมื่อ **ทั้งคู่** verified: `account_status` ยังเป็น `PENDING` จนกว่าจะตั้ง PIN — frontend
  ไปต่อ `pin/setup` ด้วย signup token เดิม

- **`LOGIN`** →
  - บัญชี ACTIVE: `{ "ok": true, "access_token": "<token>", "has_pin": <bool>, "has_profile": <bool> }`
    (`has_pin:true` → full token; `false` → pre-auth token)
  - บัญชี PENDING (สมัครค้าง): `{ "ok": true, "access_token": "<signup token>", "phone_verified": <bool>, "email_verified": <bool>, "has_pin": false }` — frontend พาไปทำ signup ต่อ
  - ไม่มีบัญชีเลย → `404 { "ok": false, "error": "ไม่พบบัญชี กรุณาสมัครสมาชิก" }`

- **`CONTACT_CHANGE`** (full token) → ยืนยันค่าใหม่: ย้าย `pending_phone`/`pending_email` มาเป็นค่าจริง,
  อัปเดต `*_verified_at`, เคลียร์ `pending_*`. ตอบ `{ "ok": true }`. (ดูข้อ 4.2c)

#### `POST /api/patient/token/refresh/`   — ต่ออายุ session (แนะนำ, frontend ยังไม่เรียก)
`Authorization: Bearer <full token ที่ยังไม่หมดอายุ>` → `{ "ok": true, "access_token": "<ใหม่>" }`.

#### `POST /api/patient/login/`   — **DEPRECATED (ของเดิม, national_id)**
body `{ "national_id": "..." }` → `{ "ok": true, "access_token": "..." }`.
เก็บไว้จนกว่าจะสลับมา phone/email+OTP ครบ แล้วค่อยลบ. ห้ามใช้ในโค้ดใหม่.

---

### 4.2 PIN (ผูกกับ Account — hash + lockout ที่ server)

#### `POST /api/patient/pin/setup/`   — ตั้ง PIN ครั้งแรก / ตั้งใหม่บนเครื่องใหม่
`Authorization: Bearer <token>` (signup / pre-auth / full).

```json
{ "pin": "445566" }
```
- **ถ้าเป็น signup token**: ต้องมี `phone_verified_at` **และ** `email_verified_at` ครบก่อน ไม่งั้น
  `409 { "ok": false, "error": "กรุณายืนยันเบอร์โทรและอีเมลให้ครบก่อนตั้งรหัส PIN" }`.
  ตั้งสำเร็จ → `account_status = ACTIVE`.
- hash เก็บใน `PinCredential.pin_hash`, reset `failed_attempts` / `locked_until` / `lockout_level`
- ถ้ามี PIN อยู่แล้วและ token เป็น full → อนุญาต (ตั้งใหม่บนเครื่องนี้); ถ้า signup/pre-auth และมี PIN แล้ว → `409`
- Response `200`: `{ "ok": true, "access_token": "<full token>", "message": "ตั้งรหัส PIN สำเร็จ" }`
  (คืน full token ด้วย เพื่อให้ frontend เลิกใช้ token เดิมทันที)

> ตอนนี้ frontend "กลืน" error ของ endpoint นี้ (ตั้ง PIN ในเครื่องต่อได้แม้ backend fail).
> เมื่อ endpoint เชื่อถือได้แล้ว แจ้งกลับมาเพื่อให้ frontend เปลี่ยนเป็น hard-fail + rollback.

#### `POST /api/patient/pin/verify/`   — ปลดล็อกด้วย PIN → full token
ไม่ต้อง auth (ใช้ `phone` + `pin`).

```json
{ "phone": "0812345678", "pin": "445566" }
```
> หมายเหตุ: ของเดิม frontend ส่ง `{ "national_id", "pin" }`. ตอนสลับ auth model
> frontend จะเปลี่ยนเป็น `{ "phone", "pin" }`. รองรับ `phone` เป็นหลัก.

Logic:
1. `locked_until` > now → `423 { "ok": false, "error": "ถูกระงับชั่วคราว", "locked_until": "2026-09-08T10:05:00Z" }`
2. PIN ถูก → reset `failed_attempts` **และ** `lockout_level` = 0, `{ "ok": true, "access_token": "<full token>" }`
3. PIN ผิด → `failed_attempts += 1`; ครบ 3 → **escalating lockout**:
   `lockout_until = now + tier(lockout_level)` โดย `tier = [60s, 300s, 1800s]` (tier สุดท้ายวนซ้ำ),
   แล้ว `lockout_level += 1`. ตอบ `401 { "ok": false, "error": "รหัส PIN ไม่ถูกต้อง", "attempts_left": 2 }`
4. หมดเวลา lockout → `failed_attempts` = 0 แต่ **`lockout_level` คงไว้** (การล็อกครั้งถัดไปยาวขึ้น)
5. การ login ใหม่ / เปลี่ยนอุปกรณ์ **ต้องไม่** รีเซ็ต `lockout_until` หรือ `lockout_level` — มีแค่ PIN ที่ถูกต้องเท่านั้นที่เคลียร์ได้

> frontend ทำ escalation แบบนี้ใน `localStorage` ไว้แล้วเป็น stopgap (bypass ได้ด้วยการล้าง storage /
> ตั้ง PIN ใหม่). เมื่อ endpoint ส่ง `attempts_left` / `locked_until` มา frontend จะเลิกเชื่อของตัวเอง.

#### `POST /api/patient/pin/reset/request/`   — ขอ OTP เพื่อรีเซ็ต PIN
ไม่ต้อง auth. (เทียบเท่า `auth/otp/request/` ที่ `purpose = "PIN_RESET"` — จะรวมเป็น endpoint เดียวก็ได้)

```json
{ "national_id": "1101700230708", "channel": "phone", "target": "0812345678" }
```
> `target` = **เบอร์/อีเมลที่ลงทะเบียนไว้กับบัญชี** (frontend ดึงจาก cache ของ `/me` มาส่งให้ ผู้ใช้ไม่ได้พิมพ์เอง).
> Backend ควรตรวจว่า `target` ตรงกับ contact ที่ผูก `national_id` นั้นจริง — ถ้าไม่ตรง อย่าส่ง OTP
> (แต่ยังตอบ `{ "ok": true }` เพื่อกัน enumerate). ตอนสลับ model จะเป็น `{ "phone": "...", "purpose": "PIN_RESET" }`
> และ backend เป็นคน lookup contact เอง.

- ตอบ `{ "ok": true }` เสมอ (กัน enumerate). Rate-limit เหมือน `otp/request`.

> **สถานะ ณ ตอนนี้:** backend (`Project_hospital_queue`, Django) ยังไม่มี `pin/reset/*` และ `pin/*`
> ทั้งหมด. เมื่อ frontend เรียก `requestPinReset` แล้วเจอ 404/หา endpoint ไม่เจอ จะ **degrade อัตโนมัติ**:
> ยืนยันตัวตนด้วย `POST /api/patient/login/` (national_id ที่มีอยู่จริง) แล้วให้ตั้ง PIN ใหม่ใน localStorage.
> เมื่อ backend ทำ `pin/reset/request` + `pin/reset/confirm` ขึ้นมา flow OTP จะทำงานเองโดยไม่ต้องแก้ frontend.

#### `POST /api/patient/pin/reset/confirm/`   — ยืนยัน OTP + ตั้ง PIN ใหม่
ไม่ต้อง auth.

```json
{ "national_id": "1101700230708", "otp": "123456", "pin": "778899" }
```
> ของเดิม. ตอนสลับ model → `{ "phone": "...", "otp": "...", "pin": "..." }`.

- OTP ผ่าน → `consumed_at = now`, เขียน `pin_hash` ใหม่, reset lockout,
  `{ "ok": true, "access_token": "<full token>" }`
- ไม่ผ่าน → `400 { "ok": false, "error": "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }`

#### `POST /api/patient/pin/change/`   — เปลี่ยน PIN ทั้งที่รู้ PIN เดิม
`Authorization: Bearer <full token>`.

```json
{ "current_pin": "445566", "new_pin": "778899" }
```
- ถ้า `locked_until` > now → `423` (เหมือน `pin/verify`)
- `current_pin` ผิด → นับเป็น failed attempt (escalating lockout เหมือน `pin/verify`),
  `401 { "ok": false, "error": "รหัส PIN เดิมไม่ถูกต้อง", "attempts_left": 2 }`
- `new_pin` ต้อง 6 หลัก และไม่เท่ากับ `current_pin` → ไม่งั้น `400`
- สำเร็จ → เขียน `pin_hash` ใหม่, reset lockout ทั้งหมด, `{ "ok": true, "message": "เปลี่ยนรหัส PIN สำเร็จ" }`
- แนะนำ: ส่งการแจ้งเตือน (SMS/อีเมล) ว่ามีการเปลี่ยน PIN

> frontend: หน้า Settings มีเมนู "เปลี่ยนรหัส PIN" (`PinAuthView mode="change"`) อยู่แล้ว —
> ตอนนี้เช็ค/เขียนใน `localStorage` ล้วน จะ wire มายิง endpoint นี้ตอนสลับ auth model.

#### `POST /api/patient/pin/reset/*`  (ลืม PIN — ดูข้อ 4.2 ด้านบน)
เทียบเท่า `auth/otp/request` + `auth/otp/verify` ที่ `purpose = PIN_RESET`. จะ implement
เป็น endpoint แยก (`pin/reset/request`, `pin/reset/confirm`) หรือรวมกับ `auth/otp/*` ก็ได้ —
`pin/reset/confirm` ต้องรับ `pin` (PIN ใหม่) มาด้วยและคืน full token.

---

#### 4.2c `POST /api/patient/contact/change/request/`   — ขอเปลี่ยนเบอร์ / อีเมล
`Authorization: Bearer <full token>`.

```json
{ "channel": "email", "new_value": "new@example.com" }
```
- `channel`: `"phone"` | `"email"`
- Validate รูปแบบ + ตรวจว่าค่าใหม่ยังไม่ถูกใช้กับบัญชี ACTIVE อื่น → ซ้ำ `409`
- เก็บลง `pending_phone` / `pending_email`, สร้าง `OtpChallenge` `purpose=CONTACT_CHANGE` `channel` ตามที่ขอ
  ส่ง OTP ไป **ค่าใหม่** + ส่งการแจ้งเตือน (ไม่ใช่ OTP) ไป **ค่าเดิม** ว่ากำลังมีการเปลี่ยน
- ตอบ `{ "ok": true, "resend_after_seconds": 60 }`

#### 4.2c `POST /api/patient/contact/change/confirm/`   — ยืนยันเปลี่ยนเบอร์ / อีเมล
`Authorization: Bearer <full token>`, body `{ "channel": "email", "otp": "123456" }`
- OTP ผ่าน → ย้าย `pending_*` → ค่าจริง, อัปเดต `*_verified_at = now`, เคลียร์ `pending_*`,
  `{ "ok": true, "message": "เปลี่ยนอีเมลสำเร็จ" }`
- ไม่ผ่าน → `400 { "ok": false, "error": "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }`

> frontend: จะเพิ่มเมนูใน Settings ("เปลี่ยนเบอร์โทร" / "เปลี่ยนอีเมล") — ยังไม่ทำ

---

### 4.3 Patient profile — resource `me`

#### `GET /api/patient/me/`   — อ่านโปรไฟล์ + คิว + ประวัติ + นัด
`Authorization: Bearer <full token>`.

```json
{
  "ok": true,
  "has_profile": true,
  "account": {
    "phone": "0812345678", "phone_verified": true,
    "email": "patient@example.com", "email_verified": true
  },
  "profile": {
    "first_name": "สมชาย", "last_name": "ใจดี",
    "national_id": "1101700230708", "hn": "HN-67001",
    "phone": "0812345678", "email": "patient@example.com", "gender": "M",
    "birth_date": "1989-04-01", "age": 36,
    "blood_type": "O", "height_cm": 170, "weight_kg": 65,
    "address": "123/45 ...",
    "chronic_diseases": "ไม่มี", "allergies": "ไม่มีประวัติแพ้ยา", "medications": "ไม่มี",
    "emergency_name": "สมศรี ใจดี", "emergency_phone": "0899999999",
    "emergency_contacts": [
      { "id": "c1", "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "0899999999" }
    ]
  },
  "active_queue": {
    "ok": true, "queue_number": "A012", "status_label": "รอตรวจ",
    "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
    "queue_position": 3, "room": "ห้องตรวจ 2", "eta_minutes": 21,
    "updated_at": "2026-09-08T09:30:00Z"
  },
  "visits": [
    { "queue_number": "A005", "status_label": "ตรวจเสร็จสิ้น",
      "registered_at": "2026-08-01T09:30:00Z", "note": "ตรวจสุขภาพทั่วไป",
      "diagnosis": "ปกติ", "treatment": "แนะนำออกกำลังกาย",
      "vitals": { "sys_bp": 120, "dia_bp": 80, "pr": 72, "bt": 36.5, "o2sat": 99 } }
  ],
  "appointments": [
    { "status": "SCHEDULED", "status_label": "นัดตรวจติดตาม",
      "date": "2026-09-15", "time": "09:00 - 10:00", "note": "ติดตามผลสุขภาพประจำปี" }
  ]
}
```
- **`has_profile: false`** = บัญชีนี้ยังไม่ได้กรอกประวัติ → `profile` เป็น `null`, frontend บังคับหน้ากรอกประวัติ
- `active_queue` = `null` ถ้าไม่มีคิว/ยกเลิก/ปิดเคสแล้ว
- `emergency_contacts` = source of truth; `emergency_name`/`emergency_phone` = สำเนารายการแรก
- `visits` เรียงใหม่→เก่า, limit ~20 ล่าสุด

#### `POST /api/patient/profile/`   — สร้างประวัติผู้ป่วยครั้งแรก (ใหม่)
`Authorization: Bearer <full token>` ของบัญชีที่ `has_profile = false`.
Body = ข้อมูลประวัติ (ดู field ในข้อ 4.3 PATCH ด้านล่าง) + `consent: true`.
- backend: สร้าง `Patient` ผูก `account_id`, match เวชระเบียนด้วย `national_id`, บันทึก `PdpaConsent`
- `national_id` ซ้ำกับ Account อื่น → `409 { "ok": false, "error": "เลขบัตรนี้ผูกกับบัญชีอื่นแล้ว" }`
- Response `201`: account object ทั้งก้อน (เหมือน `GET /me/`)

#### `PATCH /api/patient/me/`   — แก้ไขประวัติ (Update)
`Authorization: Bearer <full token>`. ส่งเฉพาะ field ที่เปลี่ยน (ทุก field optional):

```json
{
  "first_name": "สมชาย", "last_name": "ใจดี", "gender": "M",
  "birth_date": "1989-04-01", "age": 36, "phone": "0812345678",
  "blood_type": "O", "height_cm": 170, "weight_kg": 65, "address": "...",
  "chronic_diseases": "...", "allergies": "...", "medications": "...",
  "emergency_name": "สมศรี ใจดี", "emergency_phone": "0899999999",
  "emergency_contacts": [
    { "id": "c1", "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "0899999999" }
  ]
}
```
- `emergency_contacts`: upsert ทั้งชุด — `id` เดิม = update, ไม่มี id = insert, id เดิมที่หายจาก array = delete. จำกัด 3.
- **ห้ามแก้** `national_id`, `hn` → ถ้าถูกส่งมาให้ ignore (อย่า error)
- ผิด → `400` + `errors: { "<field>": ["..."] }`
- Response `200`: account object ทั้งก้อนที่อัปเดตแล้ว (โครงเดียวกับ `GET /me/`)
- Token ไม่ถูกต้อง → `401`

> วันนี้ปุ่ม "แก้ไขข้อมูล" ใน portal เรียก `PATCH /api/patient/me/` จริงแล้ว และเด้ง error
> ถ้า backend ตอบไม่ใช่ 2xx. mock ปัจจุบันแค่ echo `/me/` — ต้องเก็บลง DB จริง.

---

### 4.4 Queue — resource `queue`

#### `GET /api/patient/queue/`   — คิว OPD ของวันนี้
`Authorization: Bearer <full token>`. frontend poll ทุก ~10 วินาที (`PATIENT_STATUS_REFRESH_MS`).

- มีคิว active → `200` + `QueueData`
- ไม่มีคิววันนี้ → `404 { "ok": false, "error": "" }` **หรือ** `200 { "ok": true, "queue_number": null }` (frontend รองรับทั้งสอง)
- หลังยกเลิก คิวเดิมต้อง **ไม่** กลับมาอีก
- `queue_position`: จำนวนคิวก่อนหน้าในห้องเดียวกัน (0 = เรียก/ถึงคิว), `null` = ยังจัดลำดับไม่เสร็จ
- `status_label` ที่ frontend จับ keyword: `"เรียก"` / `"ห้องตรวจ"` → เตือนใกล้ถึงคิว; `"ตรวจเสร็จ"` / `"รับยา"` → จบ
- `eta_minutes`: เวลารอโดยประมาณจริง (นาที) — ตอนนี้ frontend เดาเป็น `position × 5–7`

#### `POST /api/patient/queue/`   — จองคิววันนี้ (ใหม่ — แทน `register` เดิมสำหรับผู้มีบัญชี)
`Authorization: Bearer <full token>` ของบัญชีที่ `has_profile = true`.

```json
{ "symptom_note": "มีไข้ ไอ 2 วัน", "department": "OPD" }
```
- สร้าง `Queue` ใหม่ให้ `patient_id` ของบัญชีนี้
- มีคิว active อยู่แล้ว → `409 { "ok": false, "error": "คุณมีคิวที่กำลังรับบริการอยู่แล้ว" }`
- ยังไม่มีประวัติ → `409 { "ok": false, "error": "กรุณากรอกข้อมูลผู้ป่วยก่อนจองคิว" }`
- Response `201`: `QueueData` (queue_number, status_label, instruction, queue_position, room, eta_minutes, updated_at)

#### `POST /api/patient/queue/cancel/`   — สละสิทธิ์คิว (soft delete)
`Authorization: Bearer <full token>`. ไม่มี body.
- `status = CANCELLED`, `cancelled_at = now`
- `200 { "ok": true, "message": "ยกเลิกคิวเรียบร้อยแล้ว" }`
- ไม่มีคิว → `409 { "ok": false, "error": "ไม่พบคิวที่กำลังใช้งาน" }`
- หลังจากนี้ `GET /queue/` และ `me/`.`active_queue` ต้องเป็น "ไม่มีคิว"

#### `POST /api/patient/register/`   — **DEPRECATED (ของเดิม: สร้าง Patient + Queue ในคำขอเดียว)**
ปัจจุบัน frontend ยังเรียกตอนลงทะเบียนผู้ป่วยใหม่. Body = ข้อมูลประวัติเต็ม + `note` (อาการ) + `consent`.
Response `201`: `{ ok, access_token, queue_number, status_label, instruction, queue_position, room, updated_at }`.
หลังสลับเป็น phone+OTP: แยกเป็น `auth/otp/*` → `pin/setup` → `POST /profile/` → `POST /queue/`.
เก็บ `register/` ไว้จนกว่าจะสลับครบ.

Field ของ body เดิม (frontend normalize string ว่าง → `null` ให้แล้ว):
`website` (honeypot — ไม่ null ให้ปฏิเสธเงียบ), `first_name`, `last_name`, `national_id`,
`gender` (`M`/`F`/`O`/`UNKNOWN`), `age` (number|null),
**`phone` (บังคับ ห้าม null)**, **`email` (บังคับ ห้าม null, lowercase+trim)**,
`blood_type` (`A`/`B`/`AB`/`O`/`UNKNOWN`), `height_cm`/`weight_kg` (number|null),
`chronic_diseases`, `allergies`, `medications`, `note` (อาการวันนี้ → `Queue.symptom_note`),
`province`, `district`, `subdistrict`, `postal_code`,
`emergency_name`, `emergency_relationship`, `emergency_phone` (หลายรายการ frontend join ", "),
`consent` (ต้อง `true`).

> ระหว่างที่ยังใช้ `register/` (ก่อนสลับ model): `phone` + `email` เป็น required แล้ว แต่
> **ยังไม่มีการยืนยัน** — backend ควร trigger การส่ง OTP ยืนยันหลังสมัคร หรือ mark บัญชีเป็น
> `PENDING` จนกว่าจะยืนยันครบ. การยืนยันเต็มรูปแบบอยู่ใน flow ใหม่ (`auth/signup/*` + `auth/otp/*`).

---

### 4.5 Appointments — resource `appointments` (ตอนนี้ read ผ่าน `/me/` เท่านั้น)

Phase ถัดไปจะเพิ่มปุ่ม ยืนยัน/ขอเลื่อน/ยกเลิกนัด. เตรียม CRUD:

| method | path | ใช้ทำ |
|---|---|---|
| `GET` | `/api/patient/appointments/` | list (ตอนนี้ฝังใน `/me/`) |
| `POST` | `/api/patient/appointments/<id>/confirm/` | ผู้ป่วยยืนยันจะมา |
| `POST` | `/api/patient/appointments/<id>/cancel/` | ขอยกเลิก |
| `POST` | `/api/patient/appointments/<id>/reschedule/` | body `{ "requested_date": "...", "note": "..." }` |

auth required, envelope เดิม. (ยังไม่ต้องทำถ้าไม่พร้อม — frontend ยังไม่เรียก)

---

## 5. Security checklist (ต้องมีก่อน production)

- [ ] PIN hash ด้วย Argon2id / bcrypt (cost ≥ 12) — ไม่เก็บ PIN ดิบ / SHA ธรรมดา
- [ ] Lockout PIN ที่ server (`failed_attempts`, `locked_until`) — ไม่พึ่ง client
- [ ] OTP: 6 หลักสุ่มเข้ารหัส, TTL 5 นาที, single-use, จำกัดจำนวนครั้งเดา (`attempts < 5`), rate-limit การขอ (≤3/15นาที/target)
- [ ] **สมัครใหม่ต้องยืนยันทั้งเบอร์และอีเมล** ก่อนบัญชี ACTIVE — ตั้ง PIN ไม่ได้ถ้ายังไม่ครบ
- [ ] `phone` + `email` unique ต่อบัญชี (case-insensitive สำหรับอีเมล); ซ้ำ → `409` ไม่ใช่สร้างซ้อน
- [ ] เปลี่ยนเบอร์/อีเมล: OTP ไปค่าใหม่ + แจ้งเตือนค่าเดิม; เปลี่ยน PIN สำเร็จ: แจ้งเตือนเจ้าของบัญชี
- [ ] `national_id` ตรวจ mod-11 check digit ที่ server (frontend ตรวจแล้วแต่ bypass ได้)
- [ ] access_token มีวันหมดอายุจริง + endpoint refresh; แยก signup / pre-auth / full token
- [ ] CORS allow origin เฉพาะโดเมน portal ไม่ใช่ `*`
- [ ] Rate-limit `auth/otp/*` / `auth/signup/*` / `pin/verify` / `pin/change` / `register` ต่อ IP + ต่อ target
- [ ] ไม่ leak ว่าเบอร์/อีเมล/national_id ไหนมีในระบบ (ข้อความ error ของ otp/request เหมือนกันหมด)
- [ ] Log การเข้าถึงข้อมูลสุขภาพ (PDPA audit trail) — ใคร/เมื่อไหร่/ดู field ไหน
- [ ] TLS เท่านั้น (frontend บังคับ HTTPS ยกเว้น localhost)
- [ ] SMS gateway: งบรายเดือน + วางแผนส่ง OTP เฉพาะสมัคร/เครื่องใหม่/ลืม PIN (ใช้ประจำใช้ PIN)

---

## 6. PDPA (phase ถัดไป — ยังไม่ต้องทำตอนนี้)

| method | path | ใช้ทำ |
|---|---|---|
| `POST` | `/api/patient/consent/withdraw/` | ถอนความยินยอม (set `PdpaConsent.withdrawn_at`) |
| `GET` | `/api/patient/data-export/` | ดาวน์โหลดข้อมูลตัวเองทั้งหมด (JSON) |
| `POST` | `/api/patient/data-erasure/` | ยื่นคำขอลบข้อมูล (เข้าคิวให้เจ้าหน้าที่อนุมัติ) |

---

## 7. สรุป endpoint

### ต้องทำใหม่ (auth model เบอร์ + อีเมล + OTP)

| method | path | auth | หมายเหตุ |
|---|---|---|---|
| POST | `/api/patient/auth/signup/start/` | ไม่ | รับ phone + email (บังคับทั้งคู่), สร้างบัญชี PENDING, คืน signup token |
| POST | `/api/patient/auth/otp/request/` | ตาม purpose | ส่ง OTP ทาง `channel` (phone/email), ตอบ ok เสมอ, rate-limit |
| POST | `/api/patient/auth/otp/verify/` | ตาม purpose | `SIGNUP_VERIFY` mark ช่องทาง / `LOGIN` คืน token+flags / `CONTACT_CHANGE` สลับค่า |
| POST | `/api/patient/token/refresh/` | full | ต่ออายุ token |
| POST | `/api/patient/pin/change/` | full | เปลี่ยน PIN ที่รู้ PIN เดิม (current_pin + new_pin) |
| POST | `/api/patient/contact/change/request/` | full | ขอเปลี่ยนเบอร์/อีเมล → OTP ไปค่าใหม่ + แจ้งค่าเดิม |
| POST | `/api/patient/contact/change/confirm/` | full | ยืนยัน OTP → สลับ `pending_*` เป็นค่าจริง |
| POST | `/api/patient/profile/` | full | สร้างประวัติผู้ป่วยครั้งแรก |
| POST | `/api/patient/queue/` | full | จองคิววันนี้ (แยกจากสร้างประวัติ) |

### ของเดิมที่ต้องต่อ DB จริง (ตอนนี้เป็น mock)

| method | path | auth | ต้องแก้ |
|---|---|---|---|
| POST | `/api/patient/pin/setup/` | pre/full | persist hash + คืน full token + authoritative |
| POST | `/api/patient/pin/verify/` | ไม่ | รับ `phone`, lockout ที่ server, ส่ง `attempts_left`/`locked_until` |
| POST | `/api/patient/pin/reset/request/` | ไม่ | ส่ง OTP จริง (หรือรวมกับ `auth/otp/request/`) |
| POST | `/api/patient/pin/reset/confirm/` | ไม่ | verify OTP จริง + เขียน PIN ใหม่ |
| GET | `/api/patient/queue/` | full | ต่อ DB + `eta_minutes` + 404 เมื่อไม่มีคิว |
| POST | `/api/patient/queue/cancel/` | full | soft-delete จริง |
| GET | `/api/patient/me/` | full | ต่อ DB จริง + `has_profile` |
| PATCH | `/api/patient/me/` | full | เขียน DB จริง (mock แค่ echo) |

### DEPRECATED (เลิกใช้หลังสลับ auth model ครบ)

| method | path | แทนด้วย |
|---|---|---|
| POST | `/api/patient/login/` (national_id) | `auth/otp/request/` + `auth/otp/verify/` (`LOGIN`) |
| POST | `/api/patient/register/` (patient+queue รวม) | `auth/signup/start` → verify phone + email → `pin/setup` → `POST /profile/` → `POST /queue/` |

---

## 8. Migration / ลำดับ cutover

1. Backend ทำข้อ 4.1–4.4 ทั้งของใหม่และ DB จริงของเดิม (ของเดิมยังทำงานคู่กันได้)
2. Frontend สลับหน้า auth: `phone_auth` → `otp` → `pin_setup`/`pin_unlock` → `profile_gate` → `status`
3. Frontend ย้าย `pin/verify`, `pin/reset/*` ไปใช้ `phone` แทน `national_id`
4. Frontend key PIN ใน localStorage ด้วย account id/phone แทน national_id (ผู้ใช้เดิมโดน re-PIN ครั้งเดียว)
5. เมื่อ traffic ผ่าน model ใหม่หมด → ลบ `login/` (national_id) และ `register/` (รวม)
