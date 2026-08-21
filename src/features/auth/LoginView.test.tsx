import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginView } from "./LoginView";

describe("LoginView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends the existing national ID login payload", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, access_token: "token" }), { headers: { "content-type": "application/json" } }));
    const onSuccess = vi.fn();
    render(createElement(LoginView, { onRegister: vi.fn(), onThaidConnect: vi.fn(), onSuccess }));
    fireEvent.change(screen.getByLabelText("เลขบัตรประจำตัวประชาชน *"), { target: { value: "1234567890123" } });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("token"));
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe('{"national_id":"1234567890123"}');
  });

  it("navigates to register view when register button clicked", () => {
    const onRegister = vi.fn();
    render(createElement(LoginView, { onRegister, onThaidConnect: vi.fn(), onSuccess: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /ลงทะเบียนผู้ป่วยใหม่/ }));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });
});
