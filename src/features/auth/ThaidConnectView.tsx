import { useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";

interface ThaidConnectViewProps {
  onSuccess: (token: string, nationalId?: string) => void;
  onCancel: () => void;
}

export function ThaidConnectView({ onSuccess, onCancel }: ThaidConnectViewProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleConsent() {
    setLoading(true);
    setMessage("");
    try {
      // Simulate ThaID OAuth token exchange with national ID
      const mockThaId = "1234567890123";
      const result = await patientApi.login(mockThaId);
      if (!result.access_token) {
        throw new ApiError("ระบบ ThaID ไม่ส่ง Access Token กลับมา");
      }
      try {
        sessionStorage.setItem("patient_national_id", mockThaId);
        localStorage.setItem("patient_national_id", mockThaId);
      } catch {
        // ignore
      }
      onSuccess(result.access_token, mockThaId);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "การเชื่อมต่อ ThaID ล้มเหลว");
      setMessage(apiError.message === "Failed to fetch" ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ ThaID ได้ กรุณาลองใหม่อีกครั้ง" : apiError.message);
      setLoading(false);
    }
  }

  return (
    <section id="thaidConnectView" className="page-shell auth-view">
      <div className="thaid-gateway-card">
        {/* Header with DOPA Branding */}
        <div className="thaid-gateway-header">
          <div className="dopa-badge">
            <span className="dopa-emblem">🇹🇭</span>
            <div>
              <strong>ThaID · D.DOPA</strong>
              <small>ระบบพิสูจน์และยืนยันตัวตนทางดิจิทัล กรมการปกครอง</small>
            </div>
          </div>
          <span className="ial-tag">ระดับความปลอดภัย IAL 2.3</span>
        </div>

        <div className="thaid-gateway-body">
          <h1>คำขอเชื่อมต่อและเข้าถึงข้อมูล</h1>
          <p className="requesting-app-text">
            <strong>ระบบบริการคิวผู้ป่วยนอก (OPD Hospital Queue)</strong> มีความประสงค์ขอเข้าถึงข้อมูลเพื่อยืนยันตัวตนและค้นหาประวัติการรักษา
          </p>

          {message && <div className="alert" role="alert">{message}</div>}

          {/* Scope list */}
          <div className="scope-box">
            <h3>รายการข้อมูลที่ขอเข้าถึง:</h3>
            <ul className="scope-list">
              <li>
                <span className="scope-check">✓</span>
                <div>
                  <strong>เลขประจำตัวประชาชน (National ID)</strong>
                  <small>ใช้สำหรับค้นหาประวัติการรักษาและเลข HN ผู้ป่วย</small>
                </div>
              </li>
              <li>
                <span className="scope-check">✓</span>
                <div>
                  <strong>ชื่อ - นามสกุล (Full Name)</strong>
                  <small>สำหรับระบุตัวตนบนบัตรคิวและประวัติการรับบริการ</small>
                </div>
              </li>
              <li>
                <span className="scope-check">✓</span>
                <div>
                  <strong>ข้อมูลวันเดือนปีเกิด & ที่อยู่ตามทะเบียนราษฎร</strong>
                  <small>สำหรับจัดสรรสิทธิ์และพื้นที่การรักษาพยาบาล</small>
                </div>
              </li>
              <li>
                <span className="scope-check">✓</span>
                <div>
                  <strong>สิทธิการรักษาพยาบาลเบื้องต้น</strong>
                  <small>ตรวจสอบสิทธิบัตรทอง / ประกันสังคม / ข้าราชการ</small>
                </div>
              </li>
            </ul>
          </div>

          <div className="thaid-security-notice">
            <span>🔒</span>
            <p>การส่งผ่านข้อมูลได้รับการเข้ารหัสแบบ End-to-End Encryption ตามมาตรฐาน พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
          </div>

          <div className="gateway-actions">
            <button
              type="button"
              className="primary-button thaid-confirm-btn"
              onClick={handleConsent}
              disabled={loading}
            >
              <span>{loading ? "กำลังเชื่อมต่อ ThaID..." : "ยินยอมและเชื่อมต่อข้อมูล"}</span>
              <i aria-hidden="true">{loading ? "↻" : "✓"}</i>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={loading}
            >
              ยกเลิก
            </button>
          </div>
        </div>

        <div className="thaid-gateway-footer">
          <small>กรมการปกครอง กระทรวงมหาดไทย · Department of Provincial Administration</small>
        </div>
      </div>
    </section>
  );
}
