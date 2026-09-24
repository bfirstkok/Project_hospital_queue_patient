import type { NextConfig } from "next";

// การตั้งค่าคอนฟิกสำหรับ Next.js
const nextConfig: NextConfig = {
  // สร้างผลลัพธ์แบบ Static HTML Export (โฟลเดอร์ out) ทำให้สามารถนำไปโฮสต์บน Static Web Server / S3 / Nginx ได้โดยตรง
  output: "export",
  // กำหนด Subpath เริ่มต้นของเว็บแอปพลิเคชันเป็น /patient เพื่อรองรับโครงสร้าง URL ภายใต้ Reverse Proxy ของโรงพยาบาล
  basePath: "/patient",
};

export default nextConfig;
