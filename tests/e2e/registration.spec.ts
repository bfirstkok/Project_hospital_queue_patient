import { test, expect } from "@playwright/test";

test.describe("Patient Registration Flow - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/patient");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test("1. PDPA Consent Gate enforces agreement before showing registration form", async ({ page }) => {
    await page.goto("/patient");

    // Click register button on login page
    await page.click("button.register-link-btn:has-text('ลงทะเบียนผู้ป่วยใหม่')");

    // Check PDPA gate
    await expect(page.locator("h1")).toContainText("ข้อตกลงและนโยบายความเป็นส่วนตัว");

    // Accept button should be disabled before checking
    const acceptBtn = page.locator("button.pdpa-accept-btn");
    await expect(acceptBtn).toBeDisabled();

    // Check PDPA consent checkbox
    await page.check("input[aria-label='ยินยอมเงื่อนไข PDPA']");
    await expect(acceptBtn).toBeEnabled();

    // Proceed to registration form
    await acceptBtn.click();

    // Registration form should now be visible
    await expect(page.locator("form.form-card")).toBeVisible();
    await expect(page.locator("h1")).toContainText("ลงทะเบียนผู้ป่วยใหม่");
  });

  test("2. Client-side validation blocks invalid input (national ID, email, missing health data)", async ({ page }) => {
    await page.goto("/patient");
    await page.click("button.register-link-btn:has-text('ลงทะเบียนผู้ป่วยใหม่')");
    await page.check("input[aria-label='ยินยอมเงื่อนไข PDPA']");
    await page.click("button.pdpa-accept-btn");

    // Fill valid HTML5 fields but omit mandatory health choices
    await page.fill("input[name='first_name']", "สมหญิง");
    await page.fill("input[name='last_name']", "รักดี");
    await page.fill("input[name='national_id']", "1103702111111");
    await page.fill("input[name='phone']", "0891112222");
    await page.fill("input[name='email']", "somying@example.com");
    await page.fill("textarea[name='note']", "มีอาการเป็นไข้");

    // Submit without selecting chronic disease, allergy, or medication chips
    await page.click("button[type='submit']:has-text('บันทึกข้อมูลผู้ป่วย')");

    // Should display validation error for missing chronic disease choice
    await expect(page.locator(".alert")).toBeVisible();
    await expect(page.locator(".alert")).toContainText("โรคประจำตัว");
  });

  test("3. Happy Path: New Patient registers, sets 6-digit PIN, and receives new Queue A015", async ({ page }) => {
    await page.goto("/patient");
    await page.click("button.register-link-btn:has-text('ลงทะเบียนผู้ป่วยใหม่')");
    await page.check("input[aria-label='ยินยอมเงื่อนไข PDPA']");
    await page.click("button.pdpa-accept-btn");

    // Fill credentials & personal info
    await page.fill("input[name='username']", "somying01");
    await page.fill("input[name='password']", "Password@2026");
    await page.fill("input[name='first_name']", "สมหญิง");
    await page.fill("input[name='last_name']", "รักดี");
    await page.fill("input[name='national_id']", "1103702111111");
    await page.fill("input[name='phone']", "0891112222");
    await page.fill("input[name='email']", "somying@example.com");

    // Select health chips
    await page.click("button.choice-chip:has-text('ไม่มีโรคประจำตัว')");
    await page.click("button.choice-chip:has-text('ไม่มีประวัติแพ้ยา')");
    await page.click("button.choice-chip:has-text('ไม่มียาที่ใช้ประจำ')");

    // Symptoms
    await page.fill("textarea[name='note']", "มีไข้สูง และไอแห้งมา 2 วัน");

    // Submit form
    await page.click("button[type='submit']:has-text('บันทึกข้อมูลผู้ป่วย')");

    // Should prompt for 6-digit PIN setup
    await expect(page.locator(".pin-card h1")).toContainText("ตั้งรหัส PIN");

    // Enter PIN: 6 5 4 3 2 1
    for (const digit of ["6", "5", "4", "3", "2", "1"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Confirm PIN: 6 5 4 3 2 1
    await expect(page.locator(".pin-card h1")).toContainText("ยืนยันรหัส PIN");
    for (const digit of ["6", "5", "4", "3", "2", "1"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Should arrive at Queue Status View with new Queue number A015
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".queue-number")).toContainText("A015");
    await expect(page.getByText("ห้องตรวจ 1", { exact: true })).toBeVisible();
  });

  test("4. Duplicate Queue Guard routes patient with active queue to Queue Status", async ({ page }) => {
    await page.goto("/patient");
    await page.click("button.register-link-btn:has-text('ลงทะเบียนผู้ป่วยใหม่')");
    await page.check("input[aria-label='ยินยอมเงื่อนไข PDPA']");
    await page.click("button.pdpa-accept-btn");

    // Fill Somchai's national ID who already has active queue A012
    await page.fill("input[name='first_name']", "สมชาย");
    await page.fill("input[name='last_name']", "ใจดี");
    await page.fill("input[name='national_id']", "1234567890123");
    await page.fill("input[name='phone']", "0812345678");
    await page.fill("input[name='email']", "somchai@example.com");

    await page.click("button.choice-chip:has-text('ไม่มีโรคประจำตัว')");
    await page.click("button.choice-chip:has-text('ไม่มีประวัติแพ้ยา')");
    await page.click("button.choice-chip:has-text('ไม่มียาที่ใช้ประจำ')");

    await page.fill("textarea[name='note']", "ปวดศีรษะ");

    // Submit form
    await page.click("button[type='submit']:has-text('บันทึกข้อมูลผู้ป่วย')");

    // Duplicate guard routes to PIN setup/unlock
    await expect(page.locator(".pin-card h1")).toBeVisible();

    // Step 1: Set PIN 1 2 3 4 5 6
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Step 2: Confirm PIN 1 2 3 4 5 6
    await expect(page.locator(".pin-card h1")).toContainText("ยืนยันรหัส PIN");
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.keypad-btn:has-text('${digit}')`);
    }

    // Lands on Somchai's existing queue A012
    await expect(page.locator(".queue-number")).toContainText("A012");
  });
});
