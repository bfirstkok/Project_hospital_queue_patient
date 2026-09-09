# Backend Handoff — Email / SMS OTP สำหรับกู้คืนรหัส PIN

เอกสารนี้ส่งให้ทีม backend (`Project_hospital_queue`, Django) เพื่อ implement การกู้คืนรหัส PIN
ผ่าน OTP ทางอีเมล (และเบอร์โทร). อ่านจบไฟล์เดียวพอ — ภาพรวม auth ทั้งหมดอยู่ใน
`docs/BACKEND_API_SPEC.md` (อ้างอิงเพิ่มเติมได้ แต่ไม่จำเป็นสำหรับงานนี้).

---

## 1. เป้าหมาย

ผู้ป่วยลืมรหัส PIN 6 หลัก → **ขอ OTP ไปที่อีเมล/เบอร์ที่ลงทะเบียนไว้** → กรอก OTP →
ตั้งรหัส PIN ใหม่ → กลับเข้าใช้งานได้

---

## 2. บริบท — สิ่งที่ frontend ทำอยู่แล้ว (ห้ามเปลี่ยน contract)

- Patient portal = Next.js (repo `Project_hospital_queue_patient`), เรียก REST ตรงไปที่
  `PATIENT_API_BASE_URL` ไม่มี proxy
- **ตอนนี้ PIN เก็บใน `localStorage` ฝั่ง client** (hash เอง) — เป็นของชั่วคราว งานนี้จะย้ายมา server
- frontend เรียก 2 endpoint นี้อยู่แล้ว (ปัจจุบัน backend ตอบ 404 → frontend fallback ไป
  ยืนยันตัวตนด้วย `POST /api/patient/login/` แทน) :
  - `POST /api/patient/pin/reset/request/`
  - `POST /api/patient/pin/reset/confirm/`
- frontend มี **auto-fallback** อยู่แล้ว → ถ้า endpoint ยังไม่เสร็จ / ตอบ 404 ระบบไม่พัง
  จะ degrade ไปใช้ national_id re-login. พอ endpoint ตอบ 2xx จริง flow OTP จะทำงานเองทันที
  โดยไม่ต้องแก้ frontend

### Response envelope (ใช้กับทุก endpoint)

| กรณี | body |
|---|---|
| สำเร็จ | `{ "ok": true, ...data }` |
| ล้มเหลว | `{ "ok": false, "error": "<ข้อความไทย แสดงให้ผู้ป่วยเห็นตรง ๆ>" }` |

ต้องส่ง envelope นี้แม้ HTTP status เป็น 4xx/5xx (frontend parse หา key `ok` เสมอ ไม่งั้นขึ้น
"เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง").

### CORS

เพิ่ม origin ของ portal (dev: `http://127.0.0.1:5500`, prod: โดเมนจริง) ใน `CORS_ALLOWED_ORIGINS`
และตอบ preflight `OPTIONS` สำหรับ path ใหม่พร้อม header:
`Access-Control-Allow-Headers: Content-Type, Authorization`

---

## 3. Prerequisite — ย้าย PIN มาเก็บที่ server

การ reset PIN ต้องมี "ที่เขียน hash ใหม่" → PIN ต้องอยู่ที่ server. ทำ 3 endpoint นี้ควบคู่:

### 3.1 `POST /api/patient/pin/setup/`  (auth required)
```json
{ "pin": "445566" }
```
- hash ด้วย `django.contrib.auth.hashers.make_password` (PBKDF2 มากับ Django) หรือ argon2
- เก็บใน `PatientPin.pin_hash`, reset `failed_attempts` / `locked_until` / `lockout_level`
- ตอบ `{ "ok": true, "access_token": "<token>", "message": "ตั้งรหัส PIN สำเร็จ" }`

### 3.2 `POST /api/patient/pin/verify/`  (ไม่ต้อง auth)
```json
{ "national_id": "1101700230708", "pin": "445566" }
```
- `locked_until` > now → `423 { "ok": false, "error": "ถูกระงับชั่วคราว", "locked_until": "<ISO>" }`
- PIN ถูก → reset counters, `{ "ok": true, "access_token": "<token>" }`
- PIN ผิด → `failed_attempts += 1`; ครบ 3 → ตั้ง `locked_until = now + tier`, `lockout_level += 1`
  โดย tier = `[60s, 300s, 1800s]` (tier สุดท้ายวนซ้ำ)
  ตอบ `401 { "ok": false, "error": "รหัส PIN ไม่ถูกต้อง", "attempts_left": 2 }`

