import { test, expect } from "@playwright/test";

test("shows registration and latest station times with expandable history", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("hospital_patient_access_token", "queue-history-test");
    sessionStorage.setItem("patient_session_unlocked", "true");
    localStorage.setItem("patient_app_current_view", "status");
  });
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: 'window.PATIENT_APP_ENV = { API_BASE_URL: "http://127.0.0.1:8001", STATUS_REFRESH_MS: 60000 };',
  }));
  const queue = {
    ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "รับยาแล้ว",
    instruction: "รอเจ้าหน้าที่ปิด Visit", queue_position: null, room: "ห้องยา",
    updated_at: "2026-10-01T12:00:00Z",
    patient_journey: {
      current_label: "รอปิด Visit", current_detail: "รับยาและชำระเงินครบแล้ว",
      steps: [
        { key: "registration", label: "ลงทะเบียน", state: "done", detail: "ลงทะเบียนแล้ว", timestamp: "2026-10-01T11:00:00Z" },
        { key: "doctor", label: "ห้องตรวจ", state: "done", detail: "แพทย์ตรวจแล้ว", timestamp: "2026-10-01T11:05:00Z" },
        { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว", timestamp: "2026-10-01T11:10:00Z" },
        { key: "pharmacy", label: "ห้องยา", state: "done", detail: "จ่ายยาแล้ว", timestamp: "2026-10-01T11:20:40Z" },
        { key: "complete", label: "ออกจากโรงพยาบาล", state: "current", detail: "รอปิด Visit", timestamp: null },
      ],
    },
  };
  await page.route("**/api/patient/queue/", (route) => route.fulfill({ json: queue }));
  await page.route("**/api/patient/me/", (route) => route.fulfill({ json: {
    ok: true, profile: { first_name: "สมชาย", last_name: "ใจดี" }, active_queue: queue, visits: [], appointments: [],
  } }));
  await page.goto("/patient/");
  await expect(page.locator(".queue-number")).toHaveText("A012");
  await page.getByRole("button", { name: "รับทราบและดูคิวเดิม" }).click();
  await expect(page.locator(".queue-timestamps")).toContainText("เริ่มรับคิว: 18:00:00 น.");
  await expect(page.locator(".queue-timestamps")).toContainText("สถานะคิวจุดล่าสุด: ห้องยา · จ่ายยาแล้ว: 18:20:40 น.");
  await expect(page.locator(".card-top-actions .card-updated-at")).toHaveText("อัปเดตล่าสุด 19:00:00 น.");
  const updatedPosition = await page.locator(".card-updated-at").boundingBox();
  const notificationPosition = await page.locator(".notif-toggle-btn").boundingBox();
  expect(updatedPosition!.x).toBeLessThan(notificationPosition!.x);
  await page.getByText("ประวัติคิว", { exact: true }).click();
  await expect(page.getByRole("list", { name: "ประวัติคิว" }).getByRole("listitem")).toHaveCount(4);
  await page.getByRole("button", { name: /อัปเดตสถานะคิว/ }).click();
  await expect(page.locator(".queue-timestamps")).toContainText("เริ่มรับคิว: 18:00:00 น.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `outputs/queue-history-${test.info().project.name.replaceAll(" ", "-")}.png`, fullPage: true });
});
