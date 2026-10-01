# Mock คิวและประวัติบริการ

เทียบกับ Backend [Project_hospital_queue](https://github.com/bfirstkok/Project_hospital_queue/tree/49cf05090c289f39e08735aa3f50040eca25f89d) วันที่ 1 ตุลาคม 2026 โดยอ่าน `patients/views.py` และ `patients/models.py`.

## ข้อมูลที่ใช้ร่วมกัน

- `POST /api/patient/register/`: สร้างคิว `WAITING_VITALS` และเพิ่ม Visit ในประวัติทันที
- `GET /api/patient/queue/`: ส่งคิวที่ยังรับบริการอยู่ รวม `OPD_DONE`; หลัง `DISCHARGED` / `CANCELLED` ส่ง `queue_number: null`
- `GET /api/patient/me/`: `active_queue` และ `visits` มีสถานะ/ขั้นตอนชุดเดียวกับหน้าคิว
- `GET /api/patient/queue/<tracking_token>/`: ติดตาม Visit เดิมได้หลังยกเลิกและจองคิวใหม่
- `POST /api/patient/queue/cancel/`: อนุญาตเฉพาะสถานะที่ Backend อนุญาต เก็บประวัติไว้และยกเลิกซ้ำได้
- ลำดับคิวและจำนวนคนก่อนหน้าเป็น `null` เมื่อยังไม่ถึงขั้นตอนรอเรียกคิว
- นัดหมายใช้ `SCHEDULED` และเวลา `HH:MM` ตาม Backend

`patient_journey.steps` ใช้ key `registration`, `vitals`, `triage`, `queue`, `doctor`, `pharmacy`, `billing`, `complete` พร้อม `label`, `state`, `detail`.

## เวลา

Mock เพิ่ม `patient_journey.steps[].timestamp` เป็น ISO 8601 พร้อม timezone สำหรับเวลาเหตุการณ์ และ `registered_at` สำหรับเริ่มรับคิว. ขั้นตอนที่ยังไม่มีเหตุการณ์ส่ง `timestamp: null`. การ GET เปลี่ยนเฉพาะ `updated_at` ซึ่งเป็นเวลาเรียกข้อมูล ไม่เปลี่ยนเวลาประวัติ.

**Backend commit ที่อ้างอิงยังไม่มี `steps[].timestamp`**. ช่องนี้เป็นส่วนเพิ่มเติมเพื่อรองรับ UI ประวัติที่เพิ่งเพิ่ม และสอดคล้องกับสำเนา Backend `outputs/backend-review-20261001` ใน workspace. Frontend รับฟิลด์นี้แบบ optional; ถ้า Backend จริงไม่ส่งจะขึ้น “ยังไม่มีข้อมูลเวลา” ไม่ใช้ `updated_at` แทนเวลาเหตุการณ์. การแก้ mock ไม่ได้เพิ่มฟิลด์ให้ Backend บน GitHub หรือระบบที่ deploy อยู่.

เตรียม [Backend timestamp patch](BACKEND_QUEUE_TIMESTAMPS.patch) พร้อม regression test โดยใช้เวลา `registered_at`, workflow logs และเวลาในรายการยา/การเงิน. ตรวจ `git apply --check` ผ่านกับ commit ข้างต้นแล้ว; ยังไม่ได้รัน Django tests เพราะ workspace ไม่มี Django.

จาก checkout ของ Backend ที่ติดตั้ง dependencies แล้ว ตรวจการเปลี่ยนแปลงที่ค้างอยู่ก่อนใช้ patch:

```powershell
git status --short
git apply --check C:/Users/Acer/Desktop/Queue-Hostpital/docs/BACKEND_QUEUE_TIMESTAMPS.patch
git apply C:/Users/Acer/Desktop/Queue-Hostpital/docs/BACKEND_QUEUE_TIMESTAMPS.patch
python manage.py test patients.test_patient_portal_api --settings=config.test_settings
```

Patch เพิ่มฟิลด์ใน response โดยไม่แก้ schema ฐานข้อมูล. ถ้าต้องย้อนเฉพาะ patch และไฟล์ไม่มีการแก้ทับภายหลัง:

```powershell
git apply --reverse --check C:/Users/Acer/Desktop/Queue-Hostpital/docs/BACKEND_QUEUE_TIMESTAMPS.patch
git apply --reverse C:/Users/Acer/Desktop/Queue-Hostpital/docs/BACKEND_QUEUE_TIMESTAMPS.patch
```

## จำลองขั้นตอน

เปิดเฉพาะเครื่อง local ด้วย PowerShell:

```powershell
$env:MOCK_BACKEND_TEST_MODE = "1"
python mock_backend.py
```

ล็อกอินด้วยบัญชีตัวอย่าง `somchai99` / `Password@2026` แล้วใช้ access token ที่ได้รับ:

```powershell
$mockLogin = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/patient/login/ -ContentType application/json -Body '{"identifier":"somchai99","password":"Password@2026"}'
$mockHeaders = @{ Authorization = "Bearer $($mockLogin.access_token)" }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/__test__/queue/ -Headers $mockHeaders -ContentType application/json -Body '{"stage":"billing"}'
```

เปลี่ยน `stage` เป็น `waiting_vitals`, `waiting_confirmation`, `waiting_queue`, `called`, `billing`, `pharmacy`, `pharmacy_unpaid`, `ready_to_leave`, `discharged` แล้วกดอัปเดตสถานะคิวในหน้าเว็บ. แต่ละ stage เป็น snapshot จำลอง; การข้าม stage จะสร้างเวลาเหตุการณ์จำลองสำหรับขั้นตอนที่ผ่านแล้ว. ห้ามตีความเป็นประวัติผู้ป่วยจริง.

ทดสอบสมชายรอรับยาและค้างชำระพร้อมกัน:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/__test__/queue/ -Headers $mockHeaders -ContentType application/json -Body '{"stage":"pharmacy_unpaid"}'
```

ล็อกอิน `somchai99` / `Password@2026` แล้วเปิด “คิวของฉัน” หรือกด “อัปเดตสถานะคิว”. ขั้นตอนปัจจุบันเป็นห้องยา พร้อมป๊อปอัป “แจ้งเตือนค้างชำระเงิน” และข้อความให้ติดต่อห้องยา/การเงิน. กดรับทราบเพื่อดูบัตรคิว; ใน “ข้อมูลของฉัน” → “ประวัติการรักษา” จะแสดงสองรายการที่ยังไม่เสร็จ และยังจองคิวใหม่ไม่ได้.

จำลองว่าชำระแล้วแต่ยังรอรับยาโดยเปลี่ยนเป็น `pharmacy`; รับยาและชำระครบแต่รอปิดคิวใช้ `ready_to_leave`; เจ้าหน้าที่ปิดคิวสำเร็จใช้ `discharged`. การเริ่ม mock server ใหม่คืนคิวสมชายเป็น `waiting_vitals`; เรียกคำสั่งข้างต้นอีกครั้งเพื่อทดสอบซ้ำ.

`/__test__/queue/` ต้องมี Bearer token, เปิด test mode และเรียกจาก loopback เท่านั้น. ปิดโดยลบ environment variable แล้วเริ่ม server ใหม่:

```powershell
Remove-Item Env:MOCK_BACKEND_TEST_MODE
python mock_backend.py
```

คืนข้อมูลตัวอย่างเมื่ออยู่ใน test mode:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/__test__/reset/
```

ข้อมูลเป็น in-memory; ปิด server จะล้างข้อมูล. ระบบจำลองไม่ส่งคำสั่งไป Backend จริง.

## ตรวจสอบ

```powershell
python -m unittest discover -s tests -p test_mock_backend.py
npm run typecheck
npm run build
npx playwright test tests/e2e/mock-queue-history.spec.ts
```