### 3.3 `POST /api/patient/pin/change/`  (auth, ทำทีหลังได้)
```json
{ "current_pin": "445566", "new_pin": "778899" }
```

---

## 4. Data models

### `PatientPin`  (OneToOne → patient / account)
| field | type | หมายเหตุ |
|---|---|---|
| `patient` | FK/OneToOne | |
| `pin_hash` | char | `make_password` / argon2 — **ห้ามเก็บ PIN ดิบ / SHA เปล่า** |
| `failed_attempts` | int, default 0 | |
| `locked_until` | datetime, null | |
| `lockout_level` | int, default 0 | tier สำหรับ escalating lockout |
| `updated_at` | datetime | |

### `OtpChallenge`
| field | type | หมายเหตุ |
|---|---|---|
| `id` | pk | |
| `national_id` | char, indexed | ผูกกับผู้ป่วยตอน verify (ไม่ต้อง FK ก็ได้) |
| `channel` | char | `"email"` \| `"phone"` |
| `purpose` | char | `"PIN_RESET"` (เผื่ออนาคต: `"LOGIN"`, `"CONTACT_CHANGE"`) |
| `code_hash` | char | **hash ของ OTP** (เช่น `make_password` หรือ sha256+salt) — ห้ามเก็บโค้ดดิบ |
| `expires_at` | datetime | `created_at + 5 นาที` |
| `consumed_at` | datetime, null | ใช้แล้วเซ็ต — single use |
| `attempts` | int, default 0 | นับครั้งกรอกผิด, เกิน 5 → โมฆะ |
| `created_at` | datetime | |

index: (`national_id`, `channel`, `purpose`, `created_at`)

---

## 5. Endpoints ที่ต้องทำ (งานหลักของเอกสารนี้)

### 5.1 `POST /api/patient/pin/reset/request/`  — ขอ OTP
ไม่ต้อง auth.

**Request** (frontend ส่งมาแบบนี้):
```json
{ "national_id": "1101700230708", "channel": "email", "target": "patient@example.com" }
```
- `channel`: `"email"` \| `"phone"`
- `target`: frontend ส่งค่าที่ cache ไว้มาด้วย — **backend ไม่ต้องเชื่อ / ไม่ต้อง match**
  ให้ backend **lookup อีเมล/เบอร์ของผู้ป่วยจาก DB ด้วย `national_id` เอง** แล้วส่งไปที่ค่าใน DB
  (วิธีนี้เลี่ยงปัญหาเบอร์เก็บเป็น `+66` ไม่ตรงกับที่ผู้ใช้พิมพ์ — ดูข้อ 8)

**Logic:**
1. หา patient จาก `national_id`
   - ไม่พบ **หรือ** พบแต่ไม่มีอีเมล/เบอร์ในช่องทางที่ขอ → **ยังตอบ `{ "ok": true }`**
     (กัน enumeration — ห้ามบอกว่าเลขบัตรไหนมี/ไม่มีในระบบ)
2. gen OTP 6 หลักสุ่ม (`secrets.randbelow`), เก็บ **hash** ลง `OtpChallenge`, `expires_at = now + 5min`
3. ยกเลิก challenge เก่าที่ยังไม่ consume ของ (national_id, channel, PIN_RESET) — ให้เหลือ active อันเดียว
4. ส่งจริง: `channel == "email"` → ส่งอีเมล (ข้อ 6); `channel == "phone"` → ส่ง SMS (ข้อ 7)
5. **Rate limit**: ≤ 3 ครั้ง / 15 นาที ต่อ `national_id` และต่อ IP
   - เกิน → `429 { "ok": false, "error": "ขอรหัสถี่เกินไป กรุณารอสักครู่" }`

**Response** สำเร็จ:
```json
{ "ok": true, "resend_after_seconds": 60 }
```
(`resend_after_seconds` ให้ frontend ตั้ง cooldown ปุ่ม "ส่งใหม่")

---

### 5.2 `POST /api/patient/pin/reset/confirm/`  — ยืนยัน OTP + ตั้ง PIN ใหม่
ไม่ต้อง auth.

**Request:**
```json
{ "national_id": "1101700230708", "otp": "123456", "pin": "778899" }
```

