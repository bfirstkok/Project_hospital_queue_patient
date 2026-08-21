import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MedicalRecordsView } from "./MedicalRecordsView";

describe("MedicalRecordsView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders health info, visits timeline, and appointments from /me", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: { first_name: "สมชาย", last_name: "ใจดี", hn: "123", blood_type: "O", chronic_diseases: "เบาหวาน", allergies: "แพ้กุ้ง" },
      visits: [{ queue_number: "Q-1", status_label: "เสร็จสิ้น", registered_at: "2026-08-12T09:00:00Z", diagnosis: "ไข้หวัด" }],
      appointments: [{ status: "SCHEDULED", date: "2026-08-20", time: "09:00", note: "ตรวจน้ำตาล" }],
    }), { headers: { "content-type": "application/json" } }));

    render(createElement(MedicalRecordsView, {
      token: "mock_token",
      onLogin: vi.fn(),
      onBookQueue: vi.fn(),
      onUnauthorized: vi.fn(),
    }));

    await waitFor(() => expect(screen.getByText("ข้อมูลสุขภาพของฉัน")).toBeInTheDocument());
    expect(screen.getByText("เบาหวาน")).toBeInTheDocument();
    expect(screen.getByText("แพ้กุ้ง")).toBeInTheDocument();
    expect(screen.getByText("Q-1 · เสร็จสิ้น")).toBeInTheDocument();
    expect(screen.getByText("นัดหมายแล้ว")).toBeInTheDocument();
    expect(screen.getByText("+ เพิ่มลงปฏิทิน")).toBeInTheDocument();
  });
});
