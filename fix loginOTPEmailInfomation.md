# 📋 Backend Handoff Task: Authentication, Profile Management & Password Recovery System
**File Name:** `fix loginOTPEmailInfomation.md`  
**Target Audience:** Backend Engineering Team  
**Project:** Hospital Queue Patient System (`https://hospital.bfirstkok.me`)  
**Status:** Ready for Implementation (Sprint Handoff)  
**Date:** 2026-09-18  

---

## 1. บทนำและวัตถุประสงค์ (Overview & Objectives)

เอกสารฉบับนี้จัดทำขึ้นเพื่อส่งมอบงาน (Handoff) รายละเอียดความต้องการทางเทคนิค (Technical Specifications) สำหรับทีม Backend ในการปรับปรุงระบบจากเดิมที่ใช้เลขบัตรประชาชน (13 หลัก) เป็นกุญแจหลักในการเข้าสู่ระบบ เปลี่ยนผ่านสู่ระบบมาตรฐานความปลอดภัยสากลและการคุ้มครองข้อมูลส่วนบุคคล (PDPA):

1. **ระบบ Authentication & Identity:** รองรับการลงทะเบียน (Register) และเข้าสู่ระบบ (Login) ด้วย `Username / Email` และ `Password` พร้อมรองรับ `Google Sign-In (OAuth2 / OIDC)` โดยยังคงผูกโยงกับข้อมูลผู้ป่วยในระบบโรงพยาบาล (National ID / HN) อย่างปลอดภัย
2. **ระบบจัดการข้อมูลส่วนตัว (Profile Management):** เปิดให้ผู้ป่วยสามารถเรียกดูและแก้ไขข้อมูลส่วนตัว (Contact Info, Address, Emergency Contacts, Health Baseline) ผ่าน API โดยมีการตรวจสอบสิทธิ์และป้องกันข้อมูลอ่อนไหว (เช่น National ID และ HN ไม่ให้แก้ไขโดยพลการ)
3. **ระบบกู้คืนรหัสผ่าน (Password Recovery / Reset):** ระบบขอรับรหัส OTP 6 หลักผ่าน **Email** หรือ **SMS (เบอร์โทรศัพท์มือถือ)** เพื่อยืนยันตัวตนก่อนตั้งรหัสผ่านใหม่ พร้อมระบบป้องกันการโจมตี (Rate Limiting, Anti-Bruteforce, Token Expiration)

---

## 2. แผนผังโครงสร้างฐานข้อมูล (Database Schema Changes)

### 2.1 ตารางผู้ใช้งานและบัญชี (`patient_accounts` หรือ `users`)
ต้องเพิ่มฟิลด์สำหรับการยืนยันตัวตน และแยกส่วนข้อมูลสิทธิ์ออกจากข้อมูลเวชระเบียน:

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / BIGINT | PRIMARY KEY, AUTO_INCREMENT | Patient Account ID |
| `username` | VARCHAR(50) | UNIQUE, NULLABLE (or Required) | ชื่อผู้ใช้งาน (สำหรับ Login) |
| `email` | VARCHAR(191) | UNIQUE, NOT NULL, INDEX | อีเมลของผู้ป่วย (ใช้ Login / กู้คืนรหัส) |
| `phone` | VARCHAR(20) | INDEX, NOT NULL | เบอร์โทรศัพท์มือถือ (รับ SMS OTP) |
| `password_hash` | VARCHAR(255) | NULLABLE (ถ้าสมัครผ่าน Google) | เก็บรหัสผ่านที่ Hash ด้วย Argon2id หรือ bcrypt |
| `google_id` | VARCHAR(100) | UNIQUE, NULLABLE, INDEX | Google Sub ID (เมื่อเชื่อมต่อ Google OAuth) |
| `national_id` | VARCHAR(13) | UNIQUE, NOT NULL, INDEX | เลขประจำตัวประชาชน 13 หลัก (ผูกกับ HIS) |
| `hn` | VARCHAR(50) | UNIQUE, NULLABLE, INDEX | หมายเลขประจำตัวผู้ป่วยของโรงพยาบาล |
| `is_active` | BOOLEAN | DEFAULT TRUE | สถานะบัญชีผู้ใช้ |
| `email_verified`| BOOLEAN | DEFAULT FALSE | สถานะยืนยันอีเมล |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | วันที่สร้างบัญชี |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | วันที่แก้ไขล่าสุด |