**Logic:**
1. หา `OtpChallenge` ล่าสุดของ (national_id, purpose=PIN_RESET) ที่ `consumed_at IS NULL`
2. ตรวจ:
   - หมดอายุ (`now > expires_at`) → `400 { "ok": false, "error": "รหัส OTP หมดอายุ กรุณาขอใหม่" }`
   - `attempts >= 5` → `400 { "ok": false, "error": "กรอกรหัส OTP ผิดเกินกำหนด กรุณาขอใหม่" }`
   - hash ไม่ตรง → `attempts += 1`, `400 { "ok": false, "error": "รหัส OTP ไม่ถูกต้อง" }`
3. `pin` ต้องเป็นตัวเลข 6 หลัก → ไม่ใช่ → `400 { "ok": false, "error": "รหัส PIN ต้องเป็นตัวเลข 6 หลัก" }`
4. ผ่านทั้งหมด:
   - `OtpChallenge.consumed_at = now`
   - เขียน `PatientPin.pin_hash` ใหม่ (hash `pin`), reset `failed_attempts` / `locked_until` / `lockout_level`
   - ออก `access_token` ใหม่ให้ผู้ป่วยคนนั้น
5. **Response:**
```json
{ "ok": true, "access_token": "<token>", "message": "ตั้งรหัส PIN ใหม่สำเร็จ" }
```
6. แนะนำ: ส่งอีเมล/SMS แจ้งเตือนว่ามีการเปลี่ยน PIN (ไม่ใช่ OTP)

---

### 5.3 `GET /api/patient/me/`  — ต้องเพิ่ม `email` (และ `phone` ให้สม่ำเสมอ)
frontend ต้องรู้ว่าจะส่ง OTP ไปช่องทางไหน เพื่อโชว์ให้ผู้ป่วยเห็น (แบบ mask เช่น `pa••••@example.com`)

`profile` object ต้องมี:
```json
{
  "phone": "0812345678",
  "email": "patient@example.com"
}
```
- ถ้าไม่มีอีเมล → ส่ง `"email": null`
- ดูเรื่อง format เบอร์ในข้อ 8

---

## 6. การส่งอีเมล

- ใช้ Django `django.core.mail.send_mail` + SMTP (ตั้งใน settings ผ่าน env — ข้อ 9)
- Provider ที่ใช้ได้ฟรี/ถูก: Gmail SMTP (app password), SendGrid, Mailgun, Brevo
- เนื้อหา (ภาษาไทย):
  ```
  Subject: รหัสยืนยัน (OTP) สำหรับตั้งรหัส PIN ใหม่ - โรงพยาบาล
  Body:
  รหัสยืนยันของคุณคือ  123456
  รหัสนี้ใช้ได้ภายใน 5 นาที และใช้ได้ครั้งเดียว
  หากคุณไม่ได้เป็นผู้ขอ กรุณาละเว้นอีเมลฉบับนี้
  ```
- ส่งแบบ async ถ้าทำได้ (Celery / `django-q`) แต่ sync ก็พอสำหรับปริมาณนี้
- **อย่า log OTP ดิบลง production log**

---

## 7. การส่ง SMS (ทำทีหลังได้ — optional)

- โครง endpoint เดียวกัน แค่ `channel: "phone"` → ส่ง SMS แทน
- Gateway ไทย: ThaiBulkSMS, SMS Master, Twilio, หรือ gateway ที่ รพ. มีอยู่
- มีค่าใช้จ่ายต่อข้อความ → rate-limit เข้มกว่า email
- ระหว่างที่ยังไม่ต่อ gateway จริง: ให้ `channel: "phone"` ตอบ
  `{ "ok": false, "error": "ยังไม่เปิดให้บริการรับรหัสทาง SMS กรุณาใช้อีเมล" }`
  (frontend จะสลับไปช่องอีเมลให้เอง)

---

## 8. เรื่องเบอร์โทรเก็บเป็น `+66`

- Thai mobile: `0812345678` (local) = `+66812345678` (E.164) = เบอร์เดียวกัน
- **ให้ backend เก็บ canonical form เดียว** — แนะนำ E.164 `+66xxxxxxxxx` หรือ local `0xxxxxxxxx`
  เลือกอันไหนก็ได้ แต่ **ต้องเหมือนกันทุกที่** (ตอน register, ตอนคืนใน `/me`, ตอนส่ง SMS)
- ตอน register ถ้าได้ `0…` เข้ามา → normalize ก่อนเก็บ; ถ้าได้ `+66…` → เก็บตามนั้น
- **สำหรับ OTP**: frontend ไม่ต้องส่งเบอร์ที่ตรงกับ DB — backend lookup จาก `national_id` เอง
  (ข้อ 5.1) → ปัญหา `+66` ไม่กระทบ flow OTP
