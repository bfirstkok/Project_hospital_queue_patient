import { useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";

interface LoginViewProps {
  onRegister: () => void;
  onThaidConnect: () => void;
  onSuccess: (token: string) => void;
}

export function LoginView({ onRegister, onThaidConnect, onSuccess }: LoginViewProps) {
  const [method, setMethod] = useState<"national_id" | "thaid">("national_id");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      const nationalId = new FormData(form).get("national_id");
      const rawId = typeof nationalId === "string" ? nationalId.replace(/\D/g, "") : "";
      const result = await patientApi.login(rawId);
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      if (rawId) {
        try {
          sessionStorage.setItem("patient_national_id", rawId);
          localStorage.setItem("patient_national_id", rawId);
        } catch {
          // ignore
        }
      }
      onSuccess(result.access_token);
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
        <p className="auth-description">กรุณาเข้าสู่ระบบเพื่อตรวจสอบคิว บัตรประจำตัวผู้ป่วย และประวัติการรักษา</p>

        {/* Login Method Tabs */}
        <div className="auth-method-tabs" role="tablist" aria-label="วิธีการเข้าสู่ระบบ">
          <button
            type="button"
            role="tab"
            aria-selected={method === "national_id"}
            className={`auth-tab ${method === "national_id" ? "active" : ""}`}
            onClick={() => setMethod("national_id")}
          >
            เลขบัตรประชาชน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === "thaid"}
            className={`auth-tab ${method === "thaid" ? "active" : ""}`}
            onClick={() => setMethod("thaid")}
          >
            แอปพลิเคชัน ThaID
          </button>
        </div>

        {message && <div className="alert" role="alert">{message}</div>}

        {method === "national_id" ? (
          <form autoComplete="on" onSubmit={submit}>
            <label className="field">
              <span>เลขบัตรประจำตัวประชาชน <b>*</b></span>
              <input
                name="national_id"
                maxLength={13}
                minLength={13}
                inputMode="numeric"
                pattern="[0-9]{13}"
                required
                autoComplete="username"
                placeholder="ตัวเลข 13 หลัก ไม่ต้องใส่ขีด"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13);
                }}
              />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
              <i aria-hidden="true">{loading ? "↻" : "→"}</i>
            </button>
          </form>
        ) : (
          <div className="thaid-login-box">
            <div className="thaid-badge">
              <div className="thaid-logo-circle">🇹🇭</div>
              <div>
                <strong>ยืนยันตัวตนด้วยแอป ThaID</strong>
                <p>เชื่อมต่อระบบพิสูจน์ตัวตนดิจิทัลภาครัฐ (D.DOPA) รวดเร็วและปลอดภัย</p>
              </div>
            </div>
            <button
              className="primary-button thaid-btn"
              type="button"
              onClick={onThaidConnect}
              disabled={loading}
            >
              <span>ไปที่หน้าเชื่อมต่อข้อมูล ThaID</span>
              <i aria-hidden="true">→</i>
            </button>
          </div>
        )}

        {/* Section 3: Register link below login */}
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
    </section>
  );
}
