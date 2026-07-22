# Hospital Queue Patient Portal

เว็บสำหรับผู้ป่วยสแกน QR Code เพื่อลงทะเบียน เข้าสู่ระบบ ดูข้อมูลส่วนตัว ประวัติการรับบริการ นัดหมาย และติดตามสถานะคิว โดยข้อมูลถูกส่งไปยัง Backend ของ `Project_hospital_queue`

ผู้ป่วยเข้าสู่ระบบด้วยเลขบัตรประชาชน 13 หลักที่ใช้ลงทะเบียน ระบบจะเก็บ access token อายุจำกัดไว้เฉพาะในเบราว์เซอร์ของผู้ป่วย

## ตั้งค่า

URL production ของ Backend อยู่ใน `runtime-config.js` แยกจาก application code และไม่มี localhost ฝังอยู่ใน `app.js`

สำหรับ environment อื่น ให้สร้างไฟล์ deploy จาก environment variable ด้วยคำสั่ง:

```powershell
$env:PATIENT_API_BASE_URL="https://hospital.example.com"
npm run build
```

ไฟล์พร้อม deploy จะอยู่ใน `dist/` และ `runtime-config.js` จะถูกสร้างจาก environment โดยอัตโนมัติ URL ที่ไม่ใช่ local development ต้องใช้ HTTPS

ฝั่งเว็บหลักต้องตั้งค่า environment variable ให้ยอมรับ origin ของเว็บผู้ป่วย:

```env
PATIENT_APP_ORIGINS=https://patient.example.com,https://bfirstkok.github.io
```

## ทดลองในเครื่อง

1. เปิดเว็บหลักที่ `http://127.0.0.1:8000`
2. ตั้ง `$env:PATIENT_API_BASE_URL="http://127.0.0.1:8000"` แล้วรัน `npm run build`
3. เข้าโฟลเดอร์ `dist` แล้วรัน `python -m http.server 5500`
4. เปิด `http://127.0.0.1:5500`

## API ที่ใช้

- `POST /api/patient/register/` ลงทะเบียน สร้าง Visit สถานะ `WAITING_VITALS` และคืนทั้ง tracking token กับ access token
- `POST /api/patient/login/` รับ `national_id` และคืน access token
- `GET /api/patient/me/` อ่านข้อมูลส่วนตัว ประวัติ และนัดหมายด้วย Bearer token
- `GET /api/patient/queue/` อ่านสถานะคิวด้วย Bearer token

QR Code ควรชี้มาที่ URL หน้า `index.html` ของเว็บนี้
