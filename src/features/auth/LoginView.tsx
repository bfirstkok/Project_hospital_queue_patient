import { useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";

interface LoginViewProps {
  onBack: () => void;
  onSuccess: (token: string) => void;
}

export function LoginView({ onBack, onSuccess }: LoginViewProps) {
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
      const result = await patientApi.login(typeof nationalId === "string" ? nationalId : "");
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      onSuccess(result.access_token);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบได้");
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleThaIdLogin() {
    setLoading(true);
    setMessage("");
    try {
      // Simulate ThaID Auth flow
      const mockThaId = "1234567890123";
      const result = await patientApi.login(mockThaId);
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      onSuccess(result.access_token);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบผ่าน ThaID ได้");
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="loginView" className="page-shell auth-view">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">✚</div>
        <p className="eyebrow">บัญชีผู้ป่วย OPD</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="auth-description">ตรวจสอบข้อมูลส่วนตัว ประวัติการรักษา และสถานะคิวของคุณ</p>

        {/* Login Method Tabs */}
        <div className="auth-method-tabs" role="tablist" aria-label="วิธีการเข้าสู่ระบบ">
          <button
            type="button"
            role="tab"
            aria-selected={method === "national_id"}
            className={`auth-tab ${method === "national_id" ? "active" : ""}`}
            onClick={() => setMethod("national_id")}
          >
            🪪 เลขบัตรประชาชน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === "thaid"}
            className={`auth-tab ${method === "thaid" ? "active" : ""}`}
            onClick={() => setMethod("thaid")}
          >
            📱 ThaID (แอปบัตร ปชช.)
          </button>
        </div>

        {message && <div className="alert" role="alert">{message}</div>}

        {method === "national_id" ? (
          <form autoComplete="on" onSubmit={submit}>
            <label className="field">
              <span>เลขบัตรประชาชน <b>*</b></span>
              <input
                name="national_id"
                maxLength={13}
                minLength={13}
                inputMode="numeric"
                pattern="[0-9]{13}"
                required
                autoComplete="username"
                placeholder="ตัวเลข 13 หลัก"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13);
                }}
              />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
              <i aria-hidden="true">{loading ? "↻" : "→"}</i>
            </button>
            <button className="secondary-button" type="button" onClick={onBack}>กลับไปลงทะเบียน</button>
          </form>
        ) : (
          <div className="thaid-login-box">
            <div className="thaid-badge">
              <span className="thaid-logo" aria-hidden="true">🇹🇭</span>
              <strong>เข้าสู่ระบบด้วยแอปพลิเคชัน ThaID</strong>
              <p>ยืนยันตัวตนผ่านระบบพิสูจน์และยืนยันตัวตนทางดิจิทัล (D.DOPA) รวดเร็วและปลอดภัย</p>
            </div>
            <button
              className="primary-button thaid-btn"
              type="button"
              onClick={handleThaIdLogin}
              disabled={loading}
            >
              <span>{loading ? "กำลังยืนยันตัวตน..." : "ยืนยันตัวตนด้วย ThaID"}</span>
              <i aria-hidden="true">{loading ? "↻" : "📱"}</i>
            </button>
            <button className="secondary-button" type="button" onClick={onBack}>กลับไปลงทะเบียน</button>
          </div>
        )}

        <p className="privacy-note">ข้อมูลสุขภาพจะแสดงหลังยืนยันข้อมูลสำเร็จตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
      </div>
    </section>
  );
}