### 2.2 ตารางรหัส OTP และการกู้คืนรหัสผ่าน (`password_resets_otp`)
สำหรับจัดเก็บ OTP ที่มีอายุจำกัดและสกัดกั้นการสุ่มรหัส:

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / BIGINT | PRIMARY KEY | Record ID |
| `patient_id` | BIGINT / UUID | FOREIGN KEY -> `patient_accounts.id` | บัญชีผู้ขอรหัส |
| `otp_code_hash`| VARCHAR(255) | NOT NULL | OTP 6 หลักที่ Hash ไว้ (ไม่เก็บ Plain Text) |
| `channel` | ENUM('email', 'sms') | NOT NULL | ช่องทางที่ส่งรหัส |
| `target` | VARCHAR(191) | NOT NULL | อีเมลหรือเบอร์โทรที่ส่งไป |
| `reset_token` | VARCHAR(255) | UNIQUE, NULLABLE, INDEX | Token ชั่วคราวหลังยืนยัน OTP สำเร็จ (อายุ 15 นาที) |
| `attempts` | INT | DEFAULT 0 | จำนวนครั้งที่ใส่รหัสผิด (สูงสุดไม่เกิน 5 ครั้ง) |
| `expires_at` | TIMESTAMP | NOT NULL | วันหมดอายุของรหัส OTP (แนะนำ 5 - 10 นาที) |
| `is_used` | BOOLEAN | DEFAULT FALSE | ถูกใช้งานแล้วหรือไม่ |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | วันเวลาที่ขอ |

---

## 3. รายละเอียด API Specifications (REST Contract)

### 3.1 Authentication APIs

#### 1) `POST /api/patient/register/` (ลงทะเบียนผู้ป่วยใหม่)
- **คำอธิบาย:** รองรับการสร้างบัญชีผู้ป่วยพร้อมรหัสผ่าน และข้อมูลเวชระเบียนเริ่มต้น
- **Request Body (JSON):**
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
  "blood_type": "O",
  "height_cm": 175.0,
  "weight_kg": 70.0,
  "chronic_diseases": "ไม่มีโรคประจำตัว",
  "allergies": "ไม่มีประวัติแพ้ยา",
  "medications": "ไม่มียาที่ใช้ประจำ",
  "province": "กรุงเทพมหานคร",
  "district": "เขตจตุจักร",
  "subdistrict": "แขวงลาดยาว",
  "postal_code": "10900",
  "emergency_contacts": [
    {
      "name": "สมศรี ใจดี",
      "relationship": "SPOUSE",
      "phone": "0898765432"
    }
  ],
  "consent": true
}
```
- **Response Success (201 Created / 200 OK):**
```json
{
  "ok": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "patient_id": "usr_987654",
  "hn": "HN-69001",
  "message": "ลงทะเบียนสำเร็จ"
}
```
- **Error Response (400 Bad Request):**
```json
{
  "ok": false,
  "error": "ข้อมูลการลงทะเบียนไม่ถูกต้อง",
  "errors": {
    "national_id": "เลขบัตรประจำตัวประชาชนนี้มีอยู่ในระบบแล้ว",
    "username": "Username นี้มีผู้ใช้งานแล้ว",
    "email": "รูปแบบอีเมลไม่ถูกต้อง"
  }
}
```

---

#### 2) `POST /api/patient/login/` (เข้าสู่ระบบด้วย Username/Email & Password)
- **คำอธิบาย:** แทนที่การส่ง `national_id` เดี่ยวๆ ด้วยการตรวจสอบรหัสผ่าน
- **Request Body (JSON):**
```json
{
  "identifier": "somchai99", 
  "password": "SecurePassword@2026"
}
```
*(หมายเหตุ: `identifier` สามารถเป็นได้ทั้ง `username` หรือ `email` เพื่อความสะดวกของผู้ใช้งาน)*
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "profile": {
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "national_id": "1234567890123",
    "hn": "HN-67001"
  }
}
```
- **Error Response (401 Unauthorized):**
```json
{
  "ok": false,
  "error": "ชื่อผู้ใช้งาน หรือรหัสผ่านไม่ถูกต้อง"
}
```

