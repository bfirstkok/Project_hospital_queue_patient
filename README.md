# Hospital Queue Patient Portal

เว็บสำหรับผู้ป่วยสแกน QR Code เพื่อลงทะเบียน เข้าสู่ระบบ ดูข้อมูลส่วนตัว ประวัติการรับบริการ นัดหมาย และติดตามสถานะคิว โดยข้อมูลถูกส่งไปยัง Backend ของ `Project_hospital_queue`

ผู้ป่วยเข้าสู่ระบบด้วยเลขบัตรประชาชน 13 หลักที่ใช้ลงทะเบียน ระบบจะเก็บโทเคนที่ลงลายเซ็นไว้เฉพาะในเบราว์เซอร์ของผู้ป่วย

## ตั้งค่า

แก้ `API_BASE_URL` ใน `config.js` ให้เป็นโดเมน HTTPS ของเว็บหลัก เช่น:

```js
window.PATIENT_APP_CONFIG = {
  API_BASE_URL: "https://hospital.example.com",
  STATUS_REFRESH_MS: 10000,
};
```

ฝั่งเว็บหลักต้องตั้งค่า environment variable ให้ยอมรับ origin ของเว็บผู้ป่วย:

```env
PATIENT_APP_ORIGINS=https://patient.example.com,https://bfirstkok.github.io
```

## ทดลองในเครื่อง

1. เปิดเว็บหลักที่ `http://127.0.0.1:8000`
2. ที่ repository นี้รัน `python -m http.server 5500`
3. เปิด `http://127.0.0.1:5500`

## API ที่ใช้

- `POST /api/patient/register/` ลงทะเบียนและสร้าง Visit สถานะ `WAITING_VITALS`
- `POST /api/patient/login/` ยืนยันเลขบัตรประชาชน
- `GET /api/patient/me/` อ่านข้อมูลส่วนตัว ประวัติ และนัดหมายด้วย Bearer token
- `GET /api/patient/queue/` อ่านสถานะคิวด้วย Bearer token

QR Code ควรชี้มาที่ URL หน้า `index.html` ของเว็บนี้
