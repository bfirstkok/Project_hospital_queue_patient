import { defineConfig, devices } from "@playwright/test";

// การตั้งค่าชุดทดสอบระบบแบบครอบคลุมทั้งระบบ (End-to-End Testing) ด้วย Playwright
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
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
});
