import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, patientApi } from "./patient-api";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

describe("patientApi", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com", STATUS_REFRESH_MS: 10000 };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps the registration endpoint and JSON payload contract", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, access_token: "token", queue_number: "Q-1" }));
    await patientApi.register({
      website: null, first_name: "สมชาย", last_name: "ใจดี", national_id: "1234567890123", gender: "M",
      age: 30, phone: null, blood_type: "A", height_cm: 170, weight_kg: 65, chronic_diseases: null,
      allergies: null, medications: null, note: "ปวดหัว", province: null, district: null, subdistrict: null,
      postal_code: null, emergency_name: null, emergency_relationship: null, emergency_phone: null, consent: true,
    });

    expect(fetch).toHaveBeenCalledWith("https://hospital.example.com/api/patient/register/", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"age":30'),
    }));
  });

  it("uses the existing login endpoint and normalizes national ID", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, access_token: "token" }));
    await patientApi.login(" 1234567890123 ");
    expect(fetch).toHaveBeenCalledWith("https://hospital.example.com/api/patient/login/", expect.objectContaining({
      method: "POST", body: '{"national_id":"1234567890123"}',
    }));
  });

  it("uses the queue endpoint with the existing Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, queue_number: "Q-1" }));
    await patientApi.queue("patient-token");
    expect(fetch).toHaveBeenCalledWith("https://hospital.example.com/api/patient/queue/", expect.objectContaining({
      headers: expect.objectContaining({ get: expect.any(Function) }),
    }));
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer patient-token");
  });

  it("maps API validation errors without changing their message", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, error: "ข้อมูลไม่ถูกต้อง", errors: { note: ["กรุณาระบุอาการ"] } }, 400));
    await expect(patientApi.login("1234567890123")).rejects.toMatchObject({
      message: "ข้อมูลไม่ถูกต้อง", status: 400, errors: { note: ["กรุณาระบุอาการ"] },
    });
  });
});
