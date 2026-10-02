# Hospital Queue Patient Portal

เว็บผู้ป่วยสำหรับลงทะเบียน ติดตามคิว และดูประวัติบริการ OPD. ใช้ Next.js `16.3.0`, React `19.2.8` และ TypeScript `5.9.3`. Build เป็น Static Export ที่ `/patient/` และเรียก REST API ของ Django โดยตรง.

README นี้อ้างอิงโค้ดใน repository ณ วันที่ 2 ตุลาคม 2026. Backend และระบบเจ้าหน้าที่เป็นอีกโปรเจกต์หนึ่ง; การติดตั้ง Frontend ไม่ได้ติดตั้ง Django หรือฐานข้อมูลด้วย.

## สารบัญ

- [ติดตั้งและเปิดเว็บบนเครื่อง](#ติดตั้งและเปิดเว็บบนเครื่อง)
- [ตั้งค่าเชื่อมต่อ API](#ตั้งค่าเชื่อมต่อ-api)
- [วิธีใช้งานสำหรับผู้ป่วย](#วิธีใช้งานสำหรับผู้ป่วย)
- [Mock Backend](#mock-backend)
- [Google Sign-In](#google-sign-in)
- [Build และตรวจสอบ](#build-และตรวจสอบ)
- [นำไปโฮสต์](#นำไปโฮสต์)
- [แก้ปัญหาเบื้องต้น](#แก้ปัญหาเบื้องต้น)
- [เอกสารเพิ่มเติม](#เอกสารเพิ่มเติม)

## ฟีเจอร์ปัจจุบัน

- ลงทะเบียนข้อมูลส่วนตัว สุขภาพ อาการ และผู้ติดต่อฉุกเฉิน พร้อมความยินยอม PDPA
- เข้าสู่ระบบด้วยบัญชีผู้ป่วยหรือ Google และยืนยันด้วย PIN 6 หลัก
- กู้รหัสผ่าน/PIN ด้วย OTP ทางอีเมล โดยให้ Backend ตรวจสอบและออก reset token
- แสดงบัตรคิว ลำดับ ห้องตรวจ ขั้นตอนบริการ และประมาณการเวลารอ
- แจ้งเตือนด้วยเสียง/การสั่นเมื่อใกล้ถึงคิว และยกเลิกคิวที่ Backend อนุญาตได้
- แสดงเวลาเรียกข้อมูลล่าสุดมุมซ้ายบนบัตรคิว พร้อมเวลาเริ่มรับคิวและจุดบริการล่าสุดด้านล่าง
- เปิดดูประวัติคิวพร้อม timestamp: ลงทะเบียน วัดสัญญาณชีพ คัดกรอง เรียกคิว ตรวจ ห้องยา การเงิน และจบบริการ
- แจ้งเตือนค้างชำระเงิน และแจ้งเมื่อรับยา/ชำระเงินครบแต่คิวยังไม่ปิด ทั้งหน้าคิวและประวัติการรักษา
- เก็บคิวที่ยังไม่เสร็จสิ้นแม้เป็นคิวจากวันก่อน และป้องกันการจองใหม่จน Backend ยืนยันว่าคิวเดิมสิ้นสุดแล้ว
- ดู/แก้ข้อมูลผู้ป่วย ดูผลตรวจ สัญญาณชีพ นัดหมาย และบันทึกนัดหมายเป็นไฟล์ `.ics`
- รองรับมือถือ เดสก์ท็อป และการปรับขนาดตัวอักษร

## การแจ้งเตือนค้างชำระและคิวยังไม่ปิด

สถานะจาก Backend เป็นข้อมูลอ้างอิงหลัก. `OPD_DONE` หมายถึงตรวจเสร็จ แต่ยังอาจมีขั้นตอนห้องยา/การเงินและการปิดคิว.

| เงื่อนไข | สิ่งที่แสดง |
|---|---|
| การเงินเป็น `current` และรายละเอียด `รอชำระเงิน` | ข้อความและป๊อปอัปให้ไปชำระเงิน |
| การเงินยัง `รอสรุปค่าใช้จ่าย` | แสดงว่ารอสรุปค่าใช้จ่าย โดยไม่กล่าวว่าค้างชำระ |
| รับยา/ชำระเงินเป็น `done` หรือ `skipped` แต่สถานะคิวยังเปิดอยู่ | แจ้งให้ติดต่อเจ้าหน้าที่เพื่อปิดคิว |
| Backend ส่ง `DISCHARGED` หรือ `CANCELLED` | ยกเลิกการแจ้งเตือนและอนุญาตจองใหม่ |

กด “รับทราบและดูคิวเดิม” เพื่อปิดป๊อปอัป. การรีเฟรชในหน้านั้นไม่เปิดป๊อปอัปเดิมซ้ำ แต่ยังแสดงข้อความที่ต้องดำเนินการ. กด “ดูคิวที่กำลังรับบริการ” เพื่อเปิดรายละเอียดอีกครั้ง. ประวัติมีสรุป “คิวที่ยังไม่เสร็จสิ้น” พร้อมวันที่ ขั้นตอน และคำแนะนำ.

“คิวยังไม่ปิด” หมายถึง Backend ยังไม่ยืนยันว่าจบบริการ ไม่ใช่การสรุปว่าเซิร์ฟเวอร์เกิดข้อผิดพลาด. Frontend ไม่ปิดคิวแทนเจ้าหน้าที่.

## เวลาและข้อมูล API

- `updated_at`: เวลา API ส่งข้อมูลล่าสุด ใช้แสดงมุมซ้ายบนบัตรคิว
- `registered_at` หรือ timestamp ขั้นตอน `registration`: เวลาเริ่มรับคิว
- `patient_journey.steps[].timestamp`: เวลาเหตุการณ์ ใช้เรียงประวัติและเลือกจุดล่าสุด
- แสดงเวลาใน `Asia/Bangkok`; รีเฟรชไม่เปลี่ยนเวลาเหตุการณ์
- ถ้าไม่มีเวลาเหตุการณ์จะแสดง “ยังไม่มีข้อมูลเวลา” โดยไม่ใช้เวลา polling แทน

เทียบสัญญาคิว/ประวัติกับ [Backend commit `49cf050`](https://github.com/bfirstkok/Project_hospital_queue/tree/49cf05090c289f39e08735aa3f50040eca25f89d) วันที่ 1 ตุลาคม 2026. Commit นี้ยังไม่มี timestamp รายขั้นตอน. Mock รองรับแล้ว และมี [Backend patch](docs/BACKEND_QUEUE_TIMESTAMPS.patch) พร้อม regression test. ดูวิธีใช้และขอบเขตการตรวจสอบใน [คู่มือ Mock คิว](docs/MOCK_QUEUE_API.md). ต้องนำ patch ไปใช้และทดสอบใน Backend ก่อน deploy.

## ติดตั้งและเปิดเว็บบนเครื่อง

ต้องมี Git, Node.js `20.9+` พร้อม npm และ Python 3 สำหรับ mock/static server. Mock ใช้ Python standard library จึงไม่ต้องติดตั้ง Django หรือใช้ `pip install`. คำสั่งตัวอย่างใช้ PowerShell และรันจากโฟลเดอร์โปรเจกต์.

### 1. ดาวน์โหลดและติดตั้ง dependencies

```powershell
git clone https://github.com/bfirstkok/Project_hospital_queue_patient.git
cd Project_hospital_queue_patient
npm install
Copy-Item .env.example .env
```

ถ้ามี checkout อยู่แล้ว ให้เปิด terminal ในโฟลเดอร์นั้นแล้วเริ่มที่ `npm install`. สร้าง `.env` เฉพาะเมื่อยังไม่มีไฟล์ เพื่อไม่เขียนทับค่าที่ใช้อยู่.

### 2. ตั้งค่า local mock

แก้ `.env` ให้เป็นค่าต่อไปนี้ก่อนเปิดเว็บ เพราะ `.env.example` ตั้ง API ปลายทางเป็น `https://hospital.bfirstkok.me`:

```dotenv
PATIENT_API_BASE_URL=http://127.0.0.1:8000
PATIENT_STATUS_REFRESH_MS=10000
GOOGLE_CLIENT_ID=
```

ปล่อย `GOOGLE_CLIENT_ID` ว่างได้เมื่อทดลองด้วยบัญชี mock; ถ้าต้องการ Google Sign-In ให้ใช้ Client ID จริงตามหัวข้อด้านล่าง.

### 3. เปิด Backend และ Frontend

เปิด terminal สองหน้าต่างในโฟลเดอร์โปรเจกต์:

```powershell
# Terminal 1
python mock_backend.py
```

```powershell
# Terminal 2
npm run dev
```

เปิด [เว็บบนเครื่อง](http://localhost:3000/patient/) แล้วเข้าสู่ระบบด้วย `somchai99` / `Password@2026`. ครั้งแรกให้ตั้ง PIN 6 หลักและกรอกซ้ำเพื่อยืนยัน จากนั้นจะเปิดหน้าคิว. กด `Ctrl+C` ในแต่ละ terminal เมื่อต้องการหยุด server.

Mock ไม่ขยับขั้นตอนคิวเอง; ใช้ test mode และคำสั่งจำลองใน [คู่มือ Mock คิว](docs/MOCK_QUEUE_API.md#จำลองขั้นตอน) เมื่อต้องการทดลองการเรียกคิว ห้องยา หรือการเงิน.

## ตั้งค่าเชื่อมต่อ API

| ตัวแปรใน `.env` | หน้าที่ |
|---|---|
| `PATIENT_API_BASE_URL` | origin ของ Backend เช่น `http://127.0.0.1:8000` ไม่ต้องต่อ `/api/patient/` |
| `PATIENT_STATUS_REFRESH_MS` | รอบ polling คิว หน่วยมิลลิวินาที; ค่าเริ่มต้น `10000` หรือ 10 วินาที |
| `GOOGLE_CLIENT_ID` | Client ID สำหรับ Google Sign-In; ปล่อยว่างได้ถ้าไม่ใช้ |

สำหรับ Backend จริงเปลี่ยน `PATIENT_API_BASE_URL` เป็น URL ของ Backend ที่ต้องการ. URL ภายนอก `localhost` และ `127.0.0.1` ต้องเป็น HTTPS. ถ้า Frontend และ Backend อยู่คนละ origin ต้องตั้ง CORS ฝั่ง Backend ให้รับ origin ของ Frontend รวมทั้ง `Authorization` header.

`npm run dev` และ `npm run build` สร้าง `public/runtime-config.js` จาก `.env`. หลังเปลี่ยนค่าให้เริ่ม dev server ใหม่ หรือรัน `node scripts/write-runtime-config.mjs` แล้วรีเฟรช. หากใช้ `dist/` ให้ build ใหม่. `.env` และ runtime config ที่สร้างอัตโนมัติไม่ถูก commit.

ค่าจาก environment ของ terminal มีลำดับก่อน `.env`; ถ้าไม่ได้กำหนดค่า สคริปต์อาจใช้ runtime config ที่สร้างไว้ก่อนหน้า. จึงควรกำหนด URL ของ API ให้ชัดเจนทุกครั้งที่เปลี่ยน environment. Runtime config ส่งถึง browser และมีเฉพาะค่าที่เปิดเผยได้; ห้ามใส่ SMTP password หรือ secret ลงในไฟล์นี้.

## วิธีใช้งานสำหรับผู้ป่วย

### สมัครบัญชีและรับคิว

1. เปิด `/patient/` แล้วเลือกลงทะเบียนจากหน้าเข้าสู่ระบบ.
2. อ่านและยอมรับข้อตกลง PDPA เพื่อเปิดแบบฟอร์มลงทะเบียน.
3. กรอกข้อมูลบัญชี ข้อมูลผู้ป่วย ที่อยู่ สุขภาพ ผู้ติดต่อฉุกเฉิน และอาการครั้งนี้ ตรวจสอบข้อมูลแล้วส่งแบบฟอร์ม.
4. เมื่อสมัครสำเร็จ ให้ตั้ง PIN 6 หลักและยืนยันซ้ำ แล้วดูบัตรคิวที่ได้รับ.

ผู้ป่วยที่มีบัญชีแล้วให้เข้าสู่ระบบก่อนจองคิวครั้งใหม่. ระบบจะใช้ข้อมูลเดิมและให้ระบุอาการครั้งนี้; หากยังมีคิวไม่เสร็จสิ้น จะพาไปดูคิวเดิมและไม่ให้จองซ้ำ.

### เข้าสู่ระบบและกู้คืนบัญชี

- กรอกชื่อผู้ใช้/อีเมลและรหัสผ่าน หรือเลือก Google เมื่อผู้ดูแลตั้งค่าแล้ว. ผู้ใช้ Google รายใหม่ต้องกรอกข้อมูลผู้ป่วยให้ครบก่อนรับคิว.
- หลัง login ให้ตั้ง PIN หาก browser ยังไม่มี PIN ของบัญชีนั้น หรือยืนยัน PIN ที่ตั้งไว้ก่อนแล้ว.
- หากลืมรหัสผ่าน เลือก “ลืมรหัสผ่าน?” แล้วทำขั้นตอนขอ OTP ทางอีเมล ยืนยัน OTP และตั้งรหัสผ่านใหม่.
- เปลี่ยนหรือกู้คืน PIN ได้จากหน้า “ตั้งค่า”; การกู้คืนใช้ OTP ทางอีเมลที่ลงทะเบียนไว้.

### ติดตามคิว

1. เปิด “คิวของฉัน” เพื่อดูหมายเลขคิว ห้องตรวจ จำนวนคิวก่อนหน้า และขั้นตอนบริการจาก Backend.
2. ระบบอัปเดตตามรอบ polling; กด “อัปเดตสถานะคิว” เมื่อต้องการดึงข้อมูลทันที.
3. เปิดเสียง/การสั่นบนบัตรคิวเพื่อรับการแจ้งเตือนเมื่อใกล้ถึงคิว. ความสามารถนี้ขึ้นกับ browser และอุปกรณ์; ควรเปิดหน้าเว็บไว้ระหว่างรอ.
4. กด “บันทึกบัตรคิวเป็นรูปภาพ” เพื่อเก็บบัตรคิวลงเครื่อง หรือเลือกยกเลิกคิวแล้วทำตามหน้าต่างยืนยันเมื่อ Backend อนุญาต.
5. ถ้ามีข้อความค้างชำระหรือคิวรอปิด ให้ติดต่อจุดบริการตามข้อความ. ตรวจเสร็จไม่ได้หมายความว่าคิวปิดแล้ว.

### ข้อมูลผู้ป่วย ประวัติ และนัดหมาย

เปิด “ข้อมูลของฉัน” เพื่อดูหรือแก้โปรไฟล์ ดูประวัติการรักษา ผลตรวจ สัญญาณชีพ และนัดหมายที่ Backend ส่งมา. ประวัติแสดงขั้นตอนพร้อมเวลาเมื่อ API มีข้อมูล; นัดหมายบันทึกเป็นไฟล์ `.ics` เพื่อนำเข้าแอปปฏิทินได้.

หน้า “ตั้งค่า” ใช้ปรับขนาดตัวอักษร จัดการ PIN และออกจากระบบ. การออกจากระบบล้างเซสชันของเว็บ แต่ไม่ยกเลิกคิวใน Backend.

## Mock Backend

บัญชีตัวอย่าง: `somchai99` / `Password@2026`, เลขบัตร `1234567890123`. ยังไม่ได้ตั้ง PIN; ตั้งในหน้าเว็บหลัง login. ข้อมูลเป็น in-memory และคืนค่าเมื่อเริ่ม server ใหม่. ใช้กับข้อมูลจำลองเท่านั้น.

Mock ส่งข้อมูลคิว ประวัติ และลิงก์ติดตาม Visit เดียวกัน เก็บประวัติหลังยกเลิก/จบบริการ และจำลองการเงิน/ห้องยาได้. ดู stage และคำสั่งใน [คู่มือ Mock คิว](docs/MOCK_QUEUE_API.md).

ทดสอบสมชายรอรับยาและค้างชำระพร้อมกันด้วย stage `pharmacy_unpaid`: หน้าคิวแสดงป๊อปอัปค้างชำระและข้อความให้ติดต่อห้องยา/การเงิน ประวัติแสดงทั้งสองขั้นตอนที่ยังไม่เสร็จ. ดู [วิธีตั้งกรณีทดสอบ](docs/MOCK_QUEUE_API.md#จำลองขั้นตอน). หลังเริ่ม mock ใหม่ต้องตั้ง stage อีกครั้ง.

โหมดทดสอบ local ใช้ OTP `123456` และไม่ส่งอีเมลจริง:

```powershell
$env:MOCK_BACKEND_TEST_MODE = "1"
python mock_backend.py
```

`/__test__/reset/` และ `/__test__/queue/` เปิดเฉพาะ test mode จาก loopback; การเปลี่ยนขั้นตอนต้องมี Bearer token. ปิด test mode โดยลบ environment variable แล้วเริ่ม server ใหม่.

โหมดปกติต้องกำหนด SMTP ใน `.env` เพื่อส่ง OTP:

```dotenv
MOCK_PATIENT_EMAIL=your-inbox@example.com
MOCK_SMTP_HOST=smtp.example.com
MOCK_SMTP_PORT=587
MOCK_SMTP_USER=your-smtp-user
MOCK_SMTP_PASSWORD=your-smtp-app-password
MOCK_SMTP_FROM=your-smtp-user
```

พอร์ต `587` ใช้ STARTTLS และ `465` ใช้ SSL. ส่งไม่สำเร็จจะตอบ `503`. OTP หมดอายุใน 5 นาที และ reset token ใช้ครั้งเดียว. เก็บรหัส SMTP ใน `.env` เท่านั้น.

## Google Sign-In

Frontend และ Backend ต้องใช้ `GOOGLE_CLIENT_ID` ตรงกัน และตั้ง Authorized JavaScript origins ให้ตรงกับ origin ที่เปิดเว็บ เช่น `http://localhost:3000`, `http://127.0.0.1:5500` หรือ `https://hospital.bfirstkok.me` โดยไม่ใส่ path `/patient/`.

Backend ต้องตรวจ token กับ Google. ข้อมูลที่เติมอัตโนมัติเป็นชื่อและอีเมลที่ Google อนุญาต; ผู้ป่วยกรอกเบอร์โทร ที่อยู่ และข้อมูลสุขภาพเอง. Mock โหมดปกติไม่รับ token ปลอม.

## Build และตรวจสอบ

```powershell
npm run lint
npm run typecheck
npm test
python -m unittest discover -s tests -p test_mock_backend.py
npm run build
npm run test:e2e
```

Playwright เปิด mock backend ใน test mode ที่พอร์ต `8001` และ static server ที่ `5500` ให้อัตโนมัติ ใช้ `dist/` จาก build ล่าสุด ทดสอบทั้ง Desktop Chrome และ Pixel 7. ติดตั้ง browser ก่อนครั้งแรก:

```powershell
npx playwright install chromium
```

ทดสอบเฉพาะการแจ้งเตือนและประวัติ:

```powershell
npx playwright test tests/e2e/pending-queue.spec.ts tests/e2e/queue-history.spec.ts tests/e2e/mock-queue-history.spec.ts
```

### คำสั่ง npm

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | สร้าง runtime config แล้วเปิด Next.js dev server |
| `npm run build` | สร้าง runtime config, build static export และจัดไฟล์ลง `dist/` |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
| `npm run typecheck` | ตรวจ TypeScript โดยไม่สร้างไฟล์ JavaScript |
| `npm test` | รัน Vitest ใน `src/` |
| `npm run test:e2e` | รัน Playwright ทั้ง desktop และ mobile |
| `npm run test:e2e:ui` | เปิด Playwright UI สำหรับเลือกและดูผลทดสอบ |

## นำไปโฮสต์

ตั้ง `.env` ให้ชี้ Backend ที่จะใช้งานจริง แล้วรัน `npm run build`. ระหว่าง build Next.js สร้าง `out/`; สคริปต์ publish คัดลอกไฟล์ไป `dist/` และ `dist/patient/` แล้วลบ `out/`. ไฟล์ที่พร้อมนำไปโฮสต์จึงอยู่ใน `dist/`.

ทดลองเปิด static export บนเครื่อง:

```powershell
python -m http.server 5500 --bind 127.0.0.1 -d dist
```

เปิด `http://127.0.0.1:5500/patient/`. หน้า root redirect ไป `/patient/`. อัปโหลดเนื้อหา `dist/` ไปยัง static host ที่รองรับ path นี้; Frontend ยังต้องเชื่อมต่อ Backend API.

ให้ document root ของ static host ชี้ที่ `dist/` เพื่อให้เสิร์ฟ `/patient/` และไฟล์ assets ได้ครบ. หลังเปลี่ยน `.env` ต้อง build และนำไฟล์ขึ้นโฮสต์ใหม่; static host ไม่อ่าน `.env` ขณะให้บริการ. โปรเจกต์ไม่มี script `npm start` และไม่ต้องรัน Next.js server สำหรับ static export.

## แก้ปัญหาเบื้องต้น

| อาการ | วิธีตรวจและแก้ |
|---|---|
| เรียก API ไม่ได้ / `Failed to fetch` | ตรวจว่า Backend เปิดอยู่ และค่า `PATIENT_API_BASE_URL` ถูกต้อง; ดู Network ใน DevTools เพื่อตรวจ CORS หรือ HTTPS |
| เว็บ local ไปเรียก Backend จริง | แก้ URL ใน `.env` แล้วเริ่ม `npm run dev` ใหม่; static export ต้อง build ใหม่ |
| หน้าเว็บหรือ assets เป็น 404 | เปิด `/patient/`; ถ้าใช้ static server ให้เสิร์ฟจาก `dist/` หลัง build |
| Google ใช้ไม่ได้ | ตรวจ Client ID จริงทั้งสองฝั่งและ Authorized JavaScript origins; ค่า placeholder ใน `.env.example` ใช้ login ไม่ได้ |
| ขอ OTP แล้วได้ `503` | ถ้าใช้ mock โหมดปกติ ตรวจ SMTP ใน `.env`; ทดลอง OTP จำลองด้วย test mode ได้โดยไม่ส่งอีเมล |
| จองคิวใหม่ไม่ได้ | ตรวจคิวที่ยังไม่เสร็จสิ้น รวมถึงคิววันก่อน; ต้องให้ Backend ยืนยัน `DISCHARGED` หรือ `CANCELLED` |
| ประวัติไม่แสดงเวลาแต่ละขั้นตอน | API ต้องส่ง `patient_journey.steps[].timestamp`; `updated_at` เป็นเวลาเรียกข้อมูลและใช้แทนเวลาเหตุการณ์ไม่ได้ |
| Playwright เปิด server ไม่ได้ | ตรวจว่า `python` อยู่ใน PATH, build แล้ว และพอร์ต `8001` / `5500` ไม่ถูกใช้งาน |

## โครงสร้างหลัก

| ตำแหน่ง | หน้าที่ |
|---|---|
| `src/app/` | ควบคุมหน้าและสถานะร่วม, layout, CSS |
| `src/features/queue/` | บัตรคิว, polling, ประวัติ timestamp และแจ้งเตือน |
| `src/features/account/` | ข้อมูลผู้ป่วย ประวัติ ผลตรวจ และนัดหมาย |
| `src/features/auth/` | Login, Google, PIN และ OTP |
| `src/features/registration/`, `patient-profile/` | ลงทะเบียนและฟอร์มข้อมูล |
| `src/shared/api/` | API client และ TypeScript contracts |
| `mock_backend.py` | จำลอง Patient API บนเครื่อง local |
| `scripts/` | runtime config และ static export |
| `tests/` | HTTP tests และ Playwright |
| `docs/MOCK_QUEUE_API.md` | สัญญาข้อมูล ขั้นตอนจำลอง และ Backend patch |

Access token ใหม่เก็บใน `sessionStorage` และใช้ `Authorization: Bearer`. Backend ต้องตรวจสิทธิ์และสถานะคิว; PIN และสถานะใน browser ไม่ทดแทนการตรวจสิทธิ์ของ API.

## เอกสารเพิ่มเติม

- [สัญญา Backend API](docs/BACKEND_API_SPEC.md) และ [งานที่ต้องส่งต่อ Backend](docs/BACKEND_HANDOFF.md)
- [คู่มือ Mock คิวและการจำลองขั้นตอน](docs/MOCK_QUEUE_API.md)
- [Backend patch สำหรับเวลาแต่ละขั้นตอน](docs/BACKEND_QUEUE_TIMESTAMPS.patch)
- [ภาพรวมสถาปัตยกรรม](docs/ARCHITECTURE.md) สำหรับตำแหน่งโค้ดและทิศทาง dependencies; รายละเอียด login/PIN ในเอกสารนี้บางส่วนเป็นข้อมูลเดิม ให้เทียบกับโค้ดปัจจุบัน
- [บทเรียน runtime config](docs/lessons/0003-env-vs-runtime-config.html) และ [ขั้นตอน build กับ dist](docs/lessons/0005-build-pipeline-and-dist-folder.html)
