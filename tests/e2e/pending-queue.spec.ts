import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("hospital_patient_access_token", "pending-queue-test");
    sessionStorage.setItem("patient_session_unlocked", "true");
    localStorage.setItem("patient_app_current_view", "account");
  });
});

test("retains yesterday's unpaid queue and shows its service date and stage", async ({ page }) => {
  const queue = {
    ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "แพทย์ตรวจเสร็จ",
    instruction: "กรุณาติดต่อการเงิน", queue_position: null, room: "การเงิน",
    updated_at: "2026-09-30T10:00:00Z",
    patient_journey: {
      current_label: "การเงิน", current_detail: "รอชำระเงิน",
      steps: [
        { key: "doctor", label: "ตรวจรักษา", state: "done", detail: "ตรวจเสร็จ" },
        { key: "billing", label: "การเงิน", state: "current", detail: "รอชำระเงิน" },
        { key: "complete", label: "ออกจากโรงพยาบาล", state: "pending", detail: "รอปิด Visit" },
      ],
    },
  };
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: queue }));
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, profile: { first_name: "สมชาย", last_name: "ใจดี" },
    active_queue: queue, visits: [{ ...queue, registered_at: "2026-09-29T18:30:00Z" }], appointments: [],
  } }));
  await page.goto("/patient/");
  await expect(page.getByRole("button", { name: "มีคิวแล้ว" })).toBeDisabled();
  await page.getByRole("tab", { name: /ประวัติการรักษา/ }).click();
  await expect(page.getByRole("heading", { name: "คิวที่ยังไม่เสร็จสิ้น (1)" })).toBeVisible();
  await expect(page.locator(".pending-queue-item")).toContainText("คิว A012");
  await expect(page.locator(".pending-queue-item time")).toContainText("30 ก.ย. 2569");
  await expect(page.locator(".pending-queue-item")).toContainText("ขั้นตอนล่าสุด: การเงิน");
  await expect(page.locator(".pending-queue-item")).toContainText("กรุณาชำระเงินที่จุดการเงิน");
  await page.screenshot({ path: `outputs/pending-queue-${test.info().project.name.replaceAll(" ", "-")}.png`, fullPage: true });
  await page.getByRole("button", { name: /คิวของฉัน/ }).click();
  await expect(page.locator(".queue-number")).toHaveText("A012");
  const dialog = page.getByRole("dialog", { name: "แจ้งเตือนค้างชำระเงิน" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("กรุณาชำระเงิน");
  await expect(dialog.locator("time")).toContainText("30 ก.ย. 2569");
  await dialog.getByRole("button", { name: "รับทราบและดูคิวเดิม" }).click();
  await expect(dialog).not.toBeVisible();
  const details = page.getByRole("button", { name: /ดูคิวที่กำลังรับบริการ/ });
  await expect(details).toContainText("A012");
  await expect(details).toContainText("30 ก.ย. 2569");
  await details.click();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: `outputs/unpaid-popup-${test.info().project.name.replaceAll(" ", "-")}.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /อัปเดตสถานะคิว/ }).click();
  await expect(page.getByRole("button", { name: /อัปเดตสถานะคิว/ })).toBeEnabled();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "ยกเลิกคิวรับบริการ" })).toHaveCount(0);
});

test("redirects a restored booking page back to the existing queue", async ({ page }) => {
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, visits: [{ queue_number: "A012", registered_at: "2026-09-29T18:30:00Z" }],
  } }));
  await page.addInitScript(() => localStorage.setItem("patient_app_current_view", "registration"));
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: {
    ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "แพทย์ตรวจเสร็จ", instruction: "รอการเงิน",
  } }));
  await page.goto("/patient/");
  await expect(page.locator(".queue-number")).toHaveText("A012");
  await expect(page.getByRole("button", { name: "มีคิวแล้ว" })).toBeDisabled();
});

test("allows booking after backend closes the queue", async ({ page }) => {
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: { ok: true, queue_number: null } }));
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, profile: { first_name: "สมชาย", last_name: "ใจดี" }, active_queue: null,
    visits: [{ queue_number: "A012", status: "DISCHARGED", status_label: "เสร็จสิ้น", registered_at: "2026-09-30T08:00:00Z" }], appointments: [],
  } }));
  await page.goto("/patient/");
  await expect(page.getByRole("button", { name: "จองคิว", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: /ประวัติการรักษา/ }).click();
  await expect(page.getByRole("heading", { name: /คิวที่ยังไม่เสร็จสิ้น/ })).toHaveCount(0);
  await expect(page.getByText("A012 · เสร็จสิ้น")).toBeVisible();
});

test("does not show an unpaid popup while billing is still being prepared", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("patient_app_current_view", "status"));
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: {
    ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "การเงิน",
    patient_journey: { steps: [{ key: "billing", label: "การเงิน", state: "current", detail: "รอสรุปค่าใช้จ่าย" }] },
  } }));
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, visits: [{ queue_number: "A012", registered_at: "2026-09-29T18:30:00Z" }],
  } }));
  await page.goto("/patient/");
  const details = page.getByRole("button", { name: /ดูคิวที่กำลังรับบริการ/ });
  await expect(details).toContainText("30 ก.ย. 2569");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await details.click();
  const dialog = page.getByRole("dialog", { name: "คิวที่กำลังรับบริการ" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("อยู่ระหว่างสรุปค่าใช้จ่าย");
  await dialog.getByRole("button", { name: "รับทราบและดูคิวเดิม" }).click();
  await expect(dialog).not.toBeVisible();
});

test("warns about an unclosed paid queue in history and clears the warning after discharge", async ({ page }) => {
  let closed = false;
  const registeredAt = new Date().toISOString();
  const queue = {
    ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "พร้อมกลับบ้าน · รอปิด Visit",
    registered_at: registeredAt, updated_at: registeredAt,
    patient_journey: {
      current_label: "พร้อมกลับบ้าน · รอปิด Visit",
      steps: [
        { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว" },
        { key: "pharmacy", label: "ห้องยา", state: "done", detail: "จ่ายยาแล้ว" },
        { key: "complete", label: "ออกจากโรงพยาบาล", state: "current", detail: "รอปิด Visit" },
      ],
    },
  };
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: closed ? { ok: true, queue_number: null } : queue }));
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, profile: { first_name: "สมชาย", last_name: "ใจดี" }, active_queue: closed ? null : queue,
    visits: [{ ...queue, status: closed ? "DISCHARGED" : "OPD_DONE", status_label: closed ? "เสร็จสิ้น" : queue.status_label }], appointments: [],
  } }));
  await page.goto("/patient/");
  await page.getByRole("tab", { name: /ประวัติการรักษา/ }).click();
  await expect(page.locator(".pending-queue-item")).toContainText("คิวยังไม่ปิด");
  await page.getByRole("button", { name: /คิวของฉัน/ }).click();
  const dialog = page.getByRole("dialog", { name: "แจ้งเตือนคิวยังไม่ปิด" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "รับทราบและดูคิวเดิม" }).click();
  closed = true;
  await page.getByRole("button", { name: /อัปเดตสถานะคิว/ }).click();
  await expect(page.locator(".queue-attention")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "จองคิว", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "ข้อมูลของฉัน" }).click();
  await page.getByRole("tab", { name: /ประวัติการรักษา/ }).click();
  await expect(page.locator(".pending-queue-item")).toHaveCount(0);
  await expect(page.getByText("A012 · เสร็จสิ้น")).toBeVisible();
});