---

#### 3) `POST /api/patient/auth/google/` (เข้าสู่ระบบผ่าน Google Sign-In)
- **คำอธิบาย:** รับ Google ID Token จากฝั่ง Client เพื่อทำการ Verify กับ Google API
- **Request Body (JSON):**
```json
{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkMmUzZj... (Google JWT Token)"
}
```
- **Backend Flow:**
  1. Backend นำ ID Token ไป verify signature กับ Google Public Keys (`https://oauth2.googleapis.com/tokeninfo?id_token=...`)
  2. สกัด `sub`, `email`, `name`
  3. ตรวจสอบว่า `google_id` หรือ `email` ตรงกับบัญชีผู้ป่วยในระบบหรือไม่:
     - **กรณีมีบัญชีอยู่แล้ว:** ออก JWT `access_token` ให้ทันที
     - **กรณีเป็นผู้ป่วยใหม่ที่ยังไม่มี National ID:** ส่ง Response แจ้งว่าจำเป็นต้องกรอกเลขบัตรประชาชนและข้อมูลเวชระเบียนเพื่อผูกบัญชี (Link Account):
```json
{
  "ok": true,
  "is_new_user": true,
  "temp_token": "temp_link_token_xyz",
  "suggested_profile": {
    "email": "somchai@gmail.com",
    "first_name": "สมชาย",
    "last_name": "ใจดี"
  }
}
```

---

### 3.2 ระบบแก้ไขข้อมูลส่วนบุคคล (Profile Management APIs)

#### 1) `GET /api/patient/me/` (ดึงข้อมูลส่วนตัวปัจจุบัน)
- **Header:** `Authorization: Bearer <access_token>`
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "profile": {
    "username": "somchai99",
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "national_id": "1234567890123",
    "hn": "HN-67001",
    "phone": "0812345678",
    "email": "somchai@example.com",
    "gender": "M",
    "birth_date": "1990-05-15",
    "age": 36,
    "blood_type": "O",
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "address": "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900",
    "province": "กรุงเทพมหานคร",
    "district": "เขตจตุจักร",
    "subdistrict": "แขวงลาดยาว",
    "postal_code": "10900",
    "chronic_diseases": "ไม่มีโรคประจำตัว",
    "allergies": "ไม่มีประวัติแพ้ยา",
    "medications": "ไม่มียาที่ใช้ประจำ",
    "emergency_contacts": [
      {
        "id": "em_1",
        "name": "สมศรี ใจดี",
        "relationship": "SPOUSE",
        "phone": "0898765432"
      }
    ]
  },
  "active_queue": null,
  "visits": [],
  "appointments": []
}
```

---

#### 2) `PATCH /api/patient/me/` (แก้ไขข้อมูลส่วนตัวและข้อมูลสุขภาพ)
- **Header:** `Authorization: Bearer <access_token>`
- **ข้อกำหนดความปลอดภัย (Security Rules):**
  - ไม่อนุญาตให้แก้ไข `national_id` และ `hn` ผ่าน API นี้โดยเด็ดขาด (ป้องกันการขโมยตัวตนและการปลอมแปลงเวชระเบียน)
  - ข้อมูลเบอร์โทรศัพท์ และอีเมล หากมีการเปลี่ยนแปลง อาจให้ Flag ว่า `email_verified: false`
- **Request Body (JSON - ส่งเฉพาะฟิลด์ที่ต้องการแก้ไขแบบ Partial):**
```json
{
  "phone": "0899998888",
  "email": "somchai.new@example.com",
  "blood_type": "O",
  "height_cm": 176.0,
  "weight_kg": 72.5,
  "province": "กรุงเทพมหานคร",
  "district": "เขตจตุจักร",
  "subdistrict": "แขวงลาดยาว",
  "postal_code": "10900",
  "chronic_diseases": "ความดันโลหิตสูง",
  "allergies": "แพ้ยากลุ่มเพนิซิลลิน (Penicillin)",
  "medications": "ยาลดความดันโลหิต",
  "emergency_contacts": [
    {
      "id": "em_1",
      "name": "สมศรี ใจดี",
      "relationship": "SPOUSE",
      "phone": "0898765432"
    },
    {
      "id": "em_2",
      "name": "สมศักดิ์ ใจดี",
      "relationship": "FATHER",
      "phone": "0811112222"
    }
  ]
}
```
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "message": "บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว",
  "profile": {
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "phone": "0899998888",
    "email": "somchai.new@example.com"
  }
}
```

