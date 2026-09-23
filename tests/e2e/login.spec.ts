import { test, expect } from "@playwright/test";

test.describe("Login System - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/patient");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test("1. Invalid password displays error banner and keeps user on login page", async ({ page }) => {
    await page.goto("/patient");

    // Enter valid username but incorrect password
    await page.fill("#login-identifier", "somchai99");
    await page.fill("#login-password", "WrongPassword123");
    await page.click("button[type='submit']");

    // Should display error alert
    await expect(page.locator(".alert")).toBeVisible();
    await expect(page.locator(".alert")).toContainText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

    // Ensure still on login page
    await expect(page.locator("h1")).toContainText("เข้าสู่ระบบผู้ป่วย");
  });

  test("2. Password visibility toggle switches input type between password and text", async ({ page }) => {
    await page.goto("/patient");

    const passwordInput = page.locator("#login-password");
    await passwordInput.fill("Password@2026");

    // Default should be password
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click toggle button to reveal password
    await page.click(".toggle-password-btn");
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click toggle button again to hide password
    await page.click(".toggle-password-btn");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("3. Login using 13-digit Thai National ID and setup PIN reaches Queue Portal", async ({ page }) => {
    await page.goto("/patient");

    // Fill national ID and password
    await page.fill("#login-identifier", "1234567890123");
    await page.fill("#login-password", "Password@2026");
    await page.click("button[type='submit']");

    // Step 1: Set a non-sequential PIN.
    await expect(page.locator(".pin-card h1")).toContainText("ตั้งรหัส PIN");
    for (const digit of ["1", "3", "5", "7", "9", "0"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Step 2: Confirm PIN
    await expect(page.locator(".pin-card h1")).toContainText("ยืนยันรหัส PIN");
    for (const digit of ["1", "3", "5", "7", "9", "0"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Lands on Queue portal
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".queue-number")).toContainText("A012");
  });

  test("4. Google OAuth login seamlessly signs in and routes to PIN setup", async ({ page }) => {
    await page.goto("/patient");

    const googleBtn = page.locator("button.google-sign-in-btn");
    if ((await googleBtn.count()) > 0) {
      await googleBtn.click();
      await expect(page.locator(".pin-card h1")).toContainText("ตั้งรหัส PIN");
      for (const digit of ["1", "3", "5", "7", "9", "0"]) {
        await page.click(`.keypad-btn:has-text('${digit}')`);
      }
      for (const digit of ["1", "3", "5", "7", "9", "0"]) {
        await page.click(`.keypad-btn:has-text('${digit}')`);
      }
      await expect(page.locator(".site-header")).toBeVisible();
    } else {
      await expect(page.locator(".alert")).toContainText("Google Sign-In ยังไม่ได้ตั้งค่า Client ID");
    }
  });

  test("5. Navigating to Registration and declining PDPA safely returns to Login page", async ({ page }) => {
    await page.goto("/patient");

    // Click register link
    await page.click("button.register-link-btn:has-text('ลงทะเบียนผู้ป่วยใหม่')");
    await expect(page.locator("h1")).toContainText("ข้อตกลงและนโยบายความเป็นส่วนตัว");

    // Click decline button
    await page.click("button.pdpa-decline-btn:has-text('ไม่ยินยอม / ย้อนกลับ')");

    // Should return back to login page
    await expect(page.locator("h1")).toContainText("เข้าสู่ระบบผู้ป่วย");
    await expect(page.locator("#login-identifier")).toBeVisible();
  });
});
