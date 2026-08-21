import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountView } from "./AccountView";

describe("AccountView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders profile and active queue from the existing /me response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: { first_name: "สมชาย", last_name: "ใจดี", hn: "123", national_id: "1234567890123", phone: "0812345678" },
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
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("opens edit modal and allows editing profile details", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: { first_name: "สมชาย", last_name: "ใจดี", hn: "123", national_id: "1234567890123", phone: "0812345678" },
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
    fireEvent.click(screen.getByRole("button", { name: /แก้ไขข้อมูลส่วนตัว/ }));
    expect(screen.getByRole("heading", { name: "แก้ไขข้อมูลส่วนตัว" })).toBeInTheDocument();

    const phoneInput = screen.getByLabelText("เบอร์โทรศัพท์ส่วนตัว");
    fireEvent.change(phoneInput, { target: { value: "0899999999" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));

    await waitFor(() => expect(screen.getByText("0899999999")).toBeInTheDocument());
  });
});