---

### 3.3 ระบบกู้คืนรหัสผ่านด้วย OTP และ Email (Password Recovery APIs)

#### 1) `POST /api/patient/password/reset/request/` (ขอรับรหัส OTP)
- **คำอธิบาย:** รับค่า Email หรือ เบอร์โทรศัพท์ หรือ Username เพื่อสร้างรหัส OTP 6 หลัก และส่งออกทาง Email / SMS
- **Request Body (JSON):**
```json
{
  "identifier": "somchai@example.com",
  "channel": "email"
}
```
*(กรณีเลือก SMS: `"channel": "sms"` โดย `identifier` สามารถเป็นเบอร์โทรศัพท์หรือ username)*
- **เงื่อนไขและการป้องกันความปลอดภัย (Anti-Enumeration & Rate Limiting):**
  - **Rate Limit:** ห้ามขอ OTP ซ้ำภายใน 60 วินาที และจำกัดไม่เกิน 3 ครั้งต่อ 1 ชั่วโมงสำหรับ 1 บัญชี/IP
  - **Anti-Account Harvesting:** ไม่ว่าจะมีผู้ใช้นี้ในระบบหรือไม่ ให้ตอบกลับ HTTP 200 เหมือนกัน เพื่อป้องกันการสแกนหาอีเมล/เบอร์โทรในระบบ
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "message": "ระบบได้ส่งรหัส OTP ไปยังช่องทางที่ท่านเลือกแล้ว หากมีข้อมูลในระบบ",
  "cooldown_seconds": 60,
  "expires_in_seconds": 300,
  "masked_target": "so••••••@example.com"
}
```

---

#### 2) `POST /api/patient/password/reset/verify-otp/` (ตรวจสอบความถูกต้องของ OTP)
- **คำอธิบาย:** ยืนยันรหัส OTP 6 หลักที่ผู้ป่วยได้รับ หากถูกต้องจะได้รับ `reset_token` ที่มีอายุสั้น (15 นาที) สำหรับไปหน้าตั้งรหัสผ่านใหม่
- **Request Body (JSON):**
```json
{
  "identifier": "somchai@example.com",
  "otp": "482910"
}
```
- **เงื่อนไข:**
  - รหัส OTP ต้องไม่หมดอายุ (`expires_at > NOW()`)
  - ตรวจสอบจำนวนครั้งที่กรอกผิด (`attempts < 5`) หากเกิน 5 ครั้ง ให้ทำการ Invalidate รหัส OTP นั้นทันที
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "reset_token": "rst_token_88a9c2b3d4e5f6789012345",
  "message": "ยืนยันรหัส OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่"
}
```
- **Error Response (400 Bad Request):**
```json
{
  "ok": false,
  "error": "รหัส OTP ไม่ถูกต้อง หรือหมดอายุแล้ว (เหลือโอกาสอีก 2 ครั้ง)"
}
```

