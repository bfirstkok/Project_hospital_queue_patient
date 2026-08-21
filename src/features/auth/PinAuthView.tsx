import { useEffect, useState } from "react";
import { savePin, verifyPin } from "@/shared/auth/pin-storage";

export type PinMode = "unlock" | "setup" | "change" | "reset";

interface PinAuthViewProps {
  mode: PinMode;
  onSuccess: () => void;
  onCancel?: () => void;
  onForgotPin?: () => void;
}

export function PinAuthView({ mode: initialMode, onSuccess, onCancel, onForgotPin }: PinAuthViewProps) {
  const [currentMode, setCurrentMode] = useState<PinMode>(initialMode);
  const [step, setStep] = useState<number>(1);
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [tempPin, setTempPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // State for Reset with Phone/OTP
  const [resetPhone, setResetPhone] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(60);

  useEffect(() => {
    setCurrentMode(initialMode);
    setStep(1);
    setEnteredPin("");
    setErrorMessage("");
  }, [initialMode]);

  useEffect(() => {
    setEnteredPin("");
    setErrorMessage("");
  }, [step, currentMode]);

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
    if (enteredPin.length >= 6) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setErrorMessage("");

    if (nextPin.length === 6) {
      handleComplete(nextPin);
    }
  }

  function handleDelete() {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage("");
  }

  function handleClear() {
    setEnteredPin("");
    setErrorMessage("");
  }

  function handleComplete(pin: string) {
    if (currentMode === "unlock") {
      if (verifyPin(pin)) {
        onSuccess();
      } else {
        triggerError("รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }
    } else if (currentMode === "setup") {
      if (step === 1) {
        setTempPin(pin);
        setStep(2);
      } else if (step === 2) {
        if (pin === tempPin) {
          savePin(pin);
          onSuccess();
        } else {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน กรุณาตั้งค่าใหม่");
          setTimeout(() => setStep(1), 700);
        }
      }
    } else if (currentMode === "change") {
      if (step === 1) {
        if (verifyPin(pin)) {
          setStep(2);
        } else {
          triggerError("รหัส PIN เดิมไม่ถูกต้อง");
        }
      } else if (step === 2) {
        setTempPin(pin);
        setStep(3);
      } else if (step === 3) {
        if (pin === tempPin) {
          savePin(pin);
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
          savePin(pin);
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
    if (!resetPhone || resetPhone.length < 9) {
      setErrorMessage("กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก)");
      return;
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
          subtitle: "กำหนดรหัสสำหรับเข้าใช้งานแอปอย่างปลอดภัย",
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
          title: "รีเซ็ตรหัส PIN ผ่านเบอร์โทร",
          subtitle: "ระบุเบอร์โทรศัพท์ที่ลงทะเบียนไว้เพื่อรับรหัส OTP",
        };
      }
      if (step === 2) {
        return {
          title: "ยืนยันรหัส OTP",
          subtitle: `กรอกรหัส OTP 6 หลักที่ส่งไปยัง ${resetPhone}`,
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

  return (
    <section id="pinAuthView" className="page-shell pin-auth-view">
      <div className="pin-card">
        <div className="pin-lock-icon" aria-hidden="true">
          {currentMode === "reset" && step <= 2 ? "📱" : "🔒"}
        </div>
        <h1>{title}</h1>
        <p className="pin-subtitle">{subtitle}</p>

        {errorMessage && (
          <div className="pin-error-alert" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Reset Mode Step 1: Input Phone */}
        {currentMode === "reset" && step === 1 && (
          <form onSubmit={handleSendOtp} className="reset-pin-form">
            <label className="field">
              <span>เบอร์โทรศัพท์ที่ลงทะเบียน</span>
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
            <button type="submit" className="primary-button full-width-btn">
              ขอรหัส OTP ทาง SMS
            </button>
          </form>
        )}

        {/* Reset Mode Step 2: Input OTP */}
        {currentMode === "reset" && step === 2 && (
          <form onSubmit={handleVerifyOtp} className="reset-pin-form">
            <div className="otp-info-badge">
              <span>รหัสทดสอบ OTP คือ: <strong>123456</strong></span>
            </div>
            <label className="field">
              <span>รหัส OTP 6 หลัก</span>
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
                    setErrorMessage("ส่งรหัส OTP ใหม่เรียบร้อยแล้ว");
                  }}
                >
                  ส่งรหัสใหม่อีกครั้ง
                </button>
              )}
            </div>
            <button type="submit" className="primary-button full-width-btn">
              ยืนยันรหัส OTP
            </button>
          </form>
        )}

        {/* Keypad UI for Pin entry (Unlock, Setup, Change, or Reset step 3/4) */}
        {(currentMode !== "reset" || step >= 3) && (
          <>
            {/* 6 Dots Indicator */}
            <div className={`pin-dots-row ${isShaking ? "shake" : ""}`} aria-label={`กรอกแล้ว ${enteredPin.length} จาก 6 หลัก`}>
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
                ลืมรหัส PIN? รีเซ็ตผ่านเบอร์โทรศัพท์ (OTP)
              </button>
              {onForgotPin && (
                <button type="button" className="text-button text-muted-sub" onClick={onForgotPin}>
                  หรือ เข้าสู่ระบบใหม่ด้วยเลขบัตรประชาชน
                </button>
              )}
            </div>
          )}

          {currentMode !== "unlock" && onCancel && (
            <button type="button" className="secondary-button" onClick={onCancel}>
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
