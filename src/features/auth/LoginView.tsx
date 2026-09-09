import { useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import { isValidThaiNationalId } from "@/shared/data/thai-id";

interface LoginViewProps {
  onRegister: () => void;
  onSuccess: (token: string, nationalId?: string) => void;
}

export function LoginView({ onRegister, onSuccess }: LoginViewProps) {
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
      if (!isValidThaiNationalId(rawId)) {
        setMessage("เลขบัตรประจำตัวประชาชนไม่ถูกต้อง กรุณาตรวจสอบตัวเลข 13 หลักอีกครั้ง");
        setLoading(false);
        return;
      }
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
      onSuccess(result.access_token, rawId);
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
          กรุณากรอกเลขบัตรประจำตัวประชาชนเพื่อเข้าสู่ระบบ จากนั้นระบบจะให้ยืนยันรหัส PIN 6 หลักเพื่อเข้าใช้งานจริง
        </p>

        {message && <div className="alert" role="alert">{message}</div>}

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