---

#### 3) `POST /api/patient/password/reset/confirm/` (ตั้งรหัสผ่านใหม่)
- **คำอธิบาย:** ผู้ป่วยส่ง `reset_token` พร้อมรหัสผ่านใหม่ที่ต้องการตั้ง
- **Request Body (JSON):**
```json
{
  "reset_token": "rst_token_88a9c2b3d4e5f6789012345",
  "new_password": "NewSecurePassword#2026",
  "confirm_password": "NewSecurePassword#2026"
}
```
- **Backend Flow:**
  1. ค้นหา `reset_token` ที่ยังไม่ถูกใช้ (`is_used = FALSE`) และยังไม่หมดอายุ
  2. ตรวจสอบเงื่อนไขความปลอดภัยของรหัสผ่านใหม่ (เช่น อย่างน้อย 8 ตัวอักษร มีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข)
  3. Hash รหัสผ่านใหม่ด้วย **Argon2id** หรือ **bcrypt** (Cost factor >= 12)
  4. อัปเดต `password_hash` ใน `patient_accounts`
  5. มาร์ก `is_used = TRUE` ในตาราง `password_resets_otp`
  6. **Security Invalidation:** ยกเลิก Token/Session เดิมทั้งหมดของผู้ใช้ (Logout all devices) เพื่อป้องกันผู้ไม่ประสงค์ดี
- **Response Success (200 OK):**
```json
{
  "ok": true,
  "message": "เปลี่ยนรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
}
```

---

## 4. แผนงานและการจัดส่งต่อ (Task Checklist for Backend Team)

### Task 4.1: Database Migration
- [ ] เพิ่มคอลัมน์ `username`, `password_hash`, `google_id`, `email_verified` ในตารางผู้ป่วย/ผู้ใช้
- [ ] สร้างตาราง `password_resets_otp` สำหรับจัดเก็บและตรวจสอบ OTP
- [ ] เขียน Migration script แปลงข้อมูลผู้ป่วยเดิมที่มีอยู่ (Data Backfill)

### Task 4.2: Authentication & Google OAuth
- [ ] ปรับปรุง Endpoint `POST /api/patient/login/` ให้รองรับ `{ identifier, password }`
- [ ] เพิ่ม Endpoint `POST /api/patient/auth/google/` ตรวจสอบ Token จาก Google
- [ ] ปรับปรุงการออก JWT Token ให้ระบุ `sub`, `username`, `hn`, `national_id` ใน Payload

### Task 4.3: Profile Editing API
- [ ] ตรวจสอบ Endpoint `PATCH /api/patient/me/` ให้บันทึกข้อมูลสุขภาพ, ที่อยู่ และผู้ติดต่อฉุกเฉิน
- [ ] กำหนด Guard ไม่ให้แก้ไข `national_id` และ `hn` ผ่าน API
- [ ] ส่งข้อมูล Profile ฉบับปรับปรุงล่าสุดกลับมาใน Response

### Task 4.4: Password Recovery & OTP Service
- [ ] ติดตั้ง Email Service (เช่น SMTP, SendGrid, Amazon SES) พร้อม HTML Template แจ้งรหัส OTP
- [ ] ติดตั้ง SMS Gateway (เช่น ThaiBulkSMS, Twilio) สำหรับส่ง OTP ผ่านเบอร์มือถือ
- [ ] พัฒนา Endpoint ขอ OTP, ตรวจสอบ OTP และยืนยันตั้งรหัสผ่านใหม่
- [ ] เพิ่มระบบ Rate Limiting (Redis / In-memory) ป้องกันการขอ OTP ซ้ำซ้อนและ Brute Force

---

## 5. การทดสอบและการรับมอบงาน (Acceptance Criteria)

1. **Login Test:**
   - ทดสอบ Login ด้วย Username ถูกต้อง + Password ถูกต้อง -> ได้รับ 200 OK และ JWT Token
   - ทดสอบ Login ด้วย Password ผิด -> ได้รับ 401 Unauthorized พร้อมข้อความเตือน
   - ทดสอบ Google Sign-In ด้วย ID Token ที่ถูกต้อง -> ล็อกอินสำเร็จ
