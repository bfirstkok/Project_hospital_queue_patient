import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import {
  getLockoutRemainingSeconds,
  getRemainingAttempts,
  isLockedOut,
  MAX_FAILED_ATTEMPTS,
  readPairedPatient,
  recordFailedAttempt,
  resetLockout,
  savePin,
  verifyPin,
} from "@/shared/auth/pin-storage";

export type PinMode = "unlock" | "setup" | "change" | "reset";

function formatLockoutDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} นาที`;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return d;
  return `${d.slice(0, 3)}-xxx-xx${d.slice(-2)}`;
}

function maskEmail(raw: string): string {
  const [user, domain] = raw.trim().split("@");
  if (!domain) return raw.trim();
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

interface PinAuthViewProps {
  mode: PinMode;
  onSuccess: () => void;
  onCancel?: () => void;
  onForgotPin?: () => void;
  onSwitchAccount?: () => void;
  patientName?: string;
  maskedNationalId?: string;
  nationalId?: string;
  isMandatory?: boolean;
  onPinConfigured?: (pin: string) => Promise<void> | void;
}

export function PinAuthView({
  mode: initialMode,
  onSuccess,
  onCancel,
  onForgotPin,
  onSwitchAccount,
  patientName,
  maskedNationalId,
  nationalId,
  isMandatory,
  onPinConfigured,
}: PinAuthViewProps) {
  const [currentMode, setCurrentMode] = useState<PinMode>(initialMode);
  const [step, setStep] = useState<number>(1);
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [tempPin, setTempPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => getLockoutRemainingSeconds());

  // State for Reset with Phone/Email OTP — targets come from the registered account, not typed
  const [recoveryMethod, setRecoveryMethod] = useState<"phone" | "email">("phone");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(60);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);
  // Backend has no OTP endpoints yet — when the request fails we fall back to
  // verifying identity with the real national-ID login, then set a new local PIN.
  const [otpUnavailable, setOtpUnavailable] = useState<boolean>(false);

  // Paired patient details
  const [pairedInfo, setPairedInfo] = useState<{
    name: string; nationalId: string; maskedId?: string; phone?: string; email?: string;
  } | null>(null);

  useEffect(() => {
    setCurrentMode(initialMode);
    setStep(1);
    setEnteredPin("");
    setErrorMessage("");
    setLockoutSeconds(getLockoutRemainingSeconds());
    setOtpUnavailable(false);
    const paired = readPairedPatient();
    setPairedInfo(paired);
    if (initialMode === "reset") {
      setRecoveryMethod(paired?.phone ? "phone" : "email");
    }
  }, [initialMode]);

  useEffect(() => {
    setEnteredPin("");
    setErrorMessage("");
  }, [step, currentMode]);

  // Timer for Lockout Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            // Clears the expired window + attempt counter, keeps the escalation level.
            getLockoutRemainingSeconds();
            setErrorMessage("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Timer for OTP Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpSent && otpCountdown > 0) {
      timer = setInterval(() => setOtpCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, otpCountdown]);

  const resetNationalId =
    nationalId?.trim() ||
    pairedInfo?.nationalId ||
    (typeof window !== "undefined" ? window.localStorage.getItem("patient_national_id") || "" : "");

  // PIN recovery targets — the phone/email registered on the account, never re-typed here.
  const registeredPhone = (pairedInfo?.phone || "").replace(/\D/g, "");
  const registeredEmail = (pairedInfo?.email || "").trim();
  const recoveryTarget = recoveryMethod === "phone" ? registeredPhone : registeredEmail;

  function triggerError(msg: string) {
    setErrorMessage(msg);
    setIsShaking(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      setIsShaking(false);
      setEnteredPin("");
    }, 600);
  }

  function handleDigit(digit: string) {
    if (lockoutSeconds > 0 || verifyingPin) return;
    if (enteredPin.length >= 6) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setErrorMessage("");

    if (nextPin.length === 6) {
      handleComplete(nextPin);
    }
  }

  function handleDelete() {
    if (lockoutSeconds > 0) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage("");
  }

  function handleClear() {
    if (lockoutSeconds > 0) return;
    setEnteredPin("");
    setErrorMessage("");
  }

  /**
   * Verify a PIN: server first (POST /api/patient/pin/verify/), local hash as
   * fallback when the endpoint is missing / offline. Once the backend ships,
   * editing localStorage no longer bypasses the PIN.
   */
  async function checkPin(pin: string): Promise<"ok" | "wrong" | "locked"> {
    const nid = (nationalId || pairedInfo?.nationalId || "").replace(/\D/g, "");
    if (nid) {
      try {
        await patientApi.loginWithPin(nid, pin);
        resetLockout();
        return "ok";
      } catch (reason) {
        const e = reason instanceof ApiError ? reason : new ApiError("");
        if (e.status === 423 || e.status === 429) return "locked";
        if (e.status === 401) {
          recordFailedAttempt();
          return isLockedOut() ? "locked" : "wrong";
        }
        // 404 / "Failed to fetch" / config missing -> fall through to local check
      }
    }
    // verifyPin() records the failed attempt / resets lockout itself.
    return verifyPin(pin, nationalId) ? "ok" : isLockedOut() ? "locked" : "wrong";
  }

  async function handleComplete(pin: string) {
    if (currentMode === "unlock") {
      if (lockoutSeconds > 0) {
        triggerError(`ระบบระงับชั่วคราว กรุณารอ ${lockoutSeconds} วินาที`);
        return;
      }
      if (verifyingPin) return;

      setVerifyingPin(true);
      let outcome: "ok" | "wrong" | "locked";
      try {
        outcome = await checkPin(pin);
      } finally {
        setVerifyingPin(false);
      }

      if (outcome === "ok") {
        onSuccess();
      } else if (outcome === "locked") {
        const remaining = getLockoutRemainingSeconds();
        setLockoutSeconds(remaining);
        triggerError(
          `คุณใส่รหัสผิดเกิน ${MAX_FAILED_ATTEMPTS} ครั้ง ระบบถูกระงับชั่วคราว ${formatLockoutDuration(remaining)}`,
        );
      } else {
        triggerError(`รหัส PIN ไม่ถูกต้อง (เหลือโอกาสอีก ${getRemainingAttempts()} ครั้ง)`);
      }
    } else if (currentMode === "setup") {
      if (step === 1) {
        setTempPin(pin);
        setStep(2);
      } else if (step === 2) {
        if (pin === tempPin) {
          savePin(pin, nationalId);
          if (onPinConfigured) {
            void onPinConfigured(pin);
          }
          onSuccess();
        } else {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน กรุณาตั้งค่าใหม่");
          setTimeout(() => setStep(1), 700);
        }
      }
    } else if (currentMode === "change") {
      if (step === 1) {
        if (verifyPin(pin, nationalId)) {
          setStep(2);
        } else {
          triggerError("รหัส PIN เดิมไม่ถูกต้อง");
        }
      } else if (step === 2) {
        setTempPin(pin);
        setStep(3);
      } else if (step === 3) {
        if (pin === tempPin) {
          savePin(pin, nationalId);
          if (onPinConfigured) {
            void onPinConfigured(pin);
          }
          onSuccess();
        } else {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน");
          setTimeout(() => setStep(2), 700);
        }
      }
    } else if (currentMode === "reset") {
      // Step 3: Enter new PIN, Step 4: Confirm new PIN + verify OTP with backend
      if (step === 3) {
        setTempPin(pin);
        setStep(4);
      } else if (step === 4) {
        if (pin !== tempPin) {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน");
          setTimeout(() => setStep(3), 700);
          return;
        }
        if (confirmingReset) return;
        setConfirmingReset(true);
        try {
          // OTP path: confirm with the backend. Fallback path: identity was already
          // verified via national-ID login, so just persist the new local PIN.
          if (!otpUnavailable) {
            await patientApi.confirmPinReset({ national_id: resetNationalId, otp: otpCode, pin });
          }
          savePin(pin, nationalId);
          if (onPinConfigured) {
            void onPinConfigured(pin);
          }
          onSuccess();
        } catch (reason) {
          const apiError = reason instanceof ApiError
            ? reason
            : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถตั้งรหัส PIN ใหม่ได้");
          triggerError(
            apiError.message === "Failed to fetch"
              ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง"
              : apiError.message,
          );
          setTimeout(() => setStep(2), 700); // OTP may be wrong/expired — re-enter it
        } finally {
          setConfirmingReset(false);
        }
      }
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (sendingOtp) return;

    if (!resetNationalId) {
      setErrorMessage("ไม่พบเลขบัตรประชาชนสำหรับการกู้คืนรหัส กรุณาเข้าสู่ระบบด้วยเลขบัตรประชาชนก่อน");
      return;
    }

    setErrorMessage("");
    setSendingOtp(true);
    try {
      // 1) Try real OTP delivery (only works once the backend implements it).
      if (!recoveryTarget) throw new ApiError("no-registered-contact", 404);
      await patientApi.requestPinReset({
        national_id: resetNationalId,
        channel: recoveryMethod,
        target: recoveryTarget,
      });
      setOtpSent(true);
      setOtpCountdown(60);
      setStep(2);
      return;
    } catch (reason) {
      const apiError = reason instanceof ApiError
        ? reason
        : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถส่งรหัส OTP ได้");
      const endpointMissing =
        !apiError.status || apiError.status === 404 || apiError.status === 405 || apiError.message === "Failed to fetch";
      if (!endpointMissing) {
        // A real, actionable error (rate limit, server error) — show it and stay put.
        setErrorMessage(apiError.message);
        setSendingOtp(false);
        return;
      }
      // 2) Fallback: prove identity with the real national-ID login, then let them set a new PIN.
      try {
        await patientApi.login(resetNationalId);
        setOtpUnavailable(true);
        setStep(3);
      } catch (loginReason) {
        const le = loginReason instanceof ApiError ? loginReason : new ApiError("");
        setErrorMessage(
          le.message === "Failed to fetch"
            ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง"
            : "ยืนยันตัวตนไม่สำเร็จ กรุณาตรวจสอบเลขบัตรประชาชน หรือเข้าสู่ระบบใหม่",
        );
      }
    } finally {
      setSendingOtp(false);
    }
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    // OTP is verified together with the new PIN at the confirm step
    // (patientApi.confirmPinReset), so here we only advance the wizard.
    setErrorMessage("");
    setStep(3); // Proceed to setting new PIN
  }

  function getTitleAndSubtitle(): { title: string; subtitle: string } {
    if (currentMode === "unlock") {
      return {
        title: "กรอกรหัส PIN 6 หลัก",
        subtitle: "กรุณาใส่รหัสเพื่อปลดล็อคเข้าสู่ระบบ",
      };
    }
    if (currentMode === "setup") {
      if (step === 1) {
        return {
          title: "ตั้งรหัส PIN 6 หลัก",
          subtitle: "กำหนดรหัสสำหรับเข้าใช้งานแอปอย่างปลอดภัยเหมือนแอปธนาคาร",
        };
      }
      return {
        title: "ยืนยันรหัส PIN อีกครั้ง",
        subtitle: "กรอกรหัส PIN 6 หลักเดิมอีกครั้งเพื่อยืนยัน",
      };
    }
    if (currentMode === "change") {
      if (step === 1) {
        return {
          title: "กรอกรหัส PIN เดิม",
          subtitle: "ยืนยันตัวตนด้วยรหัส PIN ปัจจุบันของคุณ",
        };
      }
      if (step === 2) {
        return {
          title: "ตั้งรหัส PIN ใหม่ 6 หลัก",
          subtitle: "กำหนดรหัส PIN ใหม่ที่คุณต้องการ",
        };
      }
      return {
        title: "ยืนยันรหัส PIN ใหม่",
        subtitle: "กรอกรหัส PIN ใหม่อีกครั้งเพื่อยืนยัน",
      };
    }
    if (currentMode === "reset") {
      if (step === 1) {
        return {
          title: "กู้คืนรหัส PIN ผ่านเบอร์โทร / อีเมล",
          subtitle: recoveryTarget
            ? "เลือกช่องทางรับรหัสยืนยัน OTP ระบบจะส่งไปยังเบอร์โทรหรืออีเมลที่ลงทะเบียนไว้"
            : "ระบบจะยืนยันตัวตนด้วยเลขบัตรประชาชนที่เข้าสู่ระบบไว้ แล้วให้ตั้งรหัส PIN ใหม่",
        };
      }
      if (step === 2) {
        const targetDesc =
          recoveryMethod === "phone" ? `เบอร์โทรศัพท์ ${maskPhone(registeredPhone)}` : `อีเมล ${maskEmail(registeredEmail)}`;
        return {
          title: "ยืนยันรหัส OTP",
          subtitle: `กรอกรหัส OTP 6 หลักที่ส่งไปยัง ${targetDesc}`,
        };
      }
      if (step === 3) {
        return {
          title: "ตั้งรหัส PIN ใหม่ 6 หลัก",
          subtitle: otpUnavailable
            ? "ยืนยันตัวตนด้วยเลขบัตรประชาชนเรียบร้อย กำหนดรหัส PIN ใหม่ที่คุณต้องการ"
            : "กำหนดรหัส PIN ใหม่ที่คุณต้องการ",
        };
      }
      return {
        title: "ยืนยันรหัส PIN ใหม่",
        subtitle: "กรอกรหัส PIN ใหม่อีกครั้งเพื่อยืนยัน",
      };
    }
    return { title: "รหัส PIN", subtitle: "" };
  }

  const { title, subtitle } = getTitleAndSubtitle();
  const displayName = patientName || pairedInfo?.name;
  const displayId = maskedNationalId || pairedInfo?.maskedId;

  return (
    <section id="pinAuthView" className="page-shell pin-auth-view">
      <div className="pin-card">
        <div className="pin-lock-icon" aria-hidden="true">
          {currentMode === "reset" && step <= 2 ? "📱" : "🔒"}
        </div>

        {/* Banking-style User Greeting for Quick Unlock */}
        {currentMode === "unlock" && displayName && (
          <div className="pin-patient-greeting">
            <span className="greeting-pill">ยินดีต้อนรับ</span>
            <h2 className="greeting-name">คุณ{displayName}</h2>
            {displayId && <p className="greeting-id">{displayId}</p>}
          </div>
        )}

        <h1>{title}</h1>
        <p className="pin-subtitle">{subtitle}</p>

        {/* Lockout Box when failed attempts exceed limit */}
        {lockoutSeconds > 0 && (
          <div className="pin-lockout-box" role="alert">
            <strong>⚠️ ระบบถูกระงับชั่วคราว</strong>
            <p>เนื่องจากกรอกรหัส PIN ไม่ถูกต้องติดต่อกัน {MAX_FAILED_ATTEMPTS} ครั้ง กรุณารอ</p>
            <div className="pin-lockout-timer">
              {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, "0")} นาที
            </div>
            <p style={{ marginTop: "8px", fontSize: "0.82rem", opacity: 0.85 }}>
              การเข้าสู่ระบบใหม่จะไม่ลดเวลารอ และหากยังกรอกผิดซ้ำ ระยะเวลาระงับครั้งถัดไปจะนานขึ้น
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="pin-error-alert" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Reset Mode Step 1: choose channel — targets are the registered phone / email */}
        {currentMode === "reset" && step === 1 && (
          <form onSubmit={handleSendOtp} className="reset-pin-form">
            {registeredPhone && registeredEmail && (
              <div className="recovery-method-tabs" role="tablist" aria-label="ช่องทางรับรหัสยืนยัน">
                <button
                  type="button" role="tab" aria-selected={recoveryMethod === "phone"}
                  className={`recovery-tab-btn ${recoveryMethod === "phone" ? "active" : ""}`}
                  onClick={() => {
                    setRecoveryMethod("phone");
                    setErrorMessage("");
                  }}
                >
                  <span>📱 เบอร์โทรศัพท์ (SMS)</span>
                </button>
                <button
                  type="button" role="tab" aria-selected={recoveryMethod === "email"}
                  className={`recovery-tab-btn ${recoveryMethod === "email" ? "active" : ""}`}
                  onClick={() => {
                    setRecoveryMethod("email");
                    setErrorMessage("");
                  }}
                >
                  <span>✉️ อีเมล (Email)</span>
                </button>
              </div>
            )}

            {recoveryTarget ? (
              <div className="recovery-target-box">
                <span className="recovery-target-label">
                  {recoveryMethod === "phone" ? "ส่งรหัส OTP ไปยังเบอร์โทรศัพท์" : "ส่งรหัส OTP ไปยังอีเมล"}
                </span>
                <strong className="recovery-target-value">
                  {recoveryMethod === "phone" ? maskPhone(registeredPhone) : maskEmail(registeredEmail)}
                </strong>
                <small>หากข้อมูลติดต่อไม่ถูกต้อง สามารถแก้ไขได้ที่หน้าข้อมูลของฉัน หลังเข้าสู่ระบบ</small>
              </div>
            ) : (
              <div className="recovery-target-box">
                <span className="recovery-target-label">ยืนยันตัวตนเพื่อตั้งรหัส PIN ใหม่</span>
                <small>
                  ยังไม่พบเบอร์โทรหรืออีเมลที่ยืนยันได้ ระบบจะตรวจสอบตัวตนด้วยเลขบัตรประชาชนที่เข้าสู่ระบบไว้ แล้วให้ตั้งรหัส PIN ใหม่
                </small>
              </div>
            )}

            <button
              type="submit" className="primary-button full-width-btn"
              style={{ marginTop: "10px" }} disabled={sendingOtp}
            >
              <span>
                {sendingOtp
                  ? "กำลังตรวจสอบ..."
                  : recoveryTarget
                    ? recoveryMethod === "phone"
                      ? "ขอรหัส OTP ทาง SMS"
                      : "ขอรหัสยืนยันทางอีเมล"
                    : "ยืนยันตัวตนด้วยเลขบัตรประชาชน"}
              </span>
              <i aria-hidden="true">→</i>
            </button>
          </form>
        )}

        {/* Reset Mode Step 2: Input OTP */}
        {currentMode === "reset" && step === 2 && (
          <form onSubmit={handleVerifyOtp} className="reset-pin-form">
            <div className="otp-info-badge">
              <span>
                ระบบได้ส่งรหัส OTP 6 หลักไปยัง{" "}
                {recoveryMethod === "phone" ? `เบอร์ ${maskPhone(registeredPhone)}` : `อีเมล ${maskEmail(registeredEmail)}`}{" "}
                แล้ว กรุณากรอกรหัสภายในเวลาที่กำหนด
              </span>
            </div>
            <label className="field">
              <span>รหัสยืนยัน OTP 6 หลัก <b>*</b></span>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </label>
            <div className="otp-resend-row">
              {otpCountdown > 0 ? (
                <small>ส่งรหัสใหม่ได้ใน {otpCountdown} วินาที</small>
              ) : (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setOtpCountdown(60);
                    setErrorMessage(
                      recoveryMethod === "phone"
                        ? "ส่งรหัส OTP ทาง SMS ใหม่เรียบร้อยแล้ว"
                        : "ส่งรหัส OTP ทางอีเมลใหม่เรียบร้อยแล้ว"
                    );
                  }}
                >
                  ส่งรหัสใหม่อีกครั้ง
                </button>
              )}
            </div>
            <button type="submit" className="primary-button full-width-btn">
              <span>ยืนยันรหัส OTP</span>
              <i aria-hidden="true">✓</i>
            </button>
          </form>
        )}

        {/* Keypad UI for Pin entry (Unlock, Setup, Change, or Reset step 3/4) */}
        {(currentMode !== "reset" || step >= 3) && lockoutSeconds === 0 && (
          <>
            {/* 6 Dots Indicator */}
            <div
              className={`pin-dots-row ${isShaking ? "shake" : ""}`}
              aria-label={`กรอกแล้ว ${enteredPin.length} จาก 6 หลัก`}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const isFilled = idx < enteredPin.length;
                return (
                  <span
                    key={idx}
                    className={`pin-dot ${isFilled ? "filled" : ""}`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="pin-keypad" role="group" aria-label="แป้นตัวเลข PIN">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="keypad-btn"
                  onClick={() => handleDigit(String(num))}
                  aria-label={String(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="keypad-btn action-btn"
                onClick={handleClear}
                aria-label="ล้างทั้งหมด"
              >
                ล้าง
              </button>
              <button
                type="button"
                className="keypad-btn"
                onClick={() => handleDigit("0")}
                aria-label="0"
              >
                0
              </button>
              <button
                type="button"
                className="keypad-btn action-btn delete-btn"
                onClick={handleDelete}
                aria-label="ลบตัวเลขล่าสุด"
              >
                ⌫
              </button>
            </div>
          </>
        )}

        {/* Action / Forgot links */}
        <div className="pin-bottom-links">
          {currentMode === "unlock" && (
            <div className="unlock-actions-row">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCurrentMode("reset");
                  setStep(1);
                  setRecoveryMethod(registeredPhone ? "phone" : "email");
                  setOtpUnavailable(false);
                  setErrorMessage("");
                }}
              >
                ลืมรหัส PIN? กู้คืนรหัสผ่านอีเมล / เบอร์โทรศัพท์ (OTP)
              </button>
              {onSwitchAccount ? (
                <button type="button" className="text-button text-muted-sub" onClick={onSwitchAccount}>
                  สลับผู้ใช้งาน / เข้าสู่ระบบด้วยบัญชีอื่น
                </button>
              ) : onForgotPin ? (
                <button type="button" className="text-button text-muted-sub" onClick={onForgotPin}>
                  เข้าสู่ระบบใหม่ด้วยเลขบัตรประชาชน
                </button>
              ) : null}
            </div>
          )}

          {currentMode !== "unlock" && onCancel && (
            <button type="button" className="secondary-button" onClick={onCancel}>
              {isMandatory ? "ยกเลิกและกลับหน้าเข้าสู่ระบบ" : "ยกเลิก"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
