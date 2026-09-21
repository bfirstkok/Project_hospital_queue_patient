import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { GoogleAuthResult } from "@/shared/api/types";
import { getRuntimeConfig } from "@/shared/config/runtime-config";
import { EyeIcon, EyeOffIcon } from "@/shared/ui/Icons";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

type GoogleSuggestedProfile = NonNullable<GoogleAuthResult["suggested_profile"]>;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              locale?: string;
            },
          ): void;
        };
      };
    };
  }
}

interface LoginViewProps {
  onRegister: () => void;
  onSuccess: (token: string, nationalId?: string) => void;
  onGoogleRegister: (tempToken: string, suggestedProfile?: GoogleSuggestedProfile) => void;
}

const GOOGLE_SCRIPT_ID = "google-identity-services";

export function LoginView({ onRegister, onSuccess, onGoogleRegister }: LoginViewProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMsg, setIsSuccessMsg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const { googleClientId } = getRuntimeConfig();

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
      if (result.access_token) {
        onSuccess(result.access_token);
        return;
      }
      if (result.is_new_user && result.temp_token) {
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

  useEffect(() => {
    if (!googleClientId) {
      setGoogleReady(false);
      return;
    }

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => void handleGoogleCredential(response.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
        locale: "th",
      });
      setGoogleReady(true);
    };

    if (window.google?.accounts.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const onLoad = () => renderGoogleButton();
    const onError = () => {
      if (!cancelled) {
        setGoogleReady(false);
        setMessage("โหลด Google Sign-In ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [googleClientId, handleGoogleCredential]);

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

        <div className="divider-line"><span>หรือเข้าสู่ระบบด้วย</span></div>
        {googleClientId ? (
          <div
            ref={googleButtonRef}
            aria-busy={!googleReady || loading}
            aria-label="เข้าสู่ระบบด้วย Google"
            style={{ display: "flex", justifyContent: "center", minHeight: "44px", opacity: loading ? 0.65 : 1 }}
          />
        ) : (
          <div className="alert" role="status">
            Google Sign-In ยังไม่ได้ตั้งค่า Client ID สำหรับระบบนี้
          </div>
        )}

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
