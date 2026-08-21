import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountView } from "./AccountView";

describe("AccountView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders profile, health info, and active queue from the existing /me response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: {
        first_name: "สมชาย",
        last_name: "ใจดี",
        hn: "123",
        national_id: "1234567890123",
        phone: "0812345678",
        blood_type: "O",
        height_cm: 170,
        weight_kg: 65,
        emergency_name: "วิลาวัลย์",
        emergency_phone: "0891234567",
      },
      active_queue: { queue_number: "Q-5", status_label: "รอเรียก", instruction: "รอหน้าห้อง", room: "ห้อง 1" },
      visits: [{ queue_number: "Q-1", status_label: "เสร็จสิ้น", registered_at: "2026-08-12T09:00:00Z" }],
      appointments: [{ status: "SCHEDULED", date: "2026-08-20", time: "09:00" }],
    }), { headers: { "content-type": "application/json" } }));

    render(createElement(AccountView, {
      token: "token",
      onQueue: vi.fn(),
      onLogout: vi.fn(),
      onUnauthorized: vi.fn(),
    }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "สมชาย ใจดี" })).toBeInTheDocument());
    expect(screen.getByText("Q-5")).toBeInTheDocument();
    expect(screen.getAllByText("1234567890123").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/170 ซม\. · 65 กก\./)).toBeInTheDocument();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("opens edit modal and allows editing profile details and emergency contacts", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: {
        first_name: "สมชาย",
        last_name: "ใจดี",
        hn: "123",
        national_id: "1234567890123",
        phone: "0812345678",
        height_cm: 170,
        weight_kg: 65,
      },
      active_queue: null,
      visits: [],
      appointments: [],
    }), { headers: { "content-type": "application/json" } }));

    render(createElement(AccountView, {
      token: "token",
      onQueue: vi.fn(),
      onLogout: vi.fn(),
      onUnauthorized: vi.fn(),
    }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "สมชาย ใจดี" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /แก้ไขข้อมูล/ }));
    expect(screen.getByRole("heading", { name: "แก้ไขข้อมูลส่วนตัวและสุขภาพ" })).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText("08xxxxxxxx");
    fireEvent.change(phoneInput, { target: { value: "0899999999" } });

    // Add another emergency contact
    fireEvent.click(screen.getByRole("button", { name: /\+ เพิ่มผู้ติดต่อ/ }));
    const contactNames = screen.getAllByPlaceholderText("ชื่อ-นามสกุล");
    expect(contactNames.length).toBe(2);
    fireEvent.change(contactNames[0], { target: { value: "มารดา ใจดี" } });

    fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));

    await waitFor(() => expect(screen.getByText("0899999999")).toBeInTheDocument());
    expect(screen.getByText(/มารดา ใจดี/)).toBeInTheDocument();
  });
});
