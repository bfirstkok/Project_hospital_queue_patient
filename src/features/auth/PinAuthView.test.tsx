import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinAuthView } from "./PinAuthView";
import { clearPin, savePairedPatient, savePin } from "@/shared/auth/pin-storage";

const okFetch = () =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }),
  );

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

  it("recovers PIN via OTP to the registered phone (no re-typing)", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", okFetch());
    savePairedPatient({
      name: "กิตติ มีสุข", nationalId: "1101700230708",
      phone: "0812345678", email: "kitti@example.com",
    });
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess: vi.fn() }));

    expect(screen.getByText("กู้คืนรหัส PIN ผ่านเบอร์โทร / อีเมล")).toBeInTheDocument();
    // Masked registered phone is shown; there is no free-text input.
    expect(screen.getByText("081-xxx-xx78")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("08xxxxxxxx")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัส OTP ทาง SMS/ }));
    expect(await screen.findByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({ channel: "phone", target: "0812345678" });

    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));
    expect(screen.getByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });

  it("recovers PIN via OTP to the registered email", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", okFetch());
    savePairedPatient({
      name: "กิตติ มีสุข", nationalId: "1101700230708",
      phone: "0812345678", email: "kitti@example.com",
    });
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess: vi.fn() }));

    fireEvent.click(screen.getByRole("tab", { name: /อีเมล/ }));
    expect(screen.getByText("ki•••@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ }));
    expect(await screen.findByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));
    expect(screen.getByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });

  it("falls back to national-ID verification when the OTP endpoint is unavailable", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/pin/reset/request/")) return new Response("Not Found", { status: 404 });
        if (url.includes("/api/patient/login/")) {
          return new Response(JSON.stringify({ ok: true, access_token: "t" }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }),
    );
    savePairedPatient({
      name: "กิตติ มีสุข", nationalId: "1101700230708",
      phone: "0812345678", email: "kitti@example.com",
    });
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess }));

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัส OTP ทาง SMS/ }));

    // OTP request 404s -> identity verified via /login/ -> straight to "set new PIN"
    expect(await screen.findByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();

    const enter = (d: string[]) => d.forEach((n) => fireEvent.click(screen.getByRole("button", { name: n })));
    enter(["9", "8", "7", "6", "5", "4"]); // new PIN
    enter(["9", "8", "7", "6", "5", "4"]); // confirm

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("blocks recovery only when the national ID is also missing", () => {
    render(createElement(PinAuthView, { mode: "reset", onSuccess: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันตัวตนด้วยเลขบัตรประชาชน/ }));
    expect(screen.getByText(/ไม่พบเลขบัตรประชาชนสำหรับการกู้คืนรหัส/)).toBeInTheDocument();
  });
});
