# OPD Smart Hospital - Patient Queue & Medical Portal 🏥

ระบบจองและตรวจสอบสถานะคิวผู้ป่วยนอก (OPD Patient Queue & Portal) พัฒนาด้วย **Next.js 16 App Router (Turbopack), React 19, TypeScript** พร้อมสถาปัตยกรรมแบบ **Static Export (`basePath: /patient`)** รองรับการใช้งานแบบ **Mobile-First Responsive Web Application** ทำงานได้อย่างสมบูรณ์ทั้งบนโทรศัพท์มือถือและคอมพิวเตอร์

---

## 🌟 ฟีเจอร์หลักของระบบ (Core Features)

1. **ระบบเข้าสู่ระบบหลายรูปแบบ (Multi-channel Authentication):**
   - เข้าสู่ระบบด้วย **ชื่อผู้ใช้ (Username)** หรือ **เลขประจำตัวประชาชน 13 หลัก** คู่กับรหัสผ่าน
   - รองรับ **Social Login (Google OAuth 2.0)** ด้วย Google Identity Services Token Client เปิดหน้าต่าง Account Chooser Popup ได้ทันที
   - ระบบกู้คืนรหัสผ่านด้วยรหัส **OTP 6 หลัก** ทางอีเมลหรือเบอร์โทรศัพท์
   - ปุ่มสลับดูรหัสผ่าน (Password Visibility Toggle) และระบบแจ้งเตือนข้อผิดพลาดทันที

2. **ระบบความปลอดภัยรหัส PIN 6 หลัก (6-Digit Security PIN):**
   - ปกป้องข้อมูลเวชระเบียนและประวัติสุขภาพด้วยรหัส PIN 6 หลัก
   - แป้นตัวเลขจำลอง (Virtual Keypad) รองรับหน้าจอสัมผัส พร้อมระบบสั่นเตือนบนมือถือ (`navigator.vibrate`)
   - ยืนยันรหัส PIN 2 ขั้นตอนเมื่อเปิดใช้งานครั้งแรก (ตั้งรหัส และยืนยันรหัส)
   - จัดเก็บข้อมูลความปลอดภัยแบบปลอดภัย (Session-based Security)

3. **ระบบลงทะเบียนผู้ป่วยใหม่ & คัดกรองอาการ (Patient Registration & PDPA):**
   - **PDPA Consent Gate:** บังคับให้ความยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคลก่อนเข้าถึงแบบฟอร์ม
   - **Health Screening:** คัดกรองข้อมูลโรคประจำตัว, ประวัติแพ้ยา/อาหาร, ยาที่ใช้ประจำ และอาการสำคัญ
   - **Duplicate Queue Guard:** ป้องกันการลงทะเบียนซ้ำซ้อน หากมีคิวค้างอยู่แล้วในระบบจะพากลับไปหน้าคิวเดิมทันที

4. **หน้าบัตรคิวรับบริการสด (Live Queue Status):**
   - แสดงหมายเลขคิว, ห้องตรวจ, ลำดับคิว, และจำนวนคิวก่อนหน้าแบบ Real-time
   - คำนวณและประเมินระยะเวลารอตรวจโดยประมาณอัตโนมัติ
   - ระบบเสียงเตือนกระดิ่ง (3-Tone Gentle Chime ผ่าน Web Audio API) และการสั่นเมื่อใกล้ถึงคิว
   - ระบบยกเลิกคิวรับบริการแบบปลอดภัย 2 ขั้นตอน (2-Step Cancellation Confirmation)
   - บัตรคิวแบบกราฟิก Canvas สามารถแชร์หรือบันทึกได้

5. **ข้อมูลและประวัติการรักษา (Patient Account & Medical Records):**
   - แสดงข้อมูลส่วนบุคคลและหมายเลขประจำตัวผู้ป่วย (HN)
   - แท็บรายการนัดหมายแพทย์ พร้อมปุ่มดาวน์โหลดไฟล์นัดเข้าปฏิทิน (`.ics`)
   - แท็บบันทึกประวัติการตรวจ สัญญาณชีพ (ความดัน, ชีพจร, อุณหภูมิ, ออกซิเจน) และคำวินิจฉัย
   - ฟอร์มแก้ไขข้อมูลส่วนตัวและผู้ติดต่อฉุกเฉิน

