# ความแตกต่างเชิงสถาปัตยกรรมระหว่าง .env (Build-time) และ Runtime Config ใน Next.js Static Export

บันทึกความเข้าใจเรื่องการแยกส่วนการตั้งค่าระหว่าง Environment Variables ในเครื่องนักพัฒนา (`.env`) กับการส่งต่อค่าไปยัง Browser ของผู้ใช้งานผ่าน `window.PATIENT_APP_ENV` (`runtime-config.js`) การทำความเข้าใจจุดนี้ช่วยปลดล็อกข้อจำกัดของ Next.js โหมด `output: export` ที่ไม่สามารถอ่าน `process.env` ขณะทำงานจริงบนเครื่องคนไข้ได้ และบรรลุหลักการ "Build Once, Deploy Anywhere"
