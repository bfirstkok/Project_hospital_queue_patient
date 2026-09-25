import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinAuthView } from "./PinAuthView";
import { clearPin, clearPairedPatient, savePairedPatient, savePin } from "@/shared/auth/pin-storage";

const okFetch = () =>
  vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const body = url.includes("/pin/reset/verify-otp/")
      ? { ok: true, reset_token: "test-reset-token" }
      : { ok: true };
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }));
  });

describe("PinAuthView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearPin();
    clearPairedPatient();
  });

  it("unlocks when correct 6-digit PIN is entered", async () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["1", "2", "3", "4", "5", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows error alert with remaining attempts on incorrect PIN", async () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["9", "9", "9", "9", "9", "9"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(await screen.findByText("รหัส PIN ไม่ถูกต้อง (เหลือโอกาสอีก 2 ครั้ง)")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
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

    // Enter initial strong pin 135246
    ["1", "3", "5", "2", "4", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    // Step 2: Confirm PIN
    expect(screen.getByText("ยืนยันรหัส PIN อีกครั้ง")).toBeInTheDocument();

    // Enter confirmation pin 135246
    ["1", "3", "5", "2", "4", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("rejects weak PIN during setup (repeated or sequential digits)", () => {
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "setup", onSuccess }));

    // Try entering repeated digits 111111
    ["1", "1", "1", "1", "1", "1"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(screen.getByText("รหัส PIN ง่ายเกินไป ไม่อนุญาตให้ใช้ตัวเลขซ้ำหรือเรียงกัน")).toBeInTheDocument();
    expect(screen.getByText("ตั้งรหัส PIN 6 หลัก")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
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

  it("unlocks with patient-specific PIN", async () => {
    const natId = "1234567890123";
    savePin("654321", natId);
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", nationalId: natId, onSuccess }));

    ["6", "5", "4", "3", "2", "1"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("verifies the PIN against the server when the endpoint is reachable", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    // Local hash says WRONG, server says OK -> server wins.
    savePin("000000", "1101700230708");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/patient/pin/verify/")) {
          return new Response(JSON.stringify({ ok: true, access_token: "srv" }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }),
    );
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", nationalId: "1101700230708", onSuccess }));

    ["1", "2", "3", "4", "5", "6"].forEach((n) => fireEvent.click(screen.getByRole("button", { name: n })));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes("/api/patient/pin/verify/")),
    ).toBe(true);
  });

  it("rejects the PIN when the server says it is wrong even if the local hash matches", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    savePin("123456", "1101700230708"); // local hash matches
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/patient/pin/verify/")) {
          return new Response(JSON.stringify({ ok: false, error: "รหัส PIN ไม่ถูกต้อง" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }),
    );
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", nationalId: "1101700230708", onSuccess }));

    ["1", "2", "3", "4", "5", "6"].forEach((n) => fireEvent.click(screen.getByRole("button", { name: n })));

    expect(await screen.findByText(/รหัส PIN ไม่ถูกต้อง/)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("recovers PIN via OTP to the registered email (no re-typing)", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", okFetch());
    savePairedPatient({
      name: "กิตติ มีสุข", nationalId: "1101700230708",
      phone: "0812345678", email: "kitti@example.com",
    });
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess: vi.fn() }));

    expect(screen.getByText("กู้คืนรหัส PIN ทางอีเมล")).toBeInTheDocument();
    expect(screen.getByText("ki•••@example.com")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("08xxxxxxxx")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ }));
    expect(await screen.findByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({ channel: "email", target: "kitti@example.com" });

    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));
    expect(await screen.findByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });

  it("recovers PIN via OTP to the registered email", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", okFetch());
    savePairedPatient({
      name: "กิตติ มีสุข", nationalId: "1101700230708",
      phone: "0812345678", email: "kitti@example.com",
    });
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess: vi.fn() }));

    expect(screen.queryByRole("tab", { name: /เบอร์โทรศัพท์/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ }));
    expect(await screen.findByRole("heading", { name: "ยืนยันรหัส OTP" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรหัส OTP/ }));
    expect(await screen.findByText("ตั้งรหัส PIN ใหม่ 6 หลัก")).toBeInTheDocument();
  });

  it("does not bypass email OTP when the endpoint is unavailable", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("กู้คืนรหัส PIN ทางอีเมล")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/api/patient/login/"))).toBe(false);
  });

  it("does not advance to PIN setup when the server rejects the OTP", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/pin/reset/verify-otp/")) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid OTP" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }),
    );
    savePairedPatient({ name: "Patient", nationalId: "1101700230708", email: "patient@example.com" });
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess: vi.fn() }));

    fireEvent.submit(document.querySelector(".reset-pin-form")!);
    await screen.findByRole("heading", { name: /OTP/ });
    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "000000" } });
    fireEvent.submit(document.querySelector(".reset-pin-form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid OTP");
    expect(screen.getByRole("heading", { name: /OTP/ })).toBeInTheDocument();
    expect(screen.queryByText(/PIN.*6/)).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/pin/reset/confirm/"))).toBe(false);
  });

  it("completes PIN recovery using the reset token returned by OTP verification", async () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", okFetch());
    savePairedPatient({ name: "Patient", nationalId: "1101700230708", email: "patient@example.com" });
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "reset", nationalId: "1101700230708", onSuccess }));

    fireEvent.submit(document.querySelector(".reset-pin-form")!);
    await screen.findByRole("heading", { name: /OTP/ });
    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.submit(document.querySelector(".reset-pin-form")!);
    await screen.findByText("ตั้งรหัส PIN ใหม่ 6 หลัก");

    const enterPin = (pin: string) => pin.split("").forEach((digit) => {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    });
    enterPin("135246");
    await screen.findByText("ยืนยันรหัส PIN ใหม่");
    enterPin("135246");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const confirmCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/pin/reset/confirm/"));
    expect(JSON.parse(confirmCall?.[1]?.body as string)).toEqual({ reset_token: "test-reset-token", pin: "135246" });
  });

  it("blocks recovery when the account has no email", () => {
    render(createElement(PinAuthView, { mode: "reset", onSuccess: vi.fn() }));
    expect(screen.getByText(/ยังไม่มีอีเมลสำหรับกู้ PIN/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ขอรหัสยืนยันทางอีเมล/ })).toBeDisabled();
  });
});
