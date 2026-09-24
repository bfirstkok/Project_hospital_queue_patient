import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// การตั้งค่าชุดทดสอบ Unit Testing ด้วย Vitest
export default defineConfig({
  resolve: {
    alias: {
      // แมป path alias '@' ให้ชี้ไปที่โฟลเดอร์ ./src
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // จำลองสภาพแวดล้อมเบราว์เซอร์ (DOM / Window) ด้วย jsdom สำหรับทดสอบ React Components
    environment: "jsdom",
    // เปิดใช้งานตัวแปรโกลบอลของชุดทดสอบ เช่น describe, it, expect อัตโนมัติ
    globals: true,
    // ไฟล์ Setup สำหรับตั้งค่า Jest-DOM assertions ล่วงหน้า
    setupFiles: ["./tests/setup.ts"],
    // รูปแบบชื่อไฟล์ทดสอบที่ต้องการให้ Vitest ดำเนินการ
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
