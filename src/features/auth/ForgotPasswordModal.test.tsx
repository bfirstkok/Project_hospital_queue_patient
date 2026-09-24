import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

describe("ForgotPasswordModal", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("completes the 3-step OTP request, verification, and password reset", async () => {
    // 1. Request OTP response
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, cooldown_seconds: 60, message: "ส่งรหัสสำเร็จ" }), {
        headers: { "content-type": "application/json" },
      }),
    );

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      createElement(ForgotPasswordModal, {
        isOpen: true,
        onClose,
        onSuccess,
      }),
    );

    expect(screen.getByRole("heading", { name: /ลืมรหัสผ่าน \/ กู้คืนบัญชี/ })).toBeDefined();

    // Step 1: Request OTP
    fireEvent.change(screen.getByPlaceholderText(/เช่น somchai99/), {
      target: { value: "somchai@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ส่งรหัส OTP/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ยืนยันรหัส OTP/ })).toBeDefined();
    });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toMatchObject({ channel: "email" });

    // Step 2: Verify OTP response
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, reset_token: "mock-reset-token-123" }), {
        headers: { "content-type": "application/json" },
      }),
    );

    fireEvent.change(screen.getByPlaceholderText(/ตัวเลข 6 หลัก/), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ตั้งรหัสผ่านใหม่/ })).toBeDefined();
    });

    // Step 3: Confirm Reset response
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, message: "เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว" }), {
        headers: { "content-type": "application/json" },
      }),
    );

    fireEvent.change(screen.getByPlaceholderText(/อย่างน้อย 8 ตัวอักษร/), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/กรอกรหัสผ่านใหม่อีกครั้ง/), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /บันทึกรหัสผ่านใหม่/ }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining("เปลี่ยนรหัสผ่านใหม่สำเร็จ"));
    });
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      createElement(ForgotPasswordModal, {
        isOpen: false,
        onClose: vi.fn(),
        onSuccess: vi.fn(),
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("stays on the request step when SMTP delivery fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "ส่งอีเมล OTP ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    render(createElement(ForgotPasswordModal, {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    }));
    fireEvent.change(screen.getByPlaceholderText(/เช่น somchai99/), {
      target: { value: "somchai@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ส่งรหัส OTP/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ส่งอีเมล OTP ไม่สำเร็จ");
    expect(screen.getByRole("heading", { name: /ลืมรหัสผ่าน/ })).toBeInTheDocument();
  });
});
