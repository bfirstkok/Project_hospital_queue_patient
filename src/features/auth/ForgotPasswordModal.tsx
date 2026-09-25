import { useEffect, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import { EyeIcon, EyeOffIcon } from "@/shared/ui/Icons";

// พร็อพส์สำหรับหน้าต่างกู้คืนรหัสผ่าน
interface ForgotPasswordModalProps {
  isOpen: boolean;                      // สถานะเปิด/ปิด Modal
  onClose: () => void;                  // ฟังก์ชันปิดหน้าต่าง
  onSuccess: (message: string) => void; // ฟังก์ชันเมื่อเปลี่ยนรหัสผ่านสำเร็จ
}

// ลำดับขั้นตอนของการกู้คืนรหัสผ่าน (ขอ OTP -> ตรวจสอบ OTP -> ตั้งรหัสใหม่ -> เสร็จสิ้น)
type Step = "request" | "verify" | "reset" | "completed";

/**
 * คอมโพเนนต์หน้าต่างป๊อปอัปสำหรับกู้คืนรหัสผ่านผู้ป่วยผ่าน OTP 3 ขั้นตอน (`ForgotPasswordModal`)
 * (ฟังก์ชันความปลอดภัยที่มักใช้อธิบายเรื่อง Authentication & Security ในการสอบวิทยานิพนธ์)
 *
 * ขั้นตอนการทำงาน (Workflow):
 * 1. ขั้น 'request': ผู้ป่วยกรอกอีเมลที่ลงทะเบียนไว้ เพื่อขอรับรหัส OTP 6 หลัก
 * 2. ขั้น 'verify': กรอกรหัส OTP 6 หลักเพื่อยืนยันตัวตน และรับ `reset_token`
 * 3. ขั้น 'reset': กำหนดรหัสผ่านใหม่และยืนยันรหัสผ่าน (ความยาวอย่างน้อย 8 ตัวอักษร)
 * 4. ขั้น 'completed': แสดงข้อความยืนยันความสำเร็จ และนำทางกลับไปหน้าล็อกอิน
 */
export function ForgotPasswordModal({ isOpen, onClose, onSuccess }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // รีเซ็ตสถานะเมื่อเปิดหน้าต่างขึ้นมาใหม่
  useEffect(() => {
    if (isOpen) {
      setStep("request");
      setIdentifier("");
      setOtp("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMessage("");
      setSuccessMessage("");
      setCooldown(0);
    }
  }, [isOpen]);

  // ตัวนับเวลาถอยหลัง (Cooldown Timer) สำหรับหน่วงเวลาก่อนขอ OTP ใหม่
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  /**
   * ขั้นตอนที่ 1: ส่งคำขอรหัส OTP ไปยังอีเมลที่ลงทะเบียนไว้
   */
  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage("กรุณาระบุอีเมลที่ลงทะเบียนไว้");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await patientApi.requestPasswordReset({
        identifier: identifier.trim(),
        channel: "email",
      });
      setSuccessMessage(res.message || "ระบบได้ส่งรหัส OTP เรียบร้อยแล้ว");
      setCooldown(res.cooldown_seconds || 60);
      setStep("verify");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : "ไม่สามารถส่งรหัส OTP ได้");
      setErrorMessage(apiErr.message === "Failed to fetch" ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiErr.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * ขั้นตอนที่ 2: ตรวจสอบความถูกต้องของรหัส OTP 6 หลัก และรับ Reset Token
   */
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setErrorMessage("กรุณาระบุรหัส OTP ให้ครบ 6 หลัก");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await patientApi.verifyPasswordResetOtp({
        identifier: identifier.trim(),
        otp: cleanOtp,
      });
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
      setSuccessMessage("ยืนยันรหัส OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่");
      setStep("reset");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : "รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
      setErrorMessage(apiErr.message === "Failed to fetch" ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiErr.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * ขั้นตอนที่ 3: ส่งรหัสผ่านใหม่ไปยังเซิร์ฟเวอร์เพื่อเสร็จสิ้นการรีเซ็ตรหัสผ่าน
   */
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await patientApi.confirmPasswordReset({
        reset_token: resetToken || undefined,
        identifier: identifier.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setStep("completed");
      onSuccess("เปลี่ยนรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : "ไม่สามารถตั้งรหัสผ่านใหม่ได้");
      setErrorMessage(apiErr.message === "Failed to fetch" ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiErr.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="forgotPasswordTitle">
      <div className="modal-content forgot-password-modal">
        <div className="modal-header">
          <h2 id="forgotPasswordTitle">
            {step === "request" && "🔑 ลืมรหัสผ่าน / กู้คืนบัญชี"}
            {step === "verify" && "📩 ยืนยันรหัส OTP"}
            {step === "reset" && "🔒 ตั้งรหัสผ่านใหม่"}
            {step === "completed" && "✅ เปลี่ยนรหัสผ่านสำเร็จ"}
          </h2>
          <button type="button" className="close-modal-btn" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="alert" role="alert" style={{ marginBottom: "16px" }}>
            {errorMessage}
          </div>
        )}

        {successMessage && step !== "completed" && (
          <div className="success-banner" role="status" style={{ marginBottom: "16px" }}>
            ✓ {successMessage}
          </div>
        )}

        {/* ขั้นตอนที่ 1: ขอรับรหัส OTP */}
        {step === "request" && (
          <form onSubmit={handleRequestOtp} className="forgot-password-form">
            <p className="forgot-desc">
              กรอกอีเมลที่ลงทะเบียนไว้เพื่อรับรหัสยืนยันตัวตน (OTP 6 หลัก)
            </p>

            <label className="field">
              <span>อีเมลที่ลงทะเบียน <b>*</b></span>
              <input
                name="identifier"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="เช่น somchai99@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </label>

            <p className="forgot-desc">รหัส OTP จะส่งไปยังอีเมลที่ลงทะเบียนไว้</p>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "กำลังส่งรหัส OTP..." : "ส่งรหัส OTP →"}
              </button>
              <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>
                ยกเลิก
              </button>
            </div>
          </form>
        )}

        {/* ขั้นตอนที่ 2: กรอกยืนยันรหัส OTP */}
        {step === "verify" && (
          <form onSubmit={handleVerifyOtp} className="forgot-password-form">
            <p className="forgot-desc">
              กรุณากรอกรหัส OTP 6 หลักที่ได้รับทางอีเมล
            </p>

            <label className="field">
              <span>รหัส OTP 6 หลัก <b>*</b></span>
              <input
                name="otp"
                maxLength={6}
                minLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                autoFocus
                placeholder="ตัวเลข 6 หลัก"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ textAlign: "center", fontSize: "1.4rem", letterSpacing: "6px" }}
              />
            </label>

            <div className="resend-otp-container" style={{ margin: "14px 0", fontSize: "0.9rem" }}>
              {cooldown > 0 ? (
                <span style={{ color: "var(--text-muted, #64748b)" }}>
                  ขอรหัสใหม่อีกครั้งได้ในอีก {cooldown} วินาที
                </span>
              ) : (
                <button
                  type="button"
                  className="text-button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                >
                  ↻ ขอรหัส OTP ใหม่อีกครั้ง
                </button>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="primary-button" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP →"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setStep("request")}
                disabled={loading}
              >
                ย้อนกลับ
              </button>
            </div>
          </form>
        )}

        {/* ขั้นตอนที่ 3: ตั้งรหัสผ่านใหม่ */}
        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="forgot-password-form">
            <p className="forgot-desc">
              กำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบ (ความยาวอย่างน้อย 8 ตัวอักษร)
            </p>

            <label className="field">
              <span>รหัสผ่านใหม่ <b>*</b></span>
              <div className="password-input-wrapper">
                <input
                  name="new_password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  required
                  autoFocus
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <label className="field">
              <span>ยืนยันรหัสผ่านใหม่อีกครั้ง <b>*</b></span>
              <input
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
              <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>
                ยกเลิก
              </button>
            </div>
          </form>
        )}

        {/* ขั้นตอนที่ 4: เสร็จสิ้นสมบูรณ์ */}
        {step === "completed" && (
          <div className="completed-box" style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎉</div>
            <h3>ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว</h3>
            <p style={{ color: "var(--text-muted, #64748b)", margin: "8px 0 24px" }}>
              ท่านสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={onClose}
              style={{ width: "100%", justifyContent: "center" }}
            >
              เข้าสู่ระบบเลย →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
