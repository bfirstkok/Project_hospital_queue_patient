import { defineConfig, devices } from "@playwright/test";

// การตั้งค่าชุดทดสอบระบบแบบครอบคลุมทั้งระบบ (End-to-End Testing) ด้วย Playwright
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // URL หลักสำหรับการทดสอบระบบ Frontend
    baseURL: "http://127.0.0.1:5500",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // กำหนดโปรไฟล์การทดสอบบนอุปกรณ์ต่างๆ (Desktop และ Mobile)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // ทดสอบมุมมองอุปกรณ์เคลื่อนที่ เพื่อรับประกัน Responsive Design สำหรับผู้ป่วย
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // เริ่มต้นเซิร์ฟเวอร์จำลองอัตโนมัติก่อนเริ่มรันชุดทดสอบ E2E
  webServer: [
    {
      // เซิร์ฟเวอร์ Backend จำลอง (Python HTTP Server พอร์ต 8000)
      command: "python mock_backend.py",
      port: 8000,
      reuseExistingServer: true,
      timeout: 15000,
      env: {
        PYTHONIOENCODING: "utf-8",
      },
    },
    {
      // เซิร์ฟเวอร์โฮสต์ไฟล์ Static HTML ของ Frontend (พอร์ต 5500)
      command: "python -m http.server 5500 --bind 127.0.0.1 -d dist",
      port: 5500,
      reuseExistingServer: true,
      timeout: 15000,
      env: {
        PYTHONIOENCODING: "utf-8",
      },
    },
  ],
});