- ฝั่ง frontend จะ normalize เป็น `0…` ตอนแสดงผลอยู่แล้ว ขอแค่ `/me` คืนค่าที่ parse ได้
  (มี `+66` หรือ `0` นำหน้าก็ได้ ขอให้เป็นเบอร์เดียวสม่ำเสมอ)

---

## 9. Config / env ที่ต้องเพิ่ม

```
EMAIL_BACKEND / EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD / EMAIL_USE_TLS
DEFAULT_FROM_EMAIL                 # เช่น "โรงพยาบาล <noreply@hospital.example>"
OTP_TTL_SECONDS = 300
OTP_MAX_ATTEMPTS = 5
OTP_REQUEST_RATE = "3/15m"         # ต่อ national_id + ต่อ IP
PIN_LOCKOUT_TIERS = [60, 300, 1800]
# (SMS ทีหลัง) SMS_PROVIDER / SMS_API_KEY / SMS_SENDER
```

---

## 10. Security checklist

- [ ] OTP: 6 หลักสุ่มด้วย `secrets`, เก็บเป็น hash, TTL 5 นาที, single-use, `attempts < 5`
- [ ] `pin/reset/request/` ตอบ `{ "ok": true }` เสมอ แม้ national_id/อีเมลไม่มีในระบบ (กัน enumeration)
- [ ] Rate limit `pin/reset/request/`, `pin/verify/` ต่อ national_id + ต่อ IP (`django-ratelimit` / DRF throttle)
- [ ] PIN hash = PBKDF2 (Django default) หรือ argon2 — ไม่เก็บ PIN ดิบ / SHA เปล่า
- [ ] escalating lockout ที่ server (`failed_attempts`, `locked_until`, `lockout_level`)
- [ ] ไม่ log OTP ดิบ / PIN ดิบ
- [ ] TLS เท่านั้น
- [ ] CORS allow เฉพาะ origin ของ portal
- [ ] แจ้งเตือนเจ้าของบัญชี (email/SMS) เมื่อมีการ reset PIN สำเร็จ
- [ ] audit log: ใครขอ/ยืนยัน OTP เมื่อไหร่ (PDPA)

---

## 11. Test checklist

- [ ] ขอ OTP → ได้อีเมลจริง, โค้ด 6 หลัก
- [ ] confirm ด้วยโค้ดถูก → PIN เปลี่ยน, ได้ token, login ด้วย PIN ใหม่ได้
- [ ] โค้ดผิด 5 ครั้ง → challenge โมฆะ ต้องขอใหม่
- [ ] โค้ดหมดอายุ (>5 นาที) → ปฏิเสธ
- [ ] ใช้โค้ดซ้ำ (consumed) → ปฏิเสธ
- [ ] ขอ OTP 4 ครั้งใน 15 นาที → ครั้งที่ 4 ได้ `429`
- [ ] national_id ที่ไม่มีในระบบ → ยังได้ `{ "ok": true }` (ไม่ leak)
- [ ] national_id ไม่มีอีเมล → `{ "ok": true }` แต่ไม่มีอีเมลส่งออก
- [ ] `channel: "phone"` ก่อนต่อ SMS gateway → ตอบ error ที่กำหนดในข้อ 7

---

## 12. จุดเชื่อมในโค้ด (`Project_hospital_queue`, Django)

- Patient API เดิม (`/api/patient/register|login|me|queue/`) อยู่ app ไหน → เพิ่ม endpoint PIN/OTP
  ใน app เดียวกัน หรือสร้าง app `pinauth` แล้ว include ใน `config/urls.py`
- `PatientPin` / `OtpChallenge` → migration ใหม่
- ผูก `national_id` → patient ด้วย query เดียวกับที่ `POST /api/patient/login/` ใช้อยู่
- reuse กลไกออก `access_token` เดิม (ที่ `register/` / `login/` ใช้)

---

## 13. ลำดับที่แนะนำ

1. `PatientPin` model + `pin/setup` + `pin/verify` (ข้อ 3–4)
2. `OtpChallenge` model + `pin/reset/request` + `pin/reset/confirm` — **email เท่านั้น** (ข้อ 5–6)
3. เพิ่ม `email` ใน `GET /me/` (ข้อ 5.3)
4. Rate limit + audit + แจ้งเตือน (ข้อ 10)
5. SMS (ข้อ 7) — เมื่อพร้อม gateway

frontend ไม่ต้องแก้อะไรเพิ่ม — พอ endpoint ตอบ 2xx จริง flow OTP จะเปิดใช้เอง
