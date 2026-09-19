import { test, expect } from "@playwright/test";

test.describe("Hospital Queue Portal - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/patient");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test("1. Root URL redirects properly to /patient without crashing", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/patient/);
    await expect(page.locator("h1")).toContainText("เข้าสู่ระบบผู้ป่วย");
  });

  test("2. Forgot Password modal requests OTP and allows setting new password", async ({ page }) => {
    await page.goto("/patient");

    // Click "ลืมรหัสผ่าน?"
    await page.click("button:has-text('ลืมรหัสผ่าน?')");
    await expect(page.locator("#forgotPasswordTitle")).toContainText("ลืมรหัสผ่าน / กู้คืนบัญชี");

    // Fill identifier
    await page.fill(".forgot-password-modal input[name='identifier']", "somchai99");
    await page.click(".forgot-password-modal button[type='submit']");

    // Wait for step 2: OTP input
    await expect(page.locator("#forgotPasswordTitle")).toContainText("ยืนยันรหัส OTP");
    await page.fill(".forgot-password-modal input[name='otp']", "123456");
    await page.click(".forgot-password-modal button[type='submit']");

    // Wait for step 3: New password
    await expect(page.locator("#forgotPasswordTitle")).toContainText("ตั้งรหัสผ่านใหม่");
    await page.fill(".forgot-password-modal input[name='new_password']", "Password@2026");
    await page.fill(".forgot-password-modal input[name='confirm_password']", "Password@2026");
    await page.click(".forgot-password-modal button[type='submit']");

    // Should return to login with success message
    await expect(page.locator(".success-banner")).toBeVisible();
    await expect(page.locator(".success-banner")).toContainText("เปลี่ยนรหัสผ่านใหม่สำเร็จ");
  });

  test("3. Login with credentials and setup PIN 6 digits to reach Queue Portal", async ({ page }) => {
    await page.goto("/patient");

    // Fill login form
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Should navigate to PIN setup
    await expect(page.locator(".pin-card h1")).toContainText("ตั้งรหัส PIN");

    // Enter 6 digits: 1 2 3 4 5 6
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Step 2: Confirm PIN
    await expect(page.locator(".pin-card h1")).toContainText("ยืนยันรหัส PIN");
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Should successfully navigate into main Queue/Status View
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".queue-number")).toContainText("A012");
  });

  test("4. View active queue details and cancel queue flow", async ({ page }) => {
    await page.goto("/patient");

    // Login
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Enter PIN
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Verify active queue card
    await expect(page.locator(".queue-number")).toContainText("A012");

    // Click "ยกเลิกคิวรับบริการ"
    await page.click("button:has-text('ยกเลิกคิวรับบริการ')");

    // Verify step 1 of cancel modal
    await expect(page.locator("#cancelQueueTitle")).toContainText("ยกเลิกคิว");

    // Advance to step 2
    await page.click("button:has-text('ดำเนินการต่อ (ขั้นที่ 2)')");

    // Verify step 2 and confirm cancel
    await expect(page.locator("#cancelQueueTitle")).toContainText("ยืนยันการสละสิทธิ์คิว");
    await page.click("button:has-text('ยืนยันยกเลิกคิวทันที')");

    // Verify success banner and empty queue status
    await expect(page.locator(".success-banner")).toBeVisible();
    await expect(page.locator(".success-banner")).toContainText("ยกเลิกคิวรับบริการเรียบร้อยแล้ว");
    await expect(page.locator("text=ยังไม่มีคิวรับบริการในขณะนี้")).toBeVisible();
  });

  test("5. Patient Profile, Health, and Appointments Tabs", async ({ page }) => {
    await page.goto("/patient");

    // Login
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Enter PIN
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Navigate to "ข้อมูลของฉัน" via visible navbar button
    await page.click("button.nav-tab-btn:visible:has-text('ข้อมูลของฉัน')");
    await expect(page.locator("#accountView")).toBeVisible();
    await expect(page.locator(".account-heading h1")).toBeVisible();

    // Check tabs
    await page.click("button[role='tab']:has-text('รายการนัดหมาย')");
    await expect(page.locator("text=นัดตรวจติดตาม")).toBeVisible();

    await page.click("button[role='tab']:has-text('ประวัติการรักษา')");
    await expect(page.locator("text=ตรวจสุขภาพทั่วไป")).toBeVisible();
  });

  test("6. Senior Accessibility mode and font size switching", async ({ page }) => {
    await page.goto("/patient");

    // Login
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Enter PIN
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Navigate to "ตั้งค่า" via visible navbar button
    await page.click("button.nav-tab-btn:visible:has-text('ตั้งค่า')");
    await expect(page.locator("#settingsView h1")).toContainText("ตั้งค่า");

    // Click "ใหญ่พิเศษ (X-Large)"
    await page.click("button.font-setting-card:has-text('ใหญ่พิเศษ')");

    // Check dataset attribute on html
    const fontSizeAttr = await page.evaluate(() => document.documentElement.dataset.fontSize);
    expect(fontSizeAttr).toBe("xlarge");
  });

  test("7. Logout clears session and returns to login", async ({ page }) => {
    await page.goto("/patient");

    // Login
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Enter PIN
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Navigate to "ตั้งค่า" via visible navbar button
    await page.click("button.nav-tab-btn:visible:has-text('ตั้งค่า')");

    // Click "ออกจากระบบ"
    await page.click("button:has-text('ออกจากระบบ')");

    // Should return to login page
    await expect(page.locator("h1")).toContainText("เข้าสู่ระบบผู้ป่วย");
  });
});

