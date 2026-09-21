# OPD Smart Hospital - Patient Queue & Medical Portal 🏥

ระบบจองและตรวจสอบสถานะคิวผู้ป่วยนอก (OPD Patient Queue & Portal) พัฒนาด้วย **Next.js 16 App Router, TypeScript** พร้อมสถาปัตยกรรมแบบ **Static Export (`basePath: /patient`)** รองรับการใช้งานแบบ **Mobile-First Responsive Web Application** ทำงานได้อย่างสมบูรณ์ทั้งบนโทรศัพท์มือถือและคอมพิวเตอร์

---

## 🌟 ฟีเจอร์หลักของระบบ (Core Features)

1. **ระบบเข้าสู่ระบบหลายรูปแบบ (Multi-channel Authentication):**
   - เข้าสู่ระบบด้วย **ชื่อผู้ใช้ (Username)** หรือ **เลขประจำตัวประชาชน 13 หลัก** คู่กับรหัสผ่าน
   - รองรับ **Social Login (Google OAuth)**
   - ระบบกู้คืนรหัสผ่านด้วยรหัส **OTP 6 หลัก** ทางอีเมล/เบอร์โทรศัพท์
   - ปุ่มสลับดูรหัสผ่าน (Password Visibility Toggle) และระบบแจ้งเตือนข้อผิดพลาดทันที

2. **ระบบความปลอดภัยรหัส PIN 6 หลัก (6-Digit Security PIN):**
   - ปกป้องข้อมูลเวชระเบียนและประวัติสุขภาพด้วยรหัส PIN 6 หลัก
   - แป้นตัวเลขจำลอง (Virtual Keypad) รองรับหน้าจอสัมผัส พร้อมระบบสั่นเตือนบนมือถือ (`navigator.vibrate`)
   - ยืนยันรหัส PIN 2 ขั้นตอนเมื่อเปิดใช้งานครั้งแรก

3. **ระบบลงทะเบียนผู้ป่วยใหม่ & คัดกรองอาการ (Patient Registration & PDPA):**
   - **PDPA Consent Gate:** บังคับให้ความยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคลก่อนเข้าถึงแบบฟอร์ม
   - **Health Screening:** คัดกรองข้อมูลโรคประจำตัว, ประวัติแพ้ยา/อาหาร, ยาที่ใช้ประจำ และอาการสำคัญ
   - **Duplicate Queue Guard:** ป้องกันการลงทะเบียนซ้ำซ้อน หากมีคิวค้างอยู่แล้วในระบบจะพากลับไปหน้าคิวเดิมทันที

4. **หน้าบัตรคิวรับบริการสด (Live Queue Status):**
   - แสดงหมายเลขคิว, ห้องตรวจ, ลำดับคิว, และจำนวนคิวก่อนหน้า
   - คำนวณและประเมินระยะเวลารอตรวจโดยประมาณอัตโนมัติ
   - ระบบเสียงเตือนกระดิ่ง (3-Tone Gentle Chime ผ่าน Web Audio API) และการสั่นเมื่อใกล้ถึงคิว
   - ระบบยกเลิกคิวรับบริการแบบปลอดภัย 2 ขั้นตอน (2-Step Cancellation)
   - ลิงก์เชื่อมโยงไปยังจอแสดงผลคิวรวมทั้งโรงพยาบาล (Live OPD Board)

5. **ข้อมูลและประวัติการรักษา (Patient Account & Medical Records):**
   - แสดงข้อมูลส่วนบุคคลและหมายเลขประจำตัวผู้ป่วย (HN)
   - แท็บรายการนัดหมายแพทย์ พร้อมปุ่มดาวน์โหลดไฟล์นัดเข้าปฏิทิน (`.ics`)
   - แท็บบันทึกประวัติการตรวจ สัญญาณชีพ (ความดัน, ชีพจร, อุณหภูมิ, ออกซิเจน) และคำวินิจฉัย