6. **การออกแบบเพื่อทุกคน & โหมดผู้สูงอายุ (Senior Accessibility & Responsive):**
   - สลับ Layout อัตโนมัติ: **Bottom App Bar** บนโทรศัพท์มือถือ และ **Top Header Menu** บนคอมพิวเตอร์
   - โหมดปรับขนาดตัวอักษรสำหรับผู้สูงอายุและสายตายาว (ขนาดใหญ่พิเศษ `data-font-size="xlarge"`)
   - หมายเลขฉุกเฉินและสายด่วนกู้ชีพ 1669
   - ออกแบบตามมาตรฐานความสามารถในการเข้าถึง (WCAG 2.1 AA)

---

## 🔑 การตั้งค่า Google OAuth 2.0 (Google Identity Services)

ระบบใช้ **Google Identity Services (GSI) OAuth 2.0 Token Client** เพื่อให้กดปุ่มแล้วเปิดหน้าต่าง Popup เลือกบัญชี Google ทันที:

### 1. การตั้งค่าใน `.env`
```env
PATIENT_API_BASE_URL=http://127.0.0.1:8000
PATIENT_STATUS_REFRESH_MS=10000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=477244523835-vopgha7b47cohjn2ouk80ng1gsup5tl8.apps.googleusercontent.com
```

### 2. การตั้งค่าใน Google Cloud Console
ในหน้า [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials):
- ไปที่ OAuth 2.0 Client ID ของแอป
- ในหัวข้อ **"URI ต้นทาง JavaScript ที่ได้รับอนุญาต" (Authorized JavaScript origins)** ต้องเพิ่ม URL เหล่านี้:
  - `http://localhost:5500`
  - `http://127.0.0.1:5500`
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  *(ห้ามใส่ `/` หรือ path ปิดท้าย เช่น ห้ามใส่ `http://localhost:5500/`)*
- บันทึกการตั้งค่า และรอประมาณ 2-3 นาทีเพื่อให้สิทธิ์มีผลทั่วโลก

---

## 📱 การรองรับอุปกรณ์ (Responsive Support)

| รายการ | โทรศัพท์มือถือ (Mobile) | คอมพิวเตอร์ (Desktop PC) |
| :--- | :--- | :--- |
| **แถบนำทาง** | Bottom Navigation Bar ด้านล่างหน้าจอ | Top Header Navigation Menu ด้านบนขวา |
| **ฟอร์มกรอกข้อมูล** | Single-column ไหลลื่น ไม่ตกขอบจอ | Multi-column จัดวางเต็มหน้าจออย่างเป็นสัดส่วน |
| **แป้นพิมพ์ PIN** | Touch Target > 48px สำหรับแตะนิ้วสัมผัส | รองรับคลิกเมาส์และพิมพ์ผ่านแป้นพิมพ์จริง |
| **Viewport** | ทดสอบบน Pixel 7 (412 x 915) | ทดสอบบน Desktop Chrome (1280 x 720) |

---

## 🧪 การทดสอบระบบ (Automated Testing - 100% Pass)

โครงการนี้มีชุดทดสอบครอบคลุมทั้ง Unit Testing และ End-to-End Testing รวม **96 การทดสอบ**:

### 1. Unit & Component Tests (Vitest - 64 Tests)
```powershell
# สั่งรัน Unit Test ทั้งหมด
npm run test
```
ครอบคลุม:
- Validation เลขบัตรประจำตัวประชาชน 13 หลักตามสูตร Checksum มหาดไทย
- ระบบจัดเก็บและเข้ารหัส PIN Session Storage
- การทำงานของ API Client และการจัดการ Error
- คอมโพเนนต์ UI, Navigation, Login, Registration, PDPA Consent, Queue Polling

### 2. End-to-End Tests (Playwright - 32 Tests)
```powershell
# สั่งรันการทดสอบ E2E ทั้งหมด (ระบบจะเปิด mock_backend และ web server ให้อัตโนมัติ)
npm run test:e2e

# สั่งรันพร้อมเปิดหน้าต่าง Interactive UI เพื่อดูการทำงานสด
npm run test:e2e:ui

# สั่งรันเฉพาะไฟล์ที่ต้องการ
npx playwright test tests/e2e/login.spec.ts
npx playwright test tests/e2e/registration.spec.ts
npx playwright test tests/e2e/auth-and-queue.spec.ts
```

