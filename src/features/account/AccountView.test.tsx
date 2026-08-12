import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountView } from "./AccountView";

describe("AccountView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders profile, active queue, visits, and appointments from the existing /me response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      profile: { first_name: "สมชาย", last_name: "ใจดี", hn: "123", national_id: "1234567890123" },
      active_queue: { queue_number: "Q-5", status_label: "รอเรียก", instruction: "รอหน้าห้อง", room: "ห้อง 1" },
      visits: [{ queue_number: "Q-1", status_label: "เสร็จสิ้น", registered_at: "2026-08-12T09:00:00Z" }],
      appointments: [{ status: "SCHEDULED", date: "2026-08-20", time: "09:00" }],
    }), { headers: { "content-type": "application/json" } }));
    render(createElement(AccountView, { token: "token", onQueue: vi.fn(), onLogout: vi.fn(), onUnauthorized: vi.fn() }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "สมชาย ใจดี" })).toBeInTheDocument());
    expect(screen.getByText("Q-5")).toBeInTheDocument();
    expect(screen.getByText("Q-1 · เสร็จสิ้น")).toBeInTheDocument();
    expect(screen.getByText("นัดหมายแล้ว")).toBeInTheDocument();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });
});
