import { useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";

interface LoginViewProps {
  onBack: () => void;
  onSuccess: (token: string) => void;
}

export function LoginView({ onBack, onSuccess }: LoginViewProps) {
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

  return (
    <section id="loginView" className="page-shell auth-view">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">✚</div>
        <p className="eyebrow">บัญชีผู้ป่วย</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="auth-description">ใช้เลขบัตรประชาชนที่ลงทะเบียนไว้เพื่อดูข้อมูลส่วนตัว ประวัติการรับบริการ และคิวของคุณ</p>
        {message && <div className="alert" role="alert">{message}</div>}
        <form autoComplete="on" onSubmit={submit}>
          <label className="field"><span>เลขบัตรประชาชน <b>*</b></span><input name="national_id" maxLength={13} minLength={13} inputMode="numeric" pattern="[0-9]{13}" required autoComplete="username" placeholder="ตัวเลข 13 หลัก" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13); }} /></label>
          <button className="primary-button" type="submit" disabled={loading}><span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span><i aria-hidden="true">{loading ? "↻" : "→"}</i></button>
          <button className="secondary-button" type="button" onClick={onBack}>กลับไปลงทะเบียน</button>
        </form>
        <p className="privacy-note">ข้อมูลสุขภาพจะแสดงหลังยืนยันข้อมูลสำเร็จเท่านั้น</p>
      </div>
    </section>
  );
}