### ชุดข้อมูลสำหรับทดสอบ (Mock Test Credentials)
- **ชื่อผู้ใช้ (Username):** `somchai99`
- **รหัสผ่าน (Password):** `Password@2026`
- **เลขประจำตัวประชาชน (National ID):** `1234567890123`
- **รหัสความปลอดภัย PIN:** `123456`
- **รหัสทดสอบ OTP:** `123456`

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### ความต้องการของระบบ (Prerequisites)
- **Node.js:** เวอร์ชั่น 20.9 หรือใหม่กว่า (แนะนำ Node.js LTS)
- **Python:** เวอร์ชั่น 3.8 หรือใหม่กว่า (สำหรับรัน Mock Backend และ Static Server)

### 1. ติดตั้ง Dependencies
```powershell
npm install
```

### 2. รันในโหมดพัฒนา (Development Mode)
```powershell
# Terminal 1: รัน Local Mock Backend (Port 8000)
python mock_backend.py

# Terminal 2: รัน Next.js Dev Server (Port 3000)
npm run dev
```
เปิดเบราว์เซอร์ที่: **`http://localhost:3000/patient`**

---

## 📦 การ Build และ Run ในโหมด Production (Static Export)

ระบบจะคอมไพล์และ Export เว็บออกมาเป็นไฟล์ HTML/CSS/JS บริสุทธิ์ในโฟลเดอร์ `dist/`:

```powershell
# 1. ตรวจสอบ Type Safety
npm run typecheck

# 2. คอมไพล์โปรเจกต์สำหรับ Production
npm run build

# 3. รัน Static Server ด้วย Python
python -m http.server 5500 --bind 127.0.0.1 -d dist
```
เข้าใช้งานผ่านเบราว์เซอร์ได้ที่: **`http://127.0.0.1:5500`** หรือ **`http://127.0.0.1:5500/patient/`**  
*(ระบบมีสคริปต์ Auto-Redirect จากหน้า Root `/` ไปยัง `/patient/` ให้โดยอัตโนมัติ)*

---

## ⚙️ การตั้งค่าการเชื่อมต่อเซิร์ฟเวอร์ (Runtime Configuration)

ระบบอ่านค่าการตั้งค่าจาก `window.PATIENT_APP_ENV` ในไฟล์ `public/runtime-config.js` (และ `dist/patient/runtime-config.js`):

```javascript
window.PATIENT_APP_ENV = {
<<<<<<< HEAD
  "API_BASE_URL": "http://127.0.0.1:8000",       // เปลี่ยนเป็น Domain หลังบ้านเมื่อขึ้น Production
  "STATUS_REFRESH_MS": 10000,                    // ความถี่ในการดึงสถานะคิว (มิลลิวินาที)
  "GOOGLE_CLIENT_ID": "477244523835-vopgha7b47cohjn2ouk80ng1gsup5tl8.apps.googleusercontent.com"
=======
  apiBaseUrl: "http://127.0.0.1:8000",       // สลับไป https://hospital.bfirstkok.me เมื่อต่อเซิร์ฟเวอร์จริง
  statusRefreshMs: 10000,                    // ความถี่ในการอัปเดตสถานะคิวอัตโนมัติ (มิลลิวินาที)
  GOOGLE_CLIENT_ID: "your-google-oauth-web-client-id.apps.googleusercontent.com"
  seniorMode: false
>>>>>>> origin/main
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
│  │  ├─ auth/                 หน้าเข้าสู่ระบบ, Google OAuth 2.0, กู้คืนรหัสผ่าน OTP และระบบ PIN 6 หลัก
│  │  ├─ patient-profile/      ฟอร์มกรอกข้อมูลส่วนบุคคลและข้อมูลสุขภาพ
│  │  ├─ queue/                หน้าแสดงบัตรคิวสด, การคำนวณเวลารอ และระบบยกเลิกคิว
│  │  ├─ registration/         หน้าลงทะเบียนผู้ป่วยใหม่ และ PDPA Consent Gate
│  │  └─ settings/             หน้าตั้งค่า, โหมดผู้สูงอายุ (ใหญ่พิเศษ) และออกจากระบบ
│  └─ shared/                  โมดูลและคอมโพเนนต์ที่ใช้ร่วมกัน (API Client, UI, Icons, Data)
├─ tests/
│  └─ e2e/                     ชุดทดสอบ Playwright E2E Tests ครอบคลุม 32 เคส
├─ DEFENSE_QA_100_QUESTIONS.md เอกสารรวมแนวคำถาม-คำตอบ 100 ข้อสำหรับการสอบป้องกันโครงงาน
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
