import { useEffect, useState } from "react";
import {
  getLockoutRemainingSeconds,
  getRemainingAttempts,
  isLockedOut,
  readPairedPatient,
  resetLockout,
  savePin,
  verifyPin,
} from "@/shared/auth/pin-storage";

export type PinMode = "unlock" | "setup" | "change" | "reset";

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

  // State for Reset with Phone/Email OTP
  const [recoveryMethod, setRecoveryMethod] = useState<"phone" | "email">("phone");
  const [resetPhone, setResetPhone] = useState<string>("");
  const [resetEmail, setResetEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(60);

  // Paired patient details
  const [pairedInfo, setPairedInfo] = useState<{ name: string; nationalId: string; maskedId?: string } | null>(null);

  useEffect(() => {
    setCurrentMode(initialMode);
    setStep(1);
    setEnteredPin("");
    setErrorMessage("");
    setLockoutSeconds(getLockoutRemainingSeconds());
    const paired = readPairedPatient();
    setPairedInfo(paired);
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
            resetLockout();
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
    if (lockoutSeconds > 0) return;
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

  function handleComplete(pin: string) {
    if (currentMode === "unlock") {
      if (lockoutSeconds > 0) {
        triggerError(`ระบบระงับชั่วคราว กรุณารอ ${lockoutSeconds} วินาที`);
        return;
      }

      if (verifyPin(pin, nationalId)) {
        onSuccess();
      } else {
        if (isLockedOut()) {
          const remaining = getLockoutRemainingSeconds();
          setLockoutSeconds(remaining);
          triggerError("คุณใส่รหัสผิดเกิน 3 ครั้ง ระบบถูกระงับชั่วคราว 5 นาที");
        } else {
          const attemptsLeft = getRemainingAttempts();
          triggerError(`รหัส PIN ไม่ถูกต้อง (เหลือโอกาสอีก ${attemptsLeft} ครั้ง)`);
        }
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
      // Step 3: Enter new PIN, Step 4: Confirm new PIN
      if (step === 3) {
        setTempPin(pin);
        setStep(4);
      } else if (step === 4) {
        if (pin === tempPin) {
          savePin(pin, nationalId);
          if (onPinConfigured) {
            void onPinConfigured(pin);
          }
          onSuccess();
        } else {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน");
          setTimeout(() => setStep(3), 700);
        }
      }
    }
  }

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (recoveryMethod === "phone") {
      const cleanPhone = resetPhone.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 9) {
        setErrorMessage("กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก)");
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!resetEmail || !emailRegex.test(resetEmail.trim())) {
        setErrorMessage("กรุณาระบุอีเมลที่ถูกต้อง (เช่น patient@example.com)");
        return;
      }
    }
    setErrorMessage("");
    setOtpSent(true);
    setOtpCountdown(60);
    setStep(2);
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    // Simulation: accept any 6 digit OTP or 123456
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
          subtitle: "ระบุเบอร์โทรศัพท์หรืออีเมลที่ลงทะเบียนไว้เพื่อรับรหัสยืนยัน OTP",
        };
      }
      if (step === 2) {
        const targetDesc = recoveryMethod === "phone" ? `เบอร์โทรศัพท์ ${resetPhone}` : `อีเมล ${resetEmail}`;
        return {
          title: "ยืนยันรหัส OTP",
          subtitle: `กรอกรหัส OTP 6 หลักที่ส่งไปยัง ${targetDesc}`,
        };
      }
      if (step === 3) {
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
            <p>เนื่องจากกรอกรหัส PIN ไม่ถูกต้องติดต่อกัน 3 ครั้ง กรุณารอ</p>
            <div className="pin-lockout-timer">
              {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, "0")} นาที
            </div>
            {onForgotPin && (
              <button
                type="button"
                className="text-button"
                style={{ marginTop: "8px", textDecoration: "underline" }}
                onClick={onForgotPin}
              >
                เข้าสู่ระบบด้วยเลขบัตรประชาชนใหม่ทันที
              </button>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="pin-error-alert" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Reset Mode Step 1: Input Phone or Email */}
        {currentMode === "reset" && step === 1 && (
          <form onSubmit={handleSendOtp} className="reset-pin-form">
            <div className="recovery-method-tabs" role="tablist" aria-label="ช่องทางรับรหัสยืนยัน">
              <button
                type="button"
                role="tab"
                aria-selected={recoveryMethod === "phone"}
                className={`recovery-tab-btn ${recoveryMethod === "phone" ? "active" : ""}`}
                onClick={() => {
                  setRecoveryMethod("phone");
                  setErrorMessage("");
                }}
              >
                <span>📱 เบอร์โทรศัพท์ (SMS)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={recoveryMethod === "email"}
                className={`recovery-tab-btn ${recoveryMethod === "email" ? "active" : ""}`}
                onClick={() => {
                  setRecoveryMethod("email");
                  setErrorMessage("");
                }}
              >
                <span>✉️ อีเมล (Email)</span>
              </button>
            </div>

            {recoveryMethod === "phone" ? (
              <label className="field">
                <span>เบอร์โทรศัพท์ที่ลงทะเบียนไว้ <b>*</b></span>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  placeholder="08xxxxxxxx"
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </label>
            ) : (
              <label className="field">
                <span>อีเมลที่ลงทะเบียนไว้ <b>*</b></span>
                <input
                  type="email"
                  required
                  placeholder="patient@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoFocus
                />
              </label>
            )}

            <button type="submit" className="primary-button full-width-btn" style={{ marginTop: "10px" }}>
              <span>{recoveryMethod === "phone" ? "ขอรหัส OTP ทาง SMS" : "ขอรหัสยืนยันทางอีเมล"}</span>
              <i aria-hidden="true">→</i>
            </button>
          </form>
        )}

        {/* Reset Mode Step 2: Input OTP */}
        {currentMode === "reset" && step === 2 && (
          <form onSubmit={handleVerifyOtp} className="reset-pin-form">
            <div className="otp-info-badge">
              <span>
                รหัสทดสอบ OTP สำหรับ {recoveryMethod === "phone" ? `เบอร์ ${resetPhone}` : `อีเมล ${resetEmail}`} คือ: <strong>123456</strong>
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
