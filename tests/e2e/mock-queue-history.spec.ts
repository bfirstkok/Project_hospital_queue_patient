import { test, expect } from "@playwright/test";
import { preparePatientE2E } from "./prepare-test";

test("reads registration, pharmacy, payment and completed history from the actual mock API", async ({ page, request }) => {
  await preparePatientE2E(page, request);
  const login = await request.post("http://127.0.0.1:8001/api/patient/login/", {
    data: { identifier: "somchai99", password: "Password@2026" },
  });
  expect(login.ok()).toBe(true);
  const { access_token: token } = await login.json();
  await page.addInitScript((accessToken) => {
    sessionStorage.setItem("hospital_patient_access_token", accessToken);
    sessionStorage.setItem("patient_session_unlocked", "true");
    localStorage.setItem("patient_app_current_view", "status");
  }, token);
  await page.goto("/patient/");
  await expect(page.locator(".queue-number")).toHaveText("A012");
  const startedAt = await page.locator(".queue-timestamps p").first().textContent();
  expect(startedAt).not.toContain("ยังไม่มีข้อมูลเวลา");
  for (const [stage, expectedLabel] of [["billing", "การเงิน"], ["pharmacy", "ห้องยา"], ["ready_to_leave", "พร้อมกลับบ้าน"]]) {
    const changed = await request.post("http://127.0.0.1:8001/__test__/queue/", {
      headers: { Authorization: `Bearer ${token}` }, data: { stage },
    });
    expect(changed.ok()).toBe(true);
    await page.getByRole("button", { name: /อัปเดตสถานะคิว/ }).click();
    await expect(page.locator(".status-pill")).toContainText(expectedLabel);
    const notice = page.getByRole("dialog");
    if (await notice.isVisible()) await notice.getByRole("button", { name: "รับทราบและดูคิวเดิม" }).click();
    await expect(page.locator(".queue-timestamps p").first()).toHaveText(startedAt!);
    await expect(page.locator(".queue-timestamps p").last()).not.toContainText("ยังไม่มีข้อมูลเวลา");
  }
  await page.getByText("ประวัติคิว", { exact: true }).click();
  await expect(page.getByRole("list", { name: "ประวัติคิว" }).getByRole("listitem")).toHaveCount(7);
  const discharged = await request.post("http://127.0.0.1:8001/__test__/queue/", {
    headers: { Authorization: `Bearer ${token}` }, data: { stage: "discharged" },
  });
  expect(discharged.ok()).toBe(true);
  await page.getByRole("button", { name: /อัปเดตสถานะคิว/ }).click();
  await expect(page.locator(".recent-visit-progress")).toContainText("เสร็จสิ้นการรับบริการ");
  await expect(page.locator(".recent-visit-progress .queue-timestamps p").first()).toHaveText(startedAt!);
});
