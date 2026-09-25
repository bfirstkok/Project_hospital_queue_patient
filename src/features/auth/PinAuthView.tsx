import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import {
  getLockoutRemainingSeconds,
  getRemainingAttempts,
  isLockedOut,
  isWeakPin,
  MAX_FAILED_ATTEMPTS,
  readPairedPatient,
  recordFailedAttempt,
  resetLockout,
  savePin,
  verifyPin,
} from "@/shared/auth/pin-storage";

// โหมดการทำงานของระบบรหัส PIN (ปลดล็อก, ตั้งรหัสครั้งแรก, เปลี่ยนรหัส, กู้คืนรหัส)
export type PinMode = "unlock" | "setup" | "change" | "reset";

/**
 * จัดรูปแบบระยะเวลาการระงับใช้งานให้อ่านง่าย (เช่น "1 นาที", "5 นาที")
 */
function formatLockoutDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} นาที`;
}

/**
 * ซ่อนอีเมลบางส่วน (Masking) ตามมาตรฐาน PDPA
 * ตัวอย่าง: "somchai@gmail.com" -> "so•••••@gmail.com"
 */
function maskEmail(raw: string): string {
  const [user, domain] = raw.trim().split("@");
  if (!domain) return raw.trim();
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

// พร็อพส์สำหรับคอมโพเนนต์ PinAuthView
interface PinAuthViewProps {
  mode: PinMode;                                            // โหมดเริ่มต้น
  onSuccess: () => void;                                    // เมื่อยืนยัน PIN ถูกต้อง
  onCancel?: () => void;                                    // กรณียกเลิก
  onForgotPin?: () => void;                                 // นำทางไปหน้าลืม PIN
  onSwitchAccount?: () => void;                             // สลับไปใช้บัญชีอื่น
  patientName?: string;                                     // ชื่อผู้ป่วยสำหรับแสดงทักทาย
  maskedNationalId?: string;                                // เลขบัตร ปชช. แบบ Masked
  nationalId?: string;                                      // เลขบัตร ปชช. จริง
  isMandatory?: boolean;                                    // บังคับตั้งค่า PIN หรือไม่
  onPinConfigured?: (pin: string) => Promise<void> | void;  // Callback เมื่อบันทึก PIN สำเร็จ
}

/**
 * คอมโพเนนต์แป้นพิมพ์ตัวเลขและการยืนยันตัวตนด้วยรหัส PIN 6 หลัก (`PinAuthView`)
 * (ฟังก์ชันความปลอดภัยระดับแอปพลิเคชันธนาคาร Mobile Banking)
 *
 * รองรับ 4 โหมดการทำงาน:
 * 1. 'unlock': ปลดล็อกเข้าใช้งานระบบ มีระบบล็อกบัญชีอัตโนมัติ (Lockout) เมื่อกรอกผิดเกิน 3 ครั้ง
 * 2. 'setup': ตัวช่วยสร้างรหัส PIN ใหม่ 2 ขั้นตอน (กรอกครั้งที่ 1 + ยืนยันครั้งที่ 2)
 * 3. 'change': เปลี่ยนรหัส PIN เดิมเป็นรหัสใหม่ 3 ขั้นตอน (ยืนยันรหัสเดิม -> กรอกรหัสใหม่ -> ยืนยันรหัสใหม่)
 * 4. 'reset': กู้คืนรหัส PIN ผ่านรหัส OTP ทางอีเมลที่ลงทะเบียนไว้
 */
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

  // ตัวแปรสำหรับระบบกู้คืน PIN ด้วย OTP ทางอีเมล
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(60);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string>("");
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);

  // ข้อมูลระบุตัวตนของผู้ป่วยที่ผูกกับเครื่องนี้
  const [pairedInfo, setPairedInfo] = useState<{
    name: string; nationalId: string; maskedId?: string; phone?: string; email?: string;
  } | null>(null);

  useEffect(() => {
    setCurrentMode(initialMode);
    setStep(1);
    setEnteredPin("");
    setOtpCode("");
    setOtpSent(false);
    setResetToken("");
    setErrorMessage("");
    setLockoutSeconds(getLockoutRemainingSeconds());
    const paired = readPairedPatient();
    setPairedInfo(paired);
  }, [initialMode]);

  useEffect(() => {
    setEnteredPin("");
    setErrorMessage("");
  }, [step, currentMode]);

  // ตัวนับเวลาถอยหลังการระงับสิทธิ์ (Lockout Timer Countdown)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            // เมื่อหมดเวลา: เคลียร์เวลาหมดอายุ แต่ยังคงระดับบทลงโทษไว้
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

  // ตัวนับเวลาถอยหลังการขอ OTP ใหม่ (60 วินาที)
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

  // ช่องทางปลายทางสำหรับส่ง OTP (ดึงจากบัญชีผู้ป่วย ไม่ต้องพิมพ์เอง เพื่อป้องกันการสวมรอย)
  const registeredEmail = pairedInfo?.nationalId === resetNationalId ? (pairedInfo.email || "").trim() : "";

  /**
   * แสดงข้อความเตือน พร้อมแอนิเมชันสั่นปุ่ม (Shake) และสั่นโทรศัพท์ (Haptic Feedback)
   */
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

  /**
   * จัดการเมื่อผู้ใช้กดแป้นตัวเลข 0-9
   * เมื่อกรอกครบ 6 หลัก จะเรียกฟังก์ชัน `handleComplete` ตรวจสอบทันทีอัตโนมัติ
   */
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

  /**
   * ลบตัวเลขหลักล่าสุด (Backspace)
   */
  function handleDelete() {
    if (lockoutSeconds > 0) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage("");
  }

  /**
   * ล้างตัวเลขทั้งหมดในช่อง PIN
   */
  function handleClear() {
    if (lockoutSeconds > 0) return;
    setEnteredPin("");
    setErrorMessage("");
  }

  /**
   * ตรวจสอบความถูกต้องของ PIN กับ Backend API หรือตรวจสอบกับ Local Hash
   *
   * ขั้นตอนการทำงาน:
   * 1. ตรวจสอบกับ API บนเซิร์ฟเวอร์ก่อนเป็นอันดับแรก (`POST /api/patient/pin/verify/`)
   * 2. หากออฟไลน์หรือไม่พบ endpoint จะตรวจสอบกับรหัสแฮชที่เข้ารหัสไว้ในเครื่องไคลเอนต์ (Offline-tolerant)
   *
   * @param {string} pin - รหัส PIN 6 หลักที่กรอก
   * @returns {"ok" | "wrong" | "locked"} ผลการตรวจสอบ
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
      }
    }
    return verifyPin(pin, nationalId) ? "ok" : isLockedOut() ? "locked" : "wrong";
  }

  /**
   * ฟังก์ชันประมวลผลเมื่อผู้ใช้กรอก PIN ครบ 6 หลัก
   * ประมวลผลตามโหมดปัจจุบัน (ปลดล็อก, ตั้งรหัสใหม่, เปลี่ยนรหัส, รีเซ็ตรหัส)
   */
  async function handleComplete(pin: string) {
    // 1. โหมดปลดล็อกเข้าสู่ระบบ
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
    // 2. โหมดตั้งค่า PIN ครั้งแรก
    } else if (currentMode === "setup") {
      if (step === 1) {
        // ตรวจสอบความปลอดภัยของรหัส PIN (ปฏิเสธรหัสอ่อนแอ เช่น 000000 หรือ 123456)
        if (isWeakPin(pin)) {
          triggerError("รหัส PIN ง่ายเกินไป ไม่อนุญาตให้ใช้ตัวเลขซ้ำหรือเรียงกัน");
          return;
        }
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
    // 3. โหมดเปลี่ยนรหัส PIN
    } else if (currentMode === "change") {
      if (step === 1) {
        if (verifyPin(pin, nationalId)) {
          setStep(2);
        } else {
          triggerError("รหัส PIN เดิมไม่ถูกต้อง");
        }
      } else if (step === 2) {
        if (isWeakPin(pin)) {
          triggerError("รหัส PIN ง่ายเกินไป ไม่อนุญาตให้ใช้ตัวเลขซ้ำหรือเรียงกัน");
          return;
        }
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
    // 4. โหมดกู้คืนรหัส PIN ผ่าน OTP
    } else if (currentMode === "reset") {
      if (step === 3) {
        if (isWeakPin(pin)) {
          triggerError("รหัส PIN ง่ายเกินไป ไม่อนุญาตให้ใช้ตัวเลขซ้ำหรือเรียงกัน");
          return;
        }
        setTempPin(pin);
        setStep(4);
      } else if (step === 4) {
        if (pin !== tempPin) {
          triggerError("รหัส PIN ยืนยันไม่ตรงกัน");
          setTimeout(() => setStep(3), 700);
          return;
        }
        if (!resetToken) {
          triggerError("กรุณายืนยันรหัส OTP ก่อนตั้งรหัส PIN ใหม่");
          setStep(2);
          return;
        }
        if (confirmingReset) return;
        setConfirmingReset(true);
        try {
          await patientApi.confirmPinReset({ reset_token: resetToken, pin });
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
          setResetToken("");
          setOtpCode("");
          setTimeout(() => setStep(1), 700);
        } finally {
          setConfirmingReset(false);
        }
      }
    }
  }

  /**
   * ส่งคำขอรับรหัส OTP สำหรับรีเซ็ต PIN ทางอีเมล
   */
  async function requestResetOtp() {
    if (sendingOtp) return;

    if (!resetNationalId) {
      setErrorMessage("ไม่พบเลขบัตรประชาชนสำหรับการกู้คืนรหัส กรุณาเข้าสู่ระบบด้วยเลขบัตรประชาชนก่อน");
      return;
    }

    setErrorMessage("");
    setSendingOtp(true);
    try {
      if (!registeredEmail) throw new ApiError("บัญชีนี้ยังไม่มีอีเมลสำหรับกู้ PIN กรุณาติดต่อเจ้าหน้าที่");
      await patientApi.requestPinReset({
        national_id: resetNationalId,
        channel: "email",
        target: registeredEmail,
      });
      setOtpCode("");
      setResetToken("");
      setOtpSent(true);
      setOtpCountdown(60);
      setStep(2);
      return;
    } catch (reason) {
      const apiError = reason instanceof ApiError
        ? reason
        : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถส่งรหัส OTP ได้");
      setErrorMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setSendingOtp(false);
    }
  }

  /**
   * ตรวจสอบรหัส OTP กับเซิร์ฟเวอร์ก่อนอนุญาตให้ตั้งรหัส PIN ใหม่
   */
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (verifyingOtp) return;
    if (otpCode.length !== 6) {
      setErrorMessage("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    setErrorMessage("");
    setVerifyingOtp(true);
    try {
      const result = await patientApi.verifyPinResetOtp({ national_id: resetNationalId, otp: otpCode });
      if (!result.reset_token) throw new ApiError("ไม่สามารถยืนยันรหัส OTP ได้ กรุณาขอรหัสใหม่");
      setResetToken(result.reset_token);
      setStep(3);
    } catch (reason) {
      const apiError = reason instanceof ApiError
        ? reason
        : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถยืนยันรหัส OTP ได้");
      setErrorMessage(apiError.message === "Failed to fetch"
        ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง"
        : apiError.message);
    } finally {
      setVerifyingOtp(false);
    }
  }

  /**
   * สร้างข้อความหัวเรื่องและคำอธิบายตามโหมดและขั้นตอนปัจจุบัน
   */
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
          subtitle: "กำหนดรหัสสำหรับเข้าใช้งานครั้งแรก (กรุณากรอก 2 ครั้งเพื่อยืนยัน)",
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
          title: "กู้คืนรหัส PIN ทางอีเมล",
          subtitle: "ระบบจะส่งรหัส OTP ไปยังอีเมลที่ลงทะเบียนไว้",
        };
      }
      if (step === 2) {
        return {
          title: "ยืนยันรหัส OTP",
          subtitle: `กรอกรหัส OTP 6 หลักที่ส่งไปยังอีเมล ${maskEmail(registeredEmail)}`,
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
          {currentMode === "reset" && step <= 2 ? "✉️" : "🔒"}
        </div>

        {/* แถบทักทายชื่อผู้ป่วยสไตล์ Mobile Banking */}
        {currentMode === "unlock" && displayName && (
          <div className="pin-patient-greeting">
            <span className="greeting-pill">ยินดีต้อนรับ</span>
            <h2 className="greeting-name">คุณ{displayName}</h2>
            {displayId && <p className="greeting-id">{displayId}</p>}
          </div>
        )}

        <h1>{title}</h1>
        <p className="pin-subtitle">{subtitle}</p>

        {/* กล่องแจ้งเตือนเมื่อระบบถูกระงับชั่วคราว (Lockout Alert Box) */}
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

        {/* โหมดรีเซ็ต ขั้นตอนที่ 1: ขอ OTP ทางอีเมล */}
        {currentMode === "reset" && step === 1 && (
          <form onSubmit={(event) => { event.preventDefault(); void requestResetOtp(); }} className="reset-pin-form">
            {registeredEmail ? (
              <div className="recovery-target-box">
                <span className="recovery-target-label">
                  ส่งรหัส OTP ไปยังอีเมล
                </span>
                <strong className="recovery-target-value">
                  {maskEmail(registeredEmail)}
                </strong>
                <small>หากข้อมูลติดต่อไม่ถูกต้อง สามารถแก้ไขได้ที่หน้าข้อมูลของฉัน หลังเข้าสู่ระบบ</small>
              </div>
            ) : (
              <div className="recovery-target-box">
                <span className="recovery-target-label">ยังไม่มีอีเมลสำหรับกู้ PIN</span>
                <small>กรุณาติดต่อเจ้าหน้าที่เพื่อเพิ่มอีเมลในบัญชี</small>
              </div>
            )}

            <button
              type="submit" className="primary-button full-width-btn"
              style={{ marginTop: "10px" }} disabled={sendingOtp || !registeredEmail}
            >
              <span>
                {sendingOtp ? "กำลังส่งรหัส..." : "ขอรหัสยืนยันทางอีเมล"}
              </span>
              <i aria-hidden="true">→</i>
            </button>
          </form>
        )}

        {/* โหมดรีเซ็ต ขั้นตอนที่ 2: กรอกรหัส OTP */}
        {currentMode === "reset" && step === 2 && (
          <form onSubmit={(event) => void handleVerifyOtp(event)} className="reset-pin-form">
            <div className="otp-info-badge">
              <span>
                ระบบได้ส่งรหัส OTP 6 หลักไปยัง{" "}
                อีเมล {maskEmail(registeredEmail)}{" "}
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
                  onClick={() => void requestResetOtp()}
                  disabled={sendingOtp}
                >
                  ส่งรหัสใหม่อีกครั้ง
                </button>
              )}
            </div>
            <button type="submit" className="primary-button full-width-btn" disabled={verifyingOtp}>
              <span>{verifyingOtp ? "กำลังตรวจสอบรหัส..." : "ยืนยันรหัส OTP"}</span>
              <i aria-hidden="true">✓</i>
            </button>
          </form>
        )}

        {/* แป้นพิมพ์ตัวเลข (Numeric Keypad) สำหรับกรอก PIN 6 หลัก */}
        {(currentMode !== "reset" || step >= 3) && lockoutSeconds === 0 && (
          <>
            {/* จุดแสดงสถานะตัวเลข 6 หลัก (PIN Dots) */}
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

            {/* แผงปุ่มตัวเลข 1-9, ล้าง, 0, ลบ */}
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

        {/* ลิงก์ตัวช่วยด้านล่าง (ลืม PIN, สลับบัญชี) */}
        <div className="pin-bottom-links">
          {currentMode === "unlock" && (
            <div className="unlock-actions-row">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCurrentMode("reset");
                  setStep(1);
                  setErrorMessage("");
                }}
              >
                ลืมรหัส PIN? กู้คืนด้วย OTP ทางอีเมล
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
