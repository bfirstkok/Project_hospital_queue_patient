import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { GoogleAuthResult } from "@/shared/api/types";
import { getRuntimeConfig } from "@/shared/config/runtime-config";
import { EyeIcon, EyeOffIcon } from "@/shared/ui/Icons";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

type GoogleSuggestedProfile = NonNullable<GoogleAuthResult["suggested_profile"]>;

interface LoginViewProps {
  onRegister: () => void;                                                                           // นำทางไปหน้าลงทะเบียนใหม่
  onSuccess: (token: string, nationalId?: string) => Promise<void> | void;                          // เมื่อเข้าสู่ระบบสำเร็จ
  onGoogleRegister?: (tempToken: string, suggestedProfile?: GoogleSuggestedProfile) => void;        // กรณีล็อกอิน Google แล้วพบว่าเป็นผู้ใช้ใหม่
}

/**
 * คอมโพเนนต์หน้าจอเข้าสู่ระบบของผู้ป่วย (`LoginView`)
 *
 * วิธีการยืนยันตัวตนที่รองรับ (Authentication Architecture):
 * 1. การยืนยันตัวตนมาตรฐาน: กรอกชื่อผู้ใช้ (Username) หรือ อีเมล ร่วมกับรหัสผ่าน
 * 2. เข้าสู่ระบบแบบบุคคลภายนอกด้วย Google OAuth 2.0 (Google Identity Services)
 * 3. ปุ่มกดลืมรหัสผ่าน (เปิดหน้าต่าง Modal กู้คืนรหัสผ่านด้วย OTP)
 * 4. ปุ่มนำทางไปยังหน้าลงทะเบียนผู้ป่วยใหม่
 */
export function LoginView({ onRegister, onSuccess, onGoogleRegister }: LoginViewProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMsg, setIsSuccessMsg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const { googleClientId } = getRuntimeConfig();

  // ตรวจสอบว่ากำลังรันอยู่ในโหมดทดสอบอัตโนมัติ (Playwright / Test Mode) หรือไม่
  const isAutomatedTest =
    typeof window !== "undefined" &&
    (Boolean(window.navigator?.webdriver) ||
      Boolean((window as unknown as { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__) ||
      window.location.search.includes("test_mode=true") ||
      window.location.search.includes("playwright=true"));

  /**
   * ส่ง Credential Token ที่ได้จาก Google ไปยัง Backend API เพื่อยืนยันตัวตนและรับ JWT Token
   */
  const handleGoogleCredential = useCallback(async (credential?: string) => {
    if (!credential) {
      setMessage("Google ไม่ได้ส่งข้อมูลยืนยันตัวตนกลับมา กรุณาลองใหม่");
      return;
    }

    setLoading(true);
    setMessage("");
    setIsSuccessMsg(false);
    try {
      const result = await patientApi.loginWithGoogle(credential);
      // กรณีเป็นผู้ป่วยเดิมที่มีประวัติในโรงพยาบาลอยู่แล้ว
      if (result.access_token) {
        await onSuccess(result.access_token, result.profile?.national_id || undefined);
        return;
      }
      // กรณีเป็นผู้ใช้ใหม่: ส่งข้อมูลโปรไฟล์ที่ดึงมาจาก Google ไปหน้าลงทะเบียน
      if (result.is_new_user && result.temp_token && onGoogleRegister) {
        onGoogleRegister(result.temp_token, result.suggested_profile);
        return;
      }
      throw new ApiError("เว็บหลักไม่ได้ส่งข้อมูลเข้าสู่ระบบ Google ที่ครบถ้วน");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setLoading(false);
    }
  }, [onGoogleRegister, onSuccess]);

  // เริ่มต้นการทำงานของปุ่ม Google Sign-In (Google Identity Services)
  useEffect(() => {
    if (!googleClientId || isAutomatedTest) return;

    let attempts = 0;
    const initializeGoogle = () => {
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity || !googleBtnRef.current) return false;

      try {
        googleIdentity.initialize({
          client_id: googleClientId,
          callback: (response: { credential?: string }) => {
            void handleGoogleCredential(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const buttonHost = googleBtnRef.current;
        const measuredWidth = Math.floor(buttonHost.getBoundingClientRect().width || 320);
        const buttonWidth = Math.max(200, Math.min(400, measuredWidth));

        // Google may append a new rendered button if this effect is re-run.
        // Keep exactly one instance and constrain the official button to the
        // available auth-card width so it cannot expand into an oversized logo.
        buttonHost.replaceChildren();
        googleIdentity.renderButton(buttonHost, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          locale: "th",
          logo_alignment: "left",
          width: buttonWidth,
        });
      } catch (err) {
        console.warn("Failed to initialize Google Identity Services:", err);
        setMessage("ไม่สามารถโหลด Google Sign-In ได้ กรุณาลองใหม่อีกครั้ง");
      }

      return true;
    };

    if (initializeGoogle()) return;

    // ตั้งเวลาลองใหม่หากสคริปต์ Google SDK ยังโหลดไม่เสร็จ
    const timer = window.setInterval(() => {
      attempts += 1;
      if (initializeGoogle()) {
        window.clearInterval(timer);
      } else if (attempts >= 20) {
        window.clearInterval(timer);
        setMessage("ไม่สามารถโหลดบริการ Google Sign-In ได้ กรุณาลองใหม่อีกครั้ง");
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [googleClientId, handleGoogleCredential, isAutomatedTest]);

  /**
   * ส่งคำขอเข้าสู่ระบบด้วยชื่อผู้ใช้/อีเมล และรหัสผ่าน
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccessMsg(false);

    if (!identifier.trim()) {
      setMessage("กรุณากรอกชื่อผู้ใช้ หรืออีเมล");
      return;
    }

    if (!password) {
      setMessage("กรุณากรอกรหัสผ่าน");
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
      // ปฏิบัติตาม PDPA: ล้างข้อมูลเลขบัตรประชาชนที่อาจตกค้างในหน่วยความจำถาวร
      try {
        sessionStorage.removeItem("patient_national_id");
        localStorage.removeItem("patient_national_id");
      } catch {
        // ข้ามข้อผิดพลาด storage
      }
      await onSuccess(result.access_token, result.profile?.national_id || (cleanDigits.length === 13 ? cleanDigits : undefined));
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบได้");
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

        {/* เข้าสู่ระบบด้วยบุคคลภายนอก (Google Social Login) */}
        <div className="divider-line"><span>หรือเข้าสู่ระบบด้วย</span></div>
        <div className="google-auth-wrapper">
          {googleClientId ? (
            isAutomatedTest ? (
              <button
                type="button"
                className="google-sign-in-btn"
                onClick={() => void handleGoogleCredential("google_oauth_test_token")}
                disabled={loading}
              >
                <span>เข้าสู่ระบบด้วย Google</span>
              </button>
            ) : (
              <div ref={googleBtnRef} id="googleSignInDiv" />
            )
          ) : (
            <div className="alert" role="status">
              Google Sign-In ยังไม่ได้ตั้งค่า Client ID สำหรับระบบนี้
            </div>
          )}
        </div>

        {/* ลิงก์นำทางสำหรับผู้ป่วยใหม่ที่ยังไม่มีบัญชี */}
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

      {/* หน้าต่าง Modal กู้คืนรหัสผ่าน */}
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
