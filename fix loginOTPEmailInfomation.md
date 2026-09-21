# Backend API & Schema Specification: Patient Portal & Queue System
**Target:** Django REST Framework (`Project_hospital_queue`)  
**Frontend Client:** Next.js 16 (`Project_hospital_queue_patient` / `https://hospital.bfirstkok.me`)  
**Format:** Pure Technical Specification (Zero Fluff / LLM-Optimized)

---

## 1. Global Response Envelope
Frontend ตรวจสอบคีย์ `ok` เสมอ Backend ต้องส่ง JSON โครงสร้างนี้ในทุกกรณี (รวม 4xx, 5xx ห้ามส่ง HTML):

```json
// Success (200, 201)
{
  "ok": true,
  "message": "ข้อความภาษาไทย (ถ้ามี)",
  "...": "payload fields"
}

// Error (400, 401, 403, 404, 409, 423, 500)
{
  "ok": false,
  "error": "ข้อความอธิบายภาษาไทยสำหรับแสดงผล",
  "errors": { "field_name": ["รายละเอียดข้อผิดพลาด"] }
}
```

---

## 2. Database Schemas

### 2.1 `patient_accounts` (หรือ `users`)
| Column | Type | Constraints | Description / Rule |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT / UUID | PK, AUTO_INCREMENT | Account ID |
| `username` | VARCHAR(50) | UNIQUE, NULLABLE | ชื่อผู้ใช้สำหรับ Login |
| `email` | VARCHAR(191) | UNIQUE, NOT NULL, INDEX | อีเมล (Login, Reset, Google Link) |
| `phone` | VARCHAR(20) | NOT NULL | เบอร์แสดงผล (เช่น 081-234-5678) |
| `phone_normalized` | VARCHAR(20) | INDEX, NOT NULL | E.164 (เช่น +66812345678) ใช้ Rate Limit |
| `password_hash` | VARCHAR(255) | NULLABLE | Hash (Argon2id/bcrypt). **NULL ถ้าสมัครผ่าน Google** |
| `token_version` | INT | DEFAULT 1, NOT NULL | เพิ่มค่าเมื่อเปลี่ยนรหัสผ่านเพื่อเตะ Token เก่าทุกอุปกรณ์ |
| `google_id` | VARCHAR(100) | UNIQUE, NULLABLE, INDEX | Google `sub` ID |
| `national_id` | VARCHAR(13) | UNIQUE, NOT NULL, INDEX | เลขบัตร ปชช. 13 หลัก (**ห้ามแก้ไขหลังสร้าง**) |
| `hn` | VARCHAR(50) | UNIQUE, NULLABLE, INDEX | รหัสโรงพยาบาล (**ห้ามแก้ไขหลังสร้าง**) |
| `first_name` | VARCHAR(100) | NOT NULL | ชื่อ |
| `last_name` | VARCHAR(100) | NOT NULL | นามสกุล |
| `gender` | VARCHAR(10) | NOT NULL | `M`, `F`, `O`, `UNKNOWN` |
| `birth_date` | DATE | NULLABLE | วันเกิด |
| `blood_type` | VARCHAR(10) | NULLABLE | `A`, `B`, `AB`, `O`, `UNKNOWN` |
| `height_cm` | DECIMAL(5,2) | NULLABLE | ส่วนสูง (ซม.) |
| `weight_kg` | DECIMAL(5,2) | NULLABLE | น้ำหนัก (กก.) |
| `address` | TEXT | NULLABLE | ที่อยู่ |
| `province` / `district` / `subdistrict` / `postal_code` | VARCHAR | NULLABLE | ข้อมูลที่อยู่ |
| `chronic_diseases` / `allergies` / `medications` | TEXT | NULLABLE | ประวัติสุขภาพ |
| `emergency_contacts` | JSON | NULLABLE | Array of `{ id, name, relationship, phone }` |
| `is_active` | BOOLEAN | DEFAULT TRUE | สถานะบัญชี |
| `email_verified` | BOOLEAN | DEFAULT FALSE | ยืนยันอีเมลแล้ว |
| `created_at` / `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | วันเวลา |

> **Security Rule:** หาก `password_hash IS NULL` (ผู้ใช้ Google OAuth) **ห้าม** ให้ล็อกอินผ่านช่องทาง Password ปกติ

### 2.2 `patient_pins` (Cloud-First PIN)
| Column | Type | Constraints | Description / Rule |
| :--- | :--- | :--- | :--- |
| `patient_id` | BIGINT / UUID | PK, FK -> `patient_accounts.id` ON DELETE CASCADE | รหัสผู้ป่วย |
| `pin_hash` | VARCHAR(255) | NOT NULL | PIN 6 หลัก Hash ด้วย Argon2id / PBKDF2 |
| `is_enabled` | BOOLEAN | DEFAULT TRUE | สถานะเปิดใช้ PIN |
| `failed_attempts` | INT | DEFAULT 0 | จำนวนครั้งที่กรอกผิดสะสม |
| `locked_until` | TIMESTAMP | NULLABLE | เวลาสิ้นสุดการระงับชั่วคราว |
| `lockout_level` | INT | DEFAULT 0 | ระดับการ Lock: 0=60s, 1=300s (5m), 2+=1800s (30m) |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | วันเวลา |

### 2.3 `password_resets_otp`
| Column | Type | Constraints | Description / Rule |
| :--- | :--- | :--- | :--- |
| `id` | BIGINT / UUID | PK | Record ID |
| `patient_id` | BIGINT / UUID | FK -> `patient_accounts.id` ON DELETE CASCADE | รหัสผู้ป่วย |
| `purpose` | VARCHAR(20) | NOT NULL | `'password'` หรือ `'pin'` |
| `otp_code_hash` | VARCHAR(255) | NOT NULL | Salted Hash ของ OTP 6 หลัก |
| `channel` | VARCHAR(10) | NOT NULL | `'email'` หรือ `'sms'` |
| `target` | VARCHAR(191) | NOT NULL | อีเมลหรือเบอร์โทรศัพท์ที่ส่ง |
| `reset_token_hash` | VARCHAR(64) | UNIQUE, NULLABLE, INDEX | SHA-256 Hash ของ reset_token |
| `attempts` | INT | DEFAULT 0 | ครั้งที่กรอกผิด (สูงสุด 5 ครั้ง) |
| `expires_at` | TIMESTAMP | NOT NULL | เวลาหมดอายุ OTP (5 นาที) |
| `reset_token_expires_at` | TIMESTAMP | NULLABLE | เวลาหมดอายุ Reset Token (15 นาที) |
| `is_used` | BOOLEAN | DEFAULT FALSE | ถูกใช้งานแล้วหรือไม่ |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | วันเวลา |

---

## 3. REST API Specifications

### 3.1 Authentication

#### 1) `POST /api/patient/register/` (ลงทะเบียน + ออกบัตรคิว)
- **Auth:** Public
- **Bot Guard:** ฟิลด์ `website` หากมีค่า (Honeypot) ให้ reject ทันที
- **Queue Guard:** ตรวจสอบ `national_id` หากมีคิว Active ในวันนั้นอยู่แล้ว ให้คืนคิวเดิม หรือตอบ 409 Conflict
- **Request Body:**
```json
{
  "username": "somchai99",
  "password": "SecurePassword@2026",
  "email": "somchai@example.com",
  "phone": "0812345678",
  "national_id": "1234567890123",
  "first_name": "สมชาย",
  "last_name": "ใจดี",
  "gender": "M",
  "birth_date": "1990-05-15",
  "age": 36,
  "blood_type": "O",
  "height_cm": 175.0,
  "weight_kg": 70.0,
  "chronic_diseases": "ไม่มี",
  "allergies": "ไม่มี",
  "medications": "ไม่มี",
  "note": "อาการเบื้องต้น",
  "province": "กรุงเทพมหานคร",
  "district": "เขตจตุจักร",
  "subdistrict": "แขวงลาดยาว",
  "postal_code": "10900",
  "emergency_name": "สมศรี ใจดี",
  "emergency_relationship": "SPOUSE",
  "emergency_phone": "0898765432",
  "emergency_contacts": [{ "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "0898765432" }],
  "consent": true,
  "website": null
}
```
- **Response 201/200:**
```json
{
  "ok": true,
  "access_token": "<JWT_TOKEN>",
  "token_type": "Bearer",
  "patient_id": "usr_987654",
  "hn": "HN-67001",
  "queue_number": "A015",
  "status_label": "รอตรวจ",
  "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
  "queue_position": 4,
  "room": "ห้องตรวจ 2",
  "updated_at": "2026-09-20T08:30:00Z",
  "message": "ลงทะเบียนและรับบัตรคิวสำเร็จ"
}
```

#### 2) `POST /api/patient/login/` (เข้าสู่ระบบด้วยรหัสผ่าน)
- **Auth:** Public
- **Request Body:**
```json
{
  "identifier": "somchai99", // username, email หรือ national_id
  "password": "SecurePassword@2026"
}
```
*(Backend ควรรับทั้งคีย์ `identifier` หรือ `national_id` และหาก Client ส่งเฉพาะ `{ "national_id": "..." }` โดยไม่มี password ให้รองรับเป็น Legacy/Fallback verification)*
- **Response 200:**
```json
{
  "ok": true,
  "access_token": "<JWT_TOKEN>",
  "token_type": "Bearer",
  "expires_in": 86400,
  "profile": {
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "national_id": "1234567890123",
    "hn": "HN-67001"
  },
  "message": "เข้าสู่ระบบสำเร็จ"
}
```
- **Response 401:**
```json
{ "ok": false, "error": "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" }
```

#### 3) `POST /api/patient/auth/google/` (Google Sign-In & Smart Linking)
- **Auth:** Public
- **Request Body:** `{ "credential": "<GOOGLE_ID_TOKEN>" }`
- **Backend Matching Logic:**
  1. Verify Google ID Token -> ดึง `sub`, `email`, `name` (ต้อง `email_verified == true`)
  2. **Match 1 (Google ID):** ค้นหา `google_id == sub` -> พบ: ออก `access_token` (200 OK)
  3. **Match 2 (Auto Link Email):** ค้นหา `email == token.email` -> พบ: อัปเดต `google_id = sub, email_verified = TRUE` แล้วออก `access_token` (200 OK - ได้ HN/คิวเดิม)
  4. **Match 3 (New User):** ไม่พบข้อมูล -> ตอบ 200 ขอข้อมูลเชื่อมบัตรประชาชน:
```json
{
  "ok": true,
  "is_new_user": true,
  "temp_token": "temp_link_token_xyz",
  "suggested_profile": { "email": "somchai@gmail.com", "first_name": "สมชาย", "last_name": "ใจดี" }
}
```

---

### 3.2 Profile Management

#### 4) `GET /api/patient/me/` (ดูข้อมูลโปรไฟล์และคิวปัจจุบัน)
- **Auth:** `Bearer <access_token>`
- **Response 200:**
```json
{
  "ok": true,
  "profile": {
    "username": "somchai99",
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "national_id": "1234567890123",
    "hn": "HN-67001",
    "phone": "081-234-5678",
    "email": "somchai@example.com",
    "gender": "M",
    "birth_date": "1990-05-15",
    "age": 36,
    "blood_type": "O",
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "address": "123/45 ถนนพหลโยธิน",
    "province": "กรุงเทพมหานคร",
    "district": "เขตจตุจักร",
    "subdistrict": "แขวงลาดยาว",
    "postal_code": "10900",
    "chronic_diseases": "ไม่มี",
    "allergies": "ไม่มี",
    "medications": "ไม่มี",
    "emergency_contacts": [{ "id": "em_1", "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "089-876-5432" }]
  },
  "active_queue": {
    "queue_number": "A012",
    "status_label": "รอตรวจ",
    "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
    "queue_position": 3,
    "room": "ห้องตรวจ 2",
    "updated_at": "2026-09-20T09:30:00Z"
  },
  "visits": [],
  "appointments": []
}
```

#### 5) `PATCH /api/patient/me/` (แก้ไขข้อมูลส่วนตัว)
- **Auth:** `Bearer <access_token>`
- **Guard:** **ห้ามอัปเดต `national_id` และ `hn` เด็ดขาด** (เพิกเฉยหรือปฏิเสธ)
- **Request Body (Partial Update):**
```json
{
  "phone": "089-999-8888",
  "email": "somchai.new@example.com",
  "blood_type": "O",
  "height_cm": 176.0,
  "weight_kg": 72.5,
  "chronic_diseases": "ความดันโลหิตสูง",
  "allergies": "แพ้เพนิซิลลิน",
  "medications": "ยาลดความดัน",
  "address": "99/1 ถนนวิภาวดีรังสิต",
  "province": "กรุงเทพมหานคร",
  "district": "เขตจตุจักร",
  "subdistrict": "แขวงลาดยาว",
  "postal_code": "10900",
  "emergency_contacts": [{ "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "089-876-5432" }]
}
```
- **Response 200:** `{ "ok": true, "message": "บันทึกข้อมูลเรียบร้อยแล้ว", "profile": { ... } }`

---

### 3.3 Queue Management

#### 6) `GET /api/patient/queue/` (ตรวจสถานะคิว - Frontend Polling ทุก 10s)
- **Auth:** `Bearer <access_token>`
- **Response 200 (มีคิว):**
```json
{
  "ok": true,
  "queue_number": "A012",
  "status_label": "รอตรวจ",
  "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
  "queue_position": 3,
  "room": "ห้องตรวจ 2",
  "updated_at": "2026-09-20T09:35:00Z"
}
```
- **Response 200 (ไม่มีคิว):**
```json
{ "ok": true, "queue_number": null, "message": "ไม่มีคิวที่กำลังรอรับบริการในวันนี้" }
```

#### 7) `POST /api/patient/queue/cancel/` (ยกเลิกคิว)
- **Auth:** `Bearer <access_token>`
- **Logic:** ปรับสถานะคิวเป็น `CANCELLED` และคืนทรัพยากร
- **Response 200:** `{ "ok": true, "message": "ยกเลิกคิวเรียบร้อยแล้ว" }`

---

### 3.4 Cloud PIN System

#### 8) `POST /api/patient/pin/setup/` (ตั้ง PIN 6 หลัก)
- **Auth:** `Bearer <access_token>`
- **Request Body:** `{ "pin": "445566" }` (ต้องเป็น `^\d{6}$`)
- **Logic:** Hash ด้วย Argon2id/PBKDF2 บันทึกลง `patient_pins` รีเซ็ต `failed_attempts=0, locked_until=null, lockout_level=0`
- **Response 200:** `{ "ok": true, "message": "ตั้งรหัส PIN สำเร็จ", "access_token": "<NEW_TOKEN>" }`

#### 9) `POST /api/patient/pin/verify/` (ปลดล็อกด้วย PIN)
- **Auth:** Public
- **Request Body:** `{ "national_id": "1234567890123", "pin": "445566" }`
- **Lockout Logic:**
  1. หาก `locked_until > NOW()` -> ตอบ **423 Locked**:
     ```json
     { "ok": false, "error": "ระบบระงับการกรอก PIN ชั่วคราว", "locked_until": "2026-09-20T10:05:00Z" }
     ```
  2. หากยังไม่ตั้ง PIN -> ตอบ **404 Not Found**: `{ "ok": false, "error": "ยังไม่ได้ตั้งรหัส PIN" }`
  3. ตรวจสอบ PIN:
     - **ถูกต้อง:** รีเซ็ต `failed_attempts=0, lockout_level=0, locked_until=null` -> ตอบ **200 OK**:
       ```json
       { "ok": true, "access_token": "<NEW_TOKEN>", "message": "ปลดล็อก PIN สำเร็จ" }
       ```
     - **ไม่ถูกต้อง:** `failed_attempts += 1`
       - ถ้า `failed_attempts < 3` -> ตอบ **401 Unauthorized**:
         ```json
         { "ok": false, "error": "รหัส PIN ไม่ถูกต้อง", "attempts_left": 2 }
         ```
       - ถ้า `failed_attempts >= 3` -> คำนวณ Lockout:
         - Tier 0: 60 วินาที
         - Tier 1: 300 วินาที (5 นาที)
         - Tier 2+: 1800 วินาที (30 นาที)
         บันทึก `locked_until = NOW() + Tier`, `lockout_level += 1`, `failed_attempts = 0` -> ตอบ **423 Locked**

#### 10) `POST /api/patient/pin/change/` (เปลี่ยน PIN เดิม)
- **Auth:** `Bearer <access_token>`
- **Request Body:** `{ "current_pin": "445566", "new_pin": "778899" }`
- **Logic:** ตรวจ Lockout -> ตรวจ `current_pin` (หากผิดใช้อัตรา Lockout เดียวกับ Verify) -> บันทึก `new_pin` รีเซ็ต Lockout
- **Response 200:** `{ "ok": true, "message": "เปลี่ยนรหัส PIN สำเร็จ" }`

#### 11) `POST /api/patient/pin/reset/request/` (ขอ OTP รีเซ็ต PIN)
- **Auth:** Public
- **Request Body:**
```json
{
  "national_id": "1234567890123",
  "channel": "email", // หรือ "phone" / "sms"
  "target": "so••••••@example.com" // (Optional: ถ้าไม่ส่งมาให้ค้นหาจาก national_id ในระบบ)
}
```
- **Response 200:**
```json
{
  "ok": true,
  "message": "ส่งรหัส OTP เรียบร้อยแล้ว",
  "cooldown_seconds": 60,
  "expires_in_seconds": 300,
  "masked_target": "so••••••@example.com"
}
```

#### 12) `POST /api/patient/pin/reset/confirm/` (ยืนยัน OTP ตั้ง PIN ใหม่)
- **Auth:** Public
- **Request Body:**
```json
{
  "national_id": "1234567890123",
  "otp": "482910",
  "pin": "778899" // คีย์หลักของ Frontend คือ "pin" (Backend ควรรองรับ "new_pin" ด้วย)
}
```
- **Logic:** ตรวจ OTP -> บันทึก hash ของ PIN ใหม่ -> รีเซ็ต lockout -> ออก access_token
- **Response 200:** `{ "ok": true, "access_token": "<NEW_TOKEN>", "message": "รีเซ็ต PIN สำเร็จ" }`

---

### 3.5 Password Recovery

#### 13) `POST /api/patient/password/reset/request/` (ขอ OTP ลืมรหัสผ่าน)
- **Auth:** Public
- **Request Body:** `{ "identifier": "somchai@example.com", "channel": "email" }`
- **Anti-Enumeration:** ไม่พบบัญชีก็ต้องตอบ 200 OK ป้องกันการสแกนหาอีเมล
- **Response 200:**
```json
{
  "ok": true,
  "message": "ส่งรหัส OTP เรียบร้อยแล้ว หากมีบัญชีในระบบ",
  "cooldown_seconds": 60,
  "expires_in_seconds": 300,
  "masked_target": "so••••••@example.com"
}
```

#### 14) `POST /api/patient/password/reset/verify-otp/` (ยืนยัน OTP รับ Reset Token)
- **Auth:** Public
- **Request Body:** `{ "identifier": "somchai@example.com", "otp": "482910" }`
- **Logic:**
  - ตรวจ `expires_at > NOW()` และ `is_used == false`
  - Atomic increment `attempts += 1` (เกิน 5 ครั้งยกเลิก OTP ทันที)
  - สร้าง `reset_token` (32 bytes hex) เก็บเฉพาะ SHA-256 hash ลง DB (อายุ 15 นาที)
- **Response 200:**
```json
{
  "ok": true,
  "reset_token": "rst_token_88a9c2b3d4e5f6789012345",
  "message": "รหัส OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่"
}
```

#### 15) `POST /api/patient/password/reset/confirm/` (ตั้งรหัสผ่านใหม่)
- **Auth:** Public
- **Request Body:**
```json
{
  "reset_token": "rst_token_88a9c2b3d4e5f6789012345",
  "identifier": "somchai@example.com", // (Optional: Frontend แนบมาด้วย)
  "new_password": "NewSecurePassword#2026",
  "confirm_password": "NewSecurePassword#2026"
}
```
- **Logic:**
  1. เทียบ SHA-256(`reset_token`) กับ `reset_token_hash` ตรวจ `is_used == false` และยังไม่หมดอายุ
  2. มาร์ก `is_used = true` ทันทีกัน Replay
  3. บันทึก hash รหัสผ่านใหม่ (Argon2id / bcrypt)
  4. **Global Token Revocation:** `token_version += 1` เพื่อเตะเซสชันเดิมทุกอุปกรณ์
- **Response 200:** `{ "ok": true, "message": "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่" }`

---

## 4. Security & Production Requirements

### 4.1 SQL Injection Prevention
- ใช้ **Django ORM** เสมอ (`PatientAccount.objects.filter(...)`)
- หากใช้ Raw SQL บังคับใช้ Parameterized Query ห้ามใช้ f-string / String Concatenation:
  ```python
  cursor.execute("SELECT * FROM patient_accounts WHERE email = %s", [email])
  ```

### 4.2 Rate Limiting (Redis Recommended)
- **Auth / Login:** ไม่เกิน 5 req/min ต่อ IP / User
- **OTP Request:** บังคับ Cooldown 60s ต่อ target, สูงสุด 5 req/hour ต่อบัญชี
- **OTP Verify:** กรอกผิดได้ไม่เกิน 5 ครั้ง ต่อ 1 OTP transaction

### 4.3 CORS & Headers Configuration (`settings.py`)
```python
# อนุญาตเฉพาะโดเมนหน้าเว็บจริงเท่านั้น (บล็อก Localhost และเครื่องภายนอกทั้งหมด)
CORS_ALLOWED_ORIGINS = [
    "https://hospital.bfirstkok.me",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ["content-type", "authorization", "x-requested-with"]
```

### 4.4 Data Protection & PII (PDPA)
- **ห้ามส่งคืน Hash:** ห้ามมี `password_hash`, `pin_hash`, หรือ `otp_code_hash` ใน Response ใดๆ
- **Immutable Fields:** `national_id` และ `hn` ต้องไม่สามารถแก้ไขผ่าน API ได้
- **Masking:** อีเมลและเบอร์โทรที่ส่งกลับใน public response ต้อง Mask เสมอ (เช่น `so••••••@example.com`)
