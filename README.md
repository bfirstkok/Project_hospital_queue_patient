# Hospital Queue Patient Portal

เว็บผู้ป่วยสำหรับลงทะเบียน ติดตามคิว และดูประวัติบริการ OPD. ใช้ Next.js `16.3.0`, React `19.2.8` และ TypeScript `5.9.3`. Build เป็น Static Export ที่ `/patient/` และเรียก REST API ของ Django โดยตรง.

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

## เริ่มใช้งาน

ต้องมี Node.js `20.9+` และ Python สำหรับ mock/static server.

```powershell
npm install
Copy-Item .env.example .env
```

ตั้ง `.env` สำหรับ local mock:

```dotenv
PATIENT_API_BASE_URL=http://127.0.0.1:8000
PATIENT_STATUS_REFRESH_MS=10000
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

```powershell
# Terminal 1
python mock_backend.py

# Terminal 2
npm run dev
```

เปิด `http://localhost:3000/patient/`. สำหรับ Backend จริงเปลี่ยน `PATIENT_API_BASE_URL` เป็น URL ของ Backend. URL ภายนอกเครื่อง local ต้องเป็น HTTPS.

`npm run dev` และ `npm run build` สร้าง `public/runtime-config.js` จาก `.env`. หลังเปลี่ยนค่าให้เริ่ม dev server ใหม่ หรือรัน `node scripts/write-runtime-config.mjs` แล้วรีเฟรช. หากใช้ `dist/` ให้ build ใหม่. `.env` และ runtime config ที่สร้างอัตโนมัติไม่ถูก commit.

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

`npm run build` สร้าง `out/` และจัดไฟล์พร้อมโฮสต์ไว้ใน `dist/`:

```powershell
python -m http.server 5500 --bind 127.0.0.1 -d dist
```

เปิด `http://127.0.0.1:5500/patient/`. หน้า root redirect ไป `/patient/`. อัปโหลดเนื้อหา `dist/` ไปยัง static host ที่รองรับ path นี้; Frontend ยังต้องเชื่อมต่อ Backend API.

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
