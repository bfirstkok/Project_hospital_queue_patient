import type { APIRequestContext, Page } from "@playwright/test";

export async function preparePatientE2E(page: Page, request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:8001/__test__/reset/", { timeout: 5_000 });
  if (!response.ok()) {
    throw new Error(`Mock backend reset failed (${response.status()}): ${await response.text()}`);
  }

  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: 'window.PATIENT_APP_ENV = { API_BASE_URL: "http://127.0.0.1:8001", GOOGLE_CLIENT_ID: "playwright-client-id" };',
  }));
  await page.route("https://accounts.google.com/gsi/client", (route) => route.abort());
}