6. **การออกแบบเพื่อทุกคน & โหมดผู้สูงอายุ (Senior Accessibility & Responsive):**
   - สลับ Layout อัตโนมัติ: **Bottom App Bar** บนโทรศัพท์มือถือ และ **Top Header Menu** บนคอมพิวเตอร์
   - โหมดปรับขนาดตัวอักษรสำหรับผู้สูงอายุและสายตายาว (ขนาดใหญ่พิเศษ `data-font-size="xlarge"`)
   - หมายเลขฉุกเฉินและสายด่วนกู้ชีพ 1669

---

## 📱 การรองรับอุปกรณ์ (Responsive Support)

| รายการ | โทรศัพท์มือถือ (Mobile) | คอมพิวเตอร์ (Desktop PC) |
| :--- | :--- | :--- |
| **แถบนำทาง** | Bottom Navigation Bar ด้านล่างหน้าจอ | Top Header Navigation Menu ด้านบนขวา |
| **ฟอร์มกรอกข้อมูล** | Single-column ไหลลื่น ไม่ตกขอบจอ | Multi-column จัดวางเต็มหน้าจออย่างเป็นสัดส่วน |
| **แป้นพิมพ์ PIN** | Touch Target > 48px สำหรับแตะนิ้วสัมผัส | รองรับคลิกเมาส์และพิมพ์ผ่านแป้นพิมพ์จริง |
| **Viewport** | ทดสอบบน Pixel 7 (412 x 915) | ทดสอบบน Desktop Chrome (1280 x 720) |

---

## 🧪 การทดสอบอัตโนมัติ (Playwright E2E Testing)

โครงการนี้มีชุดทดสอบแบบ End-to-End ครอบคลุม **32 การทดสอบ (100% Pass Rate)** ทั้งบน Desktop และ Mobile:

```powershell
# สั่งรันการทดสอบทั้งหมด (ระบบจะเปิด mock_backend และ http-server ให้อัตโนมัติ)
npx playwright test

# สั่งรันเฉพาะไฟล์ที่ต้องการ
npx playwright test tests/e2e/login.spec.ts
npx playwright test tests/e2e/registration.spec.ts
npx playwright test tests/e2e/auth-and-queue.spec.ts

# เปิดดูรายงานผลการทดสอบแบบ HTML
npx playwright show-report
```

### ชุดข้อมูลทดสอบ (Mock Test Credentials)

- **ชื่อผู้ใช้ (Username):** `somchai99`
- **รหัสผ่าน (Password):** `Password@2026`
- **เลขประจำตัวประชาชน (National ID):** `1234567890123`
- **รหัสความปลอดภัย PIN:** `123456`
- **รหัสทดสอบ OTP:** `123456`

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### ความต้องการของระบบ (Prerequisites)
- **Node.js:** เวอร์ชั่น 20.9 หรือใหม่กว่า
- **Python:** เวอร์ชั่น 3.8 หรือใหม่กว่า (สำหรับรัน Mock Backend และ HTTP Static Server)

### 1. ติดตั้ง Dependencies
```powershell
npm install
```

### 2. รันในโหมดพัฒนา (Development Mode)
```powershell
# รัน Local Mock Backend (Terminal 1)
python mock_backend.py

# รัน Next.js Dev Server (Terminal 2)
npm run dev
```
เปิดเบราว์เซอร์ที่: `http://localhost:3000/patient`

---

## 📦 การ Build และ Run ในโหมด Production (Static Export)

ระบบจะ Export เว็บออกมาเป็นไฟล์ HTML/CSS/JS บริสุทธิ์ในโฟลเดอร์ `dist/` โดยอัตโนมัติ:

