import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinAuthView } from "./PinAuthView";
import { clearPin, savePin } from "@/shared/auth/pin-storage";

describe("PinAuthView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPin();
  });

  it("unlocks when correct 6-digit PIN is entered", () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["1", "2", "3", "4", "5", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows error alert with remaining attempts on incorrect PIN", () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["9", "9", "9", "9", "9", "9"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("รหัส PIN ไม่ถูกต้อง (เหลือโอกาสอีก 2 ครั้ง)");
  });

  it("displays patient greeting in unlock mode", () => {
    savePin("123456");
    render(
      createElement(PinAuthView, {
        mode: "unlock",
        onSuccess: vi.fn(),
        patientName: "สมชาย ใจดี",
        maskedNationalId: "1-xxxx-xxxx4-56-7",
      })
    );

    expect(screen.getByText("คุณสมชาย ใจดี")).toBeInTheDocument();
    expect(screen.getByText("1-xxxx-xxxx4-56-7")).toBeInTheDocument();
  });

  it("handles full PIN setup flow (enter pin + confirm pin)", () => {
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "setup", onSuccess }));

    expect(screen.getByText("ตั้งรหัส PIN 6 หลัก")).toBeInTheDocument();

    // Enter initial pin 123456
    ["1", "2", "3", "4", "5", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    // Step 2: Confirm PIN
    expect(screen.getByText("ยืนยันรหัส PIN อีกครั้ง")).toBeInTheDocument();

    // Enter confirmation pin 123456
    ["1", "2", "3", "4", "5", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("calls onSwitchAccount when switch account button is clicked", () => {
    savePin("123456");
    const onSwitchAccount = vi.fn();
    render(
      createElement(PinAuthView, {
        mode: "unlock",
        onSuccess: vi.fn(),
        onSwitchAccount,
      })
    );

    const switchBtn = screen.getByRole("button", { name: /สลับผู้ใช้งาน/ });
    fireEvent.click(switchBtn);
    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it("renders mandatory step badge and cancel button in mandatory setup mode", () => {
    const onCancel = vi.fn();
    render(
      createElement(PinAuthView, {
        mode: "setup",
        isMandatory: true,
        onSuccess: vi.fn(),
        onCancel,
      })
    );

    expect(screen.getByText("ตั้งรหัส PIN 6 หลัก")).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: "ยกเลิกและกลับหน้าเข้าสู่ระบบ" });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("unlocks with patient-specific PIN", () => {
    const natId = "1234567890123";
    savePin("654321", natId);
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", nationalId: natId, onSuccess }));

    ["6", "5", "4", "3", "2", "1"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("recovers PIN via phone number OTP", () => {
    render(createElement(PinAuthView, { mode: "reset", onSuccess: vi.fn() }));

    expect(screen.getByText("กู้คืนรหัส PIN ผ่านเบอร์โทร / อีเมล")).toBeInTheDocument();
    const phoneInput = screen.getByPlaceholderText("08xxxxxxxx");
    fireEvent.change(phoneInput, { target: { value: "0812345678" } });
    fireEvent.click(screen.getByRole("button", { name: /ขอรหัส OTP ทาง SMS/ }));

    expect(screen.getByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();
    const otpInput = screen.getByPlaceholderText("123456");
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));

    expect(screen.getByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });

  it("recovers PIN via email OTP", () => {
    render(createElement(PinAuthView, { mode: "reset", onSuccess: vi.fn() }));

    const emailTab = screen.getByRole("tab", { name: /อีเมล/ });
    fireEvent.click(emailTab);

    const emailInput = screen.getByPlaceholderText("patient@example.com");
    fireEvent.change(emailInput, { target: { value: "user@hospital.com" } });
    fireEvent.click(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ }));

    expect(screen.getByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();
    const otpInput = screen.getByPlaceholderText("123456");
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));

    expect(screen.getByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });
});