2. **Profile Edit Test:**
   - ส่งคำขอ `PATCH /api/patient/me/` อัปเดตที่อยู่และเบอร์โทรศัพท์ -> ข้อมูลใน Database อัปเดตทันที
   - ลองส่ง `national_id` หรือ `hn` ใหม่เข้าไป -> Backend ต้องปฏิเสธหรือไม่แก้ไขค่าเดิม
3. **Password Recovery Test:**
   - ขอ OTP ทาง Email -> ได้รับอีเมลรหัส OTP ภายในไม่เกิน 30 วินาที
   - ขอ OTP ซ้ำทันทีภายใน 60 วินาที -> ระบบต้องแจ้งติด Cooldown (HTTP 429 หรือแจ้งเตือนเวลา)
   - กรอก OTP ถูกต้องและตั้งรหัสผ่านใหม่ -> สามารถนำรหัสผ่านใหม่ไป Login สำเร็จ

---

## 6. ข้อกำหนดสถาปัตยกรรมความปลอดภัย Zero-Local-Storage & Cloud-First Architecture

ตามนโยบายความมั่นคงปลอดภัยขั้นสูงและมาตรฐาน PDPA ทางทีม Frontend ได้ปรับสถาปัตยกรรมเป็น **Zero-Local-Storage** สำหรับข้อมูลความมั่นคงปลอดภัยและข้อมูลส่วนบุคคล (PII) ทั้งหมด:

### 6.1 ฝั่ง Frontend (Client-Side Hardening)
1. **ห้ามจัดเก็บ PII และ Credentials ใน `localStorage` เด็ดขาด:**
   - เลขประจำตัวประชาชน (`national_id`), รหัส PIN, ค่า Hash ของ PIN, ประวัติการแพทย์, และข้อมูล PII ของผู้ป่วย ถูกถอดถอนออกจากการเขียนลงใน `localStorage` ทั้งหมด 100%
   - ข้อมูลผู้ป่วยทั้งหมดจะถูกดึงสดผ่าน Authoritative API (`GET /api/patient/me/`) หลังยืนยันตัวตนสำเร็จ
2. **Session & Token Management:**
   - จัดเก็บโทเค็นและเซสชันไว้ใน In-Memory state หรือ `sessionStorage` เท่านั้น (จะถูกล้างทิ้งทันทีที่ปิดแท็บหรือเบราว์เซอร์)
   - *คำแนะนำสำหรับ Production:* ขอให้ทีม Backend พิจารณาส่งผ่าน Auth Token ด้วยรูปแบบ **HttpOnly, Secure, SameSite=Strict Cookies** เพื่อป้องกันการโจมตี XSS โดยสมบูรณ์

### 6.2 ฝั่ง Backend & Cloud Database (Server-Authoritative Enforcement)
1. **PIN Security & Lockout State on Cloud Database:**
   - ตารางความปลอดภัยของ PIN และการนับครั้งที่ใส่ผิด (`attempts`) ตลอดจนเวลา Lockout ชั่วคราว ต้องถูกเก็บและประมวลผลบน Database หรือ Redis ฝั่ง Cloud เท่านั้น
   - เมื่อผู้ใช้กรอก PIN ผิดครบ 3 ครั้ง ฝั่ง Server ต้องบันทึกสถานะ Lockout และปฏิเสธคำขอด้วย `HTTP 423 Locked` ทันที
2. **Mock-up for Local Development & Testing:**
   - สำหรับการรันและทดสอบระบบบนเครื่อง Local ทางทีมได้จัดเตรียม `mock_backend.py` ที่จำลอง Database State (`MOCK_DATABASE_SECURITY`, `MOCK_PATIENT_PROFILE`) ในระดับ Server-side in-memory โดยไม่พึ่งพา LocalStorage ของเบราว์เซอร์