```powershell
# 1. สั่ง Build โครงการ
npm run build

# 2. รัน Static Server ด้วย Python
python -m http.server 5500 --bind 127.0.0.1 -d dist
```
เข้าใช้งานผ่านเบราว์เซอร์ได้ที่: **`http://127.0.0.1:5500`** หรือ **`http://127.0.0.1:5500/patient/`**  
*(ระบบมีสคริปต์ Auto-Redirect จากหน้า Root `/` ไปยัง `/patient/` ให้โดยอัตโนมัติ)*

---

## ⚙️ การตั้งค่าการเชื่อมต่อเซิร์ฟเวอร์ (Runtime Configuration)

ระบบอ่านค่าการตั้งค่าจาก `window.PATIENT_APP_ENV` ในไฟล์ `public/runtime-config.js` (และ `dist/runtime-config.js`):

```javascript
window.PATIENT_APP_ENV = {
  apiBaseUrl: "http://127.0.0.1:8000",       // สลับไป https://hospital.bfirstkok.me เมื่อต่อเซิร์ฟเวอร์จริง
  statusRefreshMs: 10000,                    // ความถี่ในการอัปเดตสถานะคิวอัตโนมัติ (มิลลิวินาที)
  GOOGLE_CLIENT_ID: "your-google-oauth-web-client-id.apps.googleusercontent.com"
  seniorMode: false
};
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
Queue-Hostpital/
├─ dist/                       ผลลัพธ์ Static Export พร้อม Deploy ขึ้น Production
├─ public/                     ไฟล์ Static Assets (icons, runtime-config.js)
├─ scripts/
│  ├─ clean-build.mjs          ล้างโฟลเดอร์ build เก่าก่อนเริ่มคอมไพล์ใหม่
│  ├─ publish-export.mjs       ก็อปปี้ไฟล์ export และสร้าง index.html redirect
│  └─ write-runtime-config.mjs เขียนค่าคอนฟิกจาก .env เข้า runtime-config.js
├─ src/
│  ├─ app/                     Next.js Entrypoint, Layout และ Global Styles
│  ├─ features/
│  │  ├─ account/              หน้าข้อมูลผู้ป่วย, ตารางนัดหมาย และประวัติการรักษา
│  │  ├─ auth/                 หน้าเข้าสู่ระบบ, กู้คืนรหัสผ่าน OTP และระบบ PIN 6 หลัก
│  │  ├─ patient-profile/      ฟอร์มกรอกข้อมูลส่วนบุคคลและข้อมูลสุขภาพ
│  │  ├─ queue/                หน้าแสดงบัตรคิวสด, การคำนวณเวลารอ และระบบยกเลิกคิว
│  │  ├─ registration/         หน้าลงทะเบียนผู้ป่วยใหม่ และ PDPA Consent Gate
│  │  └─ settings/             หน้าตั้งค่า, โหมดผู้สูงอายุ (ใหญ่พิเศษ) และออกจากระบบ
│  └─ shared/                  โมดูลและคอมโพเนนต์ที่ใช้ร่วมกัน (API Client, UI, Icons)
├─ tests/
│  └─ e2e/                     ชุดทดสอบ Playwright E2E Tests ครอบคลุม 32 เคส
├─ mock_backend.py             Local Mock Hospital Backend สำหรับการพัฒนาและทดสอบ E2E
├─ playwright.config.ts        การตั้งค่า Playwright รองรับ Desktop และ Mobile Emulation
└─ README.md                   คู่มือการใช้งานและเอกสารอธิบายระบบ
```


### Google OAuth production

ฝั่ง Patient Portal และ Django backend ต้องใช้ Google OAuth Web Client ID เดียวกัน:

- Patient Portal: `PATIENT_GOOGLE_CLIENT_ID=<client-id>`
- Django backend: `GOOGLE_CLIENT_ID=<client-id>`
- Google Cloud Console Authorized JavaScript origins: `https://hospital.bfirstkok.me`

ห้ามใช้ mock token ใน production; หน้า Login โหลด Google Identity Services และส่ง ID token จริงไปที่ `/api/patient/auth/google/`.
