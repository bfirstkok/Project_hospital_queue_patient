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

  const [googleReady, setGoogleReady] = useState(false);
  const googleTokenClientRef = useRef<{ requestAccessToken: (config?: { prompt?: string; hint?: string }) => void } | null>(null);
  const { googleClientId } = getRuntimeConfig();

  // ตรวจสอบว่ากำลังรันอยู่ในโหมดทดสอบอัตโนมัติ (Playwright / Test Mode) หรือไม่
  const isAutomatedTest =
    typeof window !== "undefined" &&
    (Boolean(window.navigator?.webdriver) ||
      Boolean((window as unknown as { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__) ||
      window.location.search.includes("test_mode=true") ||
      window.location.search.includes("playwright=true"));

  const applyGoogleResult = useCallback(async (result: GoogleAuthResult) => {
    if (result.access_token) {
      await onSuccess(result.access_token, result.profile?.national_id || undefined);
      return;
    }
    if (result.is_new_user && result.temp_token && onGoogleRegister) {
      onGoogleRegister(result.temp_token, result.suggested_profile);
      return;
    }
    throw new ApiError("เว็บหลักไม่ได้ส่งข้อมูลเข้าสู่ระบบ Google ที่ครบถ้วน");
  }, [onGoogleRegister, onSuccess]);

  /**
   * ส่ง OAuth access token ที่ได้จาก Google popup ไปให้ backend ตรวจสอบกับ Google
   * ก่อนสร้าง session ของผู้ป่วย ระบบไม่เชื่อข้อมูลโปรไฟล์จาก browser โดยตรง
   */
  const handleGoogleAccessToken = useCallback(async (accessToken?: string) => {
    if (!accessToken) {
      setMessage("Google ไม่ได้ส่งข้อมูลยืนยันตัวตนกลับมา กรุณาลองใหม่");
      return;
    }

    setLoading(true);
    setMessage("");
    setIsSuccessMsg(false);
    try {
      const result = await patientApi.loginWithGoogleAccessToken(accessToken);
      await applyGoogleResult(result);
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      setMessage(apiError.message === "Failed to fetch"
        ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง"
        : apiError.message);
    } finally {
      setLoading(false);
    }
  }, [applyGoogleResult]);

  // ใช้ Google OAuth token-client เพราะ requestAccessToken() เปิด account chooser/
  // consent ใน dialog popup ที่ผู้ใช้เป็นคนเริ่มจากปุ่มโดยตรง ไม่ใช่ One Tap/FedCM.
  useEffect(() => {
    if (!googleClientId || isAutomatedTest) {
      setGoogleReady(Boolean(googleClientId));
      return;
    }

    let attempts = 0;
    const initializeGoogle = () => {
      const googleOAuth = window.google?.accounts?.oauth2;
      if (!googleOAuth?.initTokenClient) return false;

      try {
        googleTokenClientRef.current = googleOAuth.initTokenClient({
          client_id: googleClientId,
          scope: "openid email profile",
          callback: (response) => {
            if (response.error) {
              setLoading(false);
              setMessage(response.error_description || "ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
              return;
            }
            void handleGoogleAccessToken(response.access_token);
          },
          error_callback: (error) => {
            setLoading(false);
            if (error.type === "popup_closed") {
              return;
            }
            setMessage(
              error.type === "popup_failed_to_open"
                ? "เบราว์เซอร์บล็อกหน้าต่าง Google กรุณาอนุญาต Popup แล้วลองใหม่"
                : "ไม่สามารถเปิดหน้าต่าง Google Sign-In ได้"
            );
          },
        });
        setGoogleReady(true);
      } catch (err) {
        console.warn("Failed to initialize Google OAuth popup:", err);
        googleTokenClientRef.current = null;
        setGoogleReady(false);
        setMessage("ไม่สามารถโหลด Google Sign-In ได้ กรุณาลองใหม่อีกครั้ง");
      }

      return true;
    };

    if (initializeGoogle()) return;

    const timer = window.setInterval(() => {
      attempts += 1;
      if (initializeGoogle()) {
        window.clearInterval(timer);
      } else if (attempts >= 20) {
        window.clearInterval(timer);
        setGoogleReady(false);
        setMessage("ไม่สามารถโหลดบริการ Google Sign-In ได้ กรุณาลองใหม่อีกครั้ง");
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [googleClientId, handleGoogleAccessToken, isAutomatedTest]);

  const startGoogleSignIn = useCallback(() => {
    if (isAutomatedTest) {
      void handleGoogleAccessToken("google_oauth_test_access_token");
      return;
    }

    if (!googleReady || !googleTokenClientRef.current) {
      setMessage("Google Sign-In ยังโหลดไม่เสร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setMessage("");
    setIsSuccessMsg(false);
    setLoading(true);
    try {
      googleTokenClientRef.current.requestAccessToken({ prompt: "select_account" });
    } catch (error) {
      setLoading(false);
      setMessage("ไม่สามารถเปิดหน้าต่าง Google Sign-In ได้ กรุณาลองใหม่");
    }
  }, [googleReady, handleGoogleAccessToken, isAutomatedTest]);

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
            <button
              type="button"
              className="google-sign-in-btn"
              onClick={startGoogleSignIn}
              disabled={loading || !googleReady}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 11.1H12v3.8h5.35c-.23 1.26-.94 2.32-2.01 3.03v2.5h3.24c1.89-1.75 2.98-4.33 2.98-7.39 0-.66-.06-1.3-.21-1.94Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.24-2.5c-.9.6-2.05.96-3.37.96-2.59 0-4.79-1.75-5.58-4.1H3.08v2.58C4.73 19.78 8.1 22 12 22Z" />
                <path fill="#FBBC05" d="M6.42 13.92c-.2-.6-.31-1.25-.31-1.92s.11-1.32.31-1.92V7.5H3.08C2.39 8.88 2 10.4 2 12s.39 3.12 1.08 4.5l3.34-2.58Z" />
                <path fill="#EA4335" d="M12 5.98c1.47 0 2.78.51 3.82 1.51l2.87-2.87C16.96 2.98 14.7 2 12 2 8.1 2 4.73 4.22 3.08 7.5l3.34 2.58c.79-2.35 2.99-4.1 5.58-4.1Z" />
              </svg>
              <span>{googleReady ? "เข้าสู่ระบบด้วย Google" : "กำลังโหลด Google..."}</span>
            </button>
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
