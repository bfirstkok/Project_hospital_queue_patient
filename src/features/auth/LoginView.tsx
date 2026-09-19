import { useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import { EyeIcon, EyeOffIcon } from "@/shared/ui/Icons";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

interface LoginViewProps {
  onRegister: () => void;
  onSuccess: (token: string, nationalId?: string) => void;
}

export function LoginView({ onRegister, onSuccess }: LoginViewProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMsg, setIsSuccessMsg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccessMsg(false);

    if (!identifier.trim()) {
      setMessage("กรุณากรอกชื่อผู้ใช้ อีเมล หรือเลขบัตรประชาชน");
      return;
    }

    setLoading(true);
    try {
      const cleanIdentifier = identifier.trim();
      const result = await patientApi.login({
        identifier: cleanIdentifier,
        password: password || undefined,
      });

      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");

      const cleanDigits = cleanIdentifier.replace(/\D/g, "");
      // Security: Do not persist PII (National ID) on client storage. Purge any legacy keys.
      try {
        sessionStorage.removeItem("patient_national_id");
        localStorage.removeItem("patient_national_id");
      } catch {
        // ignore
      }
      onSuccess(result.access_token, cleanDigits.length === 13 ? cleanDigits : undefined);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบได้");
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setMessage("");
    setIsSuccessMsg(false);
    try {
      const mockGoogleIdToken = `google_oauth_token_${Date.now()}`;
      const result = await patientApi.loginWithGoogle(mockGoogleIdToken);
      if (!result.access_token) throw new ApiError("ไม่ได้รับ access token จากระบบ Google");
      onSuccess(result.access_token);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="loginView" className="page-shell auth-view">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">+</div>
        <p className="eyebrow">ระบบบริการผู้ป่วยนอก (OPD)</p>
        <h1>เข้าสู่ระบบผู้ป่วย</h1>
        <p className="auth-description">
          กรุณากรอกชื่อผู้ใช้งาน/อีเมล และรหัสผ่าน หรือเข้าสู่ระบบด้วย Google เพื่อเข้าสู่บริการคิวและข้อมูลการรักษา
        </p>

        {message && (
          <div className={isSuccessMsg ? "success-banner" : "alert"} role="alert">
            {isSuccessMsg ? `✓ ${message}` : message}
          </div>
        )}

        <form autoComplete="on" onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-identifier">
              <span>ชื่อผู้ใช้ หรือ อีเมล <b>*</b></span>
            </label>
            <input
              id="login-identifier"
              name="identifier"
              required
              autoComplete="username"
              placeholder="เช่น somchai99 หรือ somchai@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="login-password">
                <span>รหัสผ่าน <b>*</b></span>
              </label>
              <button
                type="button"
                className="text-button forgot-link"
                onClick={() => setIsForgotOpen(true)}
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่านของคุณ"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
            <i aria-hidden="true">{loading ? "↻" : "→"}</i>
          </button>
        </form>

        {/* Social / Google Login */}
        <div className="divider-line"><span>หรือเข้าสู่ระบบด้วย</span></div>
        <button
          type="button"
          className="google-sign-in-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>

        {/* Register link below login */}
        <div className="register-redirect-box">
          <div className="divider-line"><span>หรือ</span></div>
          <p>ยังไม่มีประวัติหรือยังไม่เคยลงทะเบียน?</p>
          <button
            type="button"
            className="secondary-button register-link-btn"
            onClick={onRegister}
          >
            📝 ลงทะเบียนผู้ป่วยใหม่
          </button>
        </div>

        <p className="privacy-note">ข้อมูลสุขภาพจะแสดงหลังยืนยันตัวตนถูกต้องตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        onSuccess={(msg) => {
          setIsForgotOpen(false);
          setIsSuccessMsg(true);
          setMessage(msg);
        }}
      />
    </section>
  );
}
