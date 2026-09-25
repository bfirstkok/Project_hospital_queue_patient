import { useRef, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { PatientProfile, RegistrationPayload, RegistrationResult } from "@/shared/api/types";
import {
  PatientProfileForm,
  PROFILE_DRAFT_KEY,
  type PatientProfileFormHandle,
} from "@/features/patient-profile/PatientProfileForm";
import { PdpaConsentGate } from "./PdpaConsentModal";

// พร็อพส์สำหรับคอมโพเนนต์หน้าลงทะเบียนและจองคิว
interface RegistrationViewProps {
  token?: string;                                 // Access Token (กรณีล็อกอินอยู่แล้ว)
  hasToken?: boolean;                             // แฟล็กบอกสถานะว่ามี Token หรือไม่
  initialPdpaAccepted?: boolean;                  // ผ่านการยินยอม PDPA มาแล้วหรือไม่
  googleTempToken?: string;                       // โทเค็นชั่วคราวจากการล็อกอิน Google OAuth
  initialProfile?: PatientProfile | null;         // ข้อมูลโปรไฟล์เริ่มต้น
  onLogin: () => void;                            // ฟังก์ชันสลับไปหน้าเข้าสู่ระบบ
  onCancel?: () => void;                          // ฟังก์ชันกรณีกดยกเลิก
  onSuccess: (token: string, result: RegistrationResult, nationalId: string) => void; // ฟังก์ชันเมื่อลงทะเบียนสำเร็จและได้คิว
  onUnauthorized?: () => void;                    // ฟังก์ชันเมื่อ Token หมดอายุ
  onDuplicateQueue?: (token: string, nationalId: string) => void; // ฟังก์ชันจัดการเมื่อตรวจพบคิวเดิมที่ยังไม่เสร็จสิ้น
}

/**
 * ฟังก์ชันตรวจสอบค้นหา Token ที่มีอยู่เดิมจากเลขประจำตัวประชาชน 13 หลัก
 *
 * @param {string} nationalId - เลขประจำตัวประชาชน 13 หลัก
 * @returns {Promise<string>} Access Token หรือข้อความว่างหากยังไม่มีประวัติ
 */
async function probeExistingToken(nationalId: string): Promise<string> {
  try {
    const res = await patientApi.login(nationalId);
    return res.access_token || "";
  } catch {
    return "";
  }
}

/**
 * ฟังก์ชันตรวจสอบว่าผู้ป่วยมีคิวตรวจที่ยังดำเนินอยู่ (ยังไม่เสร็จสิ้นและยังไม่ได้ยกเลิก) หรือไม่
 * (Duplicate Queue Guard: ป้องกันการออกบัตรคิวซ้ำซ้อนในวันเดียวกัน)
 *
 * @param {string} token - Access Token ของผู้ป่วย
 * @returns {Promise<boolean>} true หากมีคิวตรวจค้างอยู่
 */
async function probeActiveQueue(token: string): Promise<boolean> {
  try {
    const q = await patientApi.queue(token);
    return Boolean(q && q.queue_number);
  } catch {
    return false; // ตอบกลับ 404 แสดงว่ายังไม่มีคิวในวันนี้
  }
}

// รายชื่อฟิลด์ที่เป็นตัวเลข (ต้องแปลงชนิดข้อมูลจาก string เป็น number ก่อนส่งให้ API)
const numericFields = new Set(["age", "height_cm", "weight_kg"]);

/**
 * ตัดช่องว่างส่วนเกินและคืนค่าเป็น null หากเป็นค่าว่างเปล่า
 */
function valueOrNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/**
 * รวบรวมข้อมูลทั้งหมดจากแบบฟอร์มแล้วจัดโครงสร้างเป็น `RegistrationPayload`
 *
 * ลำดับการทำงาน:
 * 1. อ่านค่าทุกฟิลด์จาก HTML Form ผ่าน `FormData`
 * 2. รวบรวมผู้ติดต่อฉุกเฉินสูงสุด 3 ท่านเป็นรายการ และระบุท่านแรกเป็นผู้ติดต่อหลัก
 * 3. แปลงฟิลด์ตัวเลข (`age`, `height_cm`, `weight_kg`) เป็น Number หรือ null
 * 4. ทำความสะอาดเลขประจำตัวประชาชนให้เป็นตัวเลขล้วน 13 หลัก
 *
 * @param {HTMLFormElement} form - อิลีเมนต์แบบฟอร์ม HTML
 * @returns {RegistrationPayload} ข้อมูลสำหรับส่งไปยัง API ลงทะเบียน
 */
export function collectRegistrationPayload(form: HTMLFormElement): RegistrationPayload {
  const data = new FormData(form);
  const payload = Object.fromEntries(
    [...data.entries()].map(([key, value]) => [key, valueOrNull(value)]),
  ) as Record<string, string | null>;

  payload.phone = valueOrNull(data.get("phone"));

  // รวบรวมข้อมูลผู้ติดต่อฉุกเฉิน
  const emergencyContacts = [1, 2, 3].map((index) => ({
    id: `em_${index}`,
    name: valueOrNull(data.get(`emergency_name_${index}`)) || "",
    relationship: valueOrNull(data.get(`emergency_relationship_${index}`)) || "",
    phone: valueOrNull(data.get(`emergency_phone_${index}`)) || "",
  })).filter((contact) => contact.name || contact.relationship || contact.phone);
  payload.emergency_name = emergencyContacts[0]?.name || null;
  payload.emergency_phone = emergencyContacts[0]?.phone || null;
  payload.emergency_relationship = emergencyContacts[0]?.relationship || null;

  // แปลงค่าฟิลด์ตัวเลข
  for (const field of numericFields) {
    payload[field] = payload[field] === null ? null : String(Number(payload[field]));
  }

  // ทำความสะอาดเลขประจำตัวประชาชน 13 หลัก
  if (payload.national_id) {
    let cleanId = payload.national_id.replace(/\D/g, "");
    if (cleanId.length !== 13) {
      try {
        const saved = (sessionStorage.getItem("patient_national_id") || localStorage.getItem("patient_national_id") || "").replace(/\D/g, "");
        if (saved.length === 13) cleanId = saved;
      } catch {
        // ข้ามข้อผิดพลาด storage
      }
    }
    payload.national_id = cleanId;
  }

  return {
    ...payload,
    emergency_contacts: emergencyContacts,
    age: payload.age === null ? null : Number(payload.age),
    height_cm: payload.height_cm === null ? null : Number(payload.height_cm),
    weight_kg: payload.weight_kg === null ? null : Number(payload.weight_kg),
    consent: data.has("consent"),
  } as RegistrationPayload;
}

// รายการตัวเลือกอาการสำคัญยอดนิยมสำหรับคัดกรองเบื้องต้น
const SYMPTOM_OPTIONS = [
  "มีไข้ / หนาวสั่น",
  "ไอ / เจ็บคอ / มีน้ำมูก",
  "เวียนศีรษะ / หน้ามืด",
  "ปวดท้อง / คลื่นไส้",
  "แน่นหน้าอก / หายใจเหนื่อย",
  "ปวดกล้ามเนื้อ / ปวดข้อ",
  "มีบาดแผล / อุบัติเหตุ",
  "ตาแดง / ระคายเคืองตา",
];

/**
 * คอมโพเนนต์หน้าจอลงทะเบียนผู้ป่วยและจองคิวตรวจ OPD (`RegistrationView`)
 *
 * กระบวนการทำงานที่สำคัญ (Workflow):
 * 1. ประตูคัดกรองความยินยอม PDPA (`PdpaConsentGate`): บังคับยินยอมก่อนเข้ากรอกข้อมูล
 * 2. ฟอร์มข้อมูลผู้ป่วยและสุขภาพ (`PatientProfileForm`): รองรับทั้งผู้ป่วยใหม่และดึงข้อมูลเดิมของผู้ป่วยเก่า
 * 3. คัดกรองอาการสำคัญ (Chief Complaint): เลือกช้อยส์ด่วนหรือพิมพ์บรรยายอาการเพิ่มเติม
 * 4. ระบบป้องกันการจองคิวซ้ำ (Duplicate Queue Guard): เช็คว่ามีคิวเดิมค้างอยู่หรือไม่ หากมีจะนำทางไปดูคิวเดิมทันที
 * 5. ป้องกันข้อมูลสูญหาย: มี Modal เตือนยืนยันหากผู้ใช้กดยกเลิกขณะกรอกข้อมูลค้างไว้
 */
export function RegistrationView({
  token,
  hasToken,
  initialPdpaAccepted = false,
  googleTempToken,
  initialProfile,
  onLogin,
  onCancel,
  onSuccess,
  onUnauthorized,
  onDuplicateQueue,
}: RegistrationViewProps) {
  const isUserLoggedIn = Boolean(token || hasToken);
  const formRef = useRef<HTMLFormElement>(null);
  const profileRef = useRef<PatientProfileFormHandle>(null);

  const [isPdpaAccepted, setIsPdpaAccepted] = useState<boolean>(initialPdpaAccepted || isUserLoggedIn);
  const [showPdpaReview, setShowPdpaReview] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");

  const symptomDirty = customSymptom.trim().length > 0 || selectedSymptoms.length > 0;
  const isFormDirty = profileDirty || symptomDirty;

  /**
   * สลับการเลือกช้อยส์อาการสำคัญ
   */
  function toggleSymptom(item: string) {
    setSelectedSymptoms((prev) => (prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]));
  }

  /**
   * ล้างข้อมูลในฟอร์มและข้อมูลร่างในเครื่อง
   */
  function resetForm() {
    profileRef.current?.clearDraft();
    setSelectedSymptoms([]);
    setCustomSymptom("");
  }

  /**
   * จัดการเมื่อผู้ใช้กดปุ่มยกเลิก: หากมีข้อมูลกรอกค้างไว้ จะเปิด Modal ยืนยันก่อน
   */
  function handleCancelClick() {
    if (isFormDirty) {
      setShowCancelConfirm(true);
      return;
    }
    resetForm();
    (onCancel ?? onLogin)();
  }

  /**
   * ยืนยันการยกเลิกและนำทางกลับไปยังหน้าก่อนหน้า
   */
  function handleConfirmCancel() {
    setShowCancelConfirm(false);
    resetForm();
    (onCancel ?? onLogin)();
  }

  /**
   * ส่งแบบฟอร์มลงทะเบียนเพื่อออกบัตรคิวตรวจ OPD
   *
   * ขั้นตอนการทำงาน:
   * 1. ตรวจสอบความถูกต้องของข้อมูลทุกช่อง และฟิลด์สุขภาพสำคัญ
   * 2. รวบรวมข้อมูลด้วย `collectRegistrationPayload`
   * 3. รันระบบตรวจสอบคิวซ้ำ (Duplicate Queue Guard) ป้องกันการออกคิวซ้ำซ้อน
   * 4. ยิง API `patientApi.register()` และล้างดราฟต์ออกจากเครื่อง
   * 5. แจ้งคอมโพเนนต์แม่ด้วย `onSuccess()` เพื่อเปิดหน้าบัตรคิว
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setInvalidField("");
    if (!form.reportValidity()) {
      setMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    const profileError = profileRef.current?.validate();
    if (profileError) {
      setInvalidField(profileError.field);
      setMessage(profileError.message);
      return;
    }

    const payload = collectRegistrationPayload(form);
    if (googleTempToken) payload.temp_token = googleTempToken;
    const nationalId = payload.national_id || "";

    setLoading(true);
    try {
      // ตรวจสอบป้องกันการจองคิวซ้ำ: หากเลขบัตรประชาชนนี้มีคิวที่ยังไม่เสร็จสิ้น จะพาไปหน้าคิวเดิมทันที
      const probeToken = token || (nationalId ? await probeExistingToken(nationalId) : "");
      if (probeToken && (await probeActiveQueue(probeToken))) {
        setLoading(false);
        setMessage("เลขบัตรประชาชนนี้มีคิวที่กำลังรับบริการอยู่แล้ว ระบบจะพาไปที่หน้าสถานะคิวของคุณ");
        if (onDuplicateQueue) {
          onDuplicateQueue(probeToken, nationalId);
        } else {
          onLogin();
        }
        return;
      }

      const result = await patientApi.register(payload);
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      try {
        localStorage.removeItem(PROFILE_DRAFT_KEY);
        sessionStorage.removeItem("opd_cancelled_queue_number");
        sessionStorage.removeItem("patient_national_id");
        localStorage.removeItem("patient_national_id");
      } catch {
        // ข้ามข้อผิดพลาด storage
      }
      onSuccess(result.access_token, result, nationalId);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้");
      const [field, errors] = Object.entries(apiError.errors || {})[0] || [];
      setInvalidField(field || "");
      const input = field ? form.elements.namedItem(field) : null;
      if (input instanceof HTMLElement) input.focus();
      const detail = Array.isArray(errors) ? errors[0] : errors;
      setMessage(
        apiError.message === "Failed to fetch"
          ? "เชื่อมต่อเว็บหลักไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือติดต่อเจ้าหน้าที่"
          : detail || apiError.message,
      );
    } finally {
      setLoading(false);
    }
  }

  // หากยังไม่กดยินยอมข้อตกลง PDPA ให้แสดงหน้าต่างยินยอมข้อมูลส่วนบุคคลก่อน
  if (!isPdpaAccepted) {
    return (
      <section id="registrationView" className="page-shell">
        <div className="intro">
          <span className="eyebrow">ลงทะเบียนรับบริการ OPD</span>
          <h1>{hasToken ? "จองคิวรับบริการ OPD วันนี้" : "ข้อตกลงและนโยบายความเป็นส่วนตัว"}</h1>
          <p>กรุณาอ่านและให้ความยินยอมการเก็บรวบรวมข้อมูลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
          {!hasToken && (
            <div className="login-prompt">
              <span>มีประวัติหรือลงทะเบียนไว้แล้ว?</span>
              <button className="login-button" type="button" onClick={onLogin}>เข้าสู่ระบบ</button>
            </div>
          )}
        </div>

        {/* แถบขั้นตอน 3 สเต็ป */}
        <ol className="steps" aria-label="ขั้นตอนรับบริการ">
          <li className="active"><span>1</span>ยินยอม PDPA & ลงทะเบียน</li>
          <li><span>2</span>วัดสัญญาณชีพ</li>
          <li><span>3</span>รอเรียกคิว</li>
        </ol>

        <PdpaConsentGate onAccept={() => setIsPdpaAccepted(true)} onDecline={onLogin} />
      </section>
    );
  }

  return (
    <section id="registrationView" className="page-shell">
      {/* Modal เปิดอ่านนโยบาย PDPA ซ้ำ */}
      {showPdpaReview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="หน้านโยบาย PDPA">
          <div className="modal-inner">
            <PdpaConsentGate onAccept={() => setShowPdpaReview(false)} onDecline={() => setShowPdpaReview(false)} />
          </div>
        </div>
      )}

      {/* Modal ยืนยันกรณีกดยกเลิกขณะที่กรอกข้อมูลค้างไว้ */}
      {showCancelConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancelConfirmTitle">
          <div className="modal-content" style={{ maxWidth: "440px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }} aria-hidden="true">⚠️</div>
            <h2 id="cancelConfirmTitle" style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "8px", color: "var(--ink)" }}>
              ยืนยันการยกเลิกหรือไม่?
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "24px" }}>
              คุณได้กรอกข้อมูลบางส่วนไว้แล้ว หากยกเลิก ข้อมูลที่กรอกไว้จะไม่ถูกบันทึกและระบบจะพากลับไปยังหน้าเดิม
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowCancelConfirm(false)}>
                กรอกข้อมูลต่อ
              </button>
              <button
                type="button" className="primary-button"
                style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleConfirmCancel}
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="intro">
        <span className="eyebrow">ระบบผู้ป่วยนอก (OPD)</span>
        <h1>{hasToken ? "จองคิวรับบริการ OPD วันนี้" : "ลงทะเบียนผู้ป่วยใหม่"}</h1>
        <p>
          {hasToken
            ? "ระบบได้ดึงข้อมูลส่วนบุคคลของคุณมาให้อัตโนมัติแล้ว กรุณาเลือกหรือระบุอาการที่มารับบริการวันนี้"
            : googleTempToken
              ? "ยืนยันข้อมูลผู้ป่วยเพื่อเชื่อมบัญชี Google กับประวัติในโรงพยาบาล แล้วรับคิวบริการ"
              : "กรุณากรอกข้อมูลส่วนบุคคลเพื่อบันทึกประวัติการรักษาและจัดลำดับคิวรับบริการ"}
        </p>
        {!hasToken && (
          <div className="login-prompt">
            <span>มีประวัติการรักษาอยู่แล้ว?</span>
            <button className="login-button" type="button" onClick={handleCancelClick}>เข้าสู่ระบบ</button>
          </div>
        )}
      </div>

      <ol className="steps" aria-label="ขั้นตอนรับบริการ">
        <li className="active"><span>1</span>{hasToken ? "ระบุอาการ & จองคิว" : "ลงทะเบียน"}</li>
        <li><span>2</span>วัดสัญญาณชีพ</li>
        <li><span>3</span>รอเรียกคิว</li>
      </ol>

      {googleTempToken && (
        <div className="profile-prefilled-banner" role="status">
          <strong>เชื่อมบัญชี Google แล้ว</strong>
          <span>ระบบเติมชื่อและอีเมลจาก Google ให้แล้ว กรุณาตรวจสอบข้อมูลและระบุเลขบัตรประชาชนก่อนลงทะเบียน</span>
        </div>
      )}

      <form ref={formRef} className="form-card" autoComplete="on" onSubmit={submit}>
        {/* ฟิลด์ Honeypot ซ่อนไว้เพื่อดักจับ Bot อัตโนมัติ */}
        <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <PatientProfileForm
          ref={profileRef}
          mode="register"
          token={token}
          hasToken={hasToken}
          initialProfile={initialProfile}
          draftKey={token || googleTempToken ? undefined : PROFILE_DRAFT_KEY}
          onUnauthorized={onUnauthorized}
          onDirtyChange={setProfileDirty}
        >
          {/* บล็อกที่ 2: ระบุอาการสำคัญที่มารับบริการ */}
          <fieldset>
            <legend>
              <span className="section-number">2</span>
              <span>📋 อาการสำคัญที่มารับบริการ <b>*</b><small>เลือกอาการเบื้องต้น หรือพิมพ์ระบุรายละเอียดเพิ่มเติม</small></span>
            </legend>

            <div className="choice-chips-group" role="group" aria-label="ตัวเลือกอาการยอดนิยม">
              {SYMPTOM_OPTIONS.map((symptom) => (
                <button
                  type="button" key={symptom}
                  className={`choice-chip ${selectedSymptoms.includes(symptom) ? "selected" : ""}`}
                  onClick={() => toggleSymptom(symptom)}
                >
                  {symptom}
                </button>
              ))}
            </div>

            <label className="field">
              <span>ระบุรายละเอียดอาการสำคัญ <b>*</b></span>
              <textarea
                name="note"
                placeholder="เช่น มีไข้สูง ปวดศีรษะ และไอต่อเนื่องมา 2 วัน"
                value={customSymptom || (selectedSymptoms.length > 0 ? selectedSymptoms.join(", ") : "")}
                onChange={(e) => setCustomSymptom(e.target.value)}
                className={invalidField === "note" ? "invalid" : ""}
                required
              />
            </label>
          </fieldset>
        </PatientProfileForm>

        {/* แถบระบุว่าผ่านการยินยอมตาม PDPA แล้ว */}
        <div className="pdpa-verified-box">
          <div className="pdpa-verified-badge">
            <span className="pdpa-check-icon">✓</span>
            <span>ยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) แล้ว</span>
          </div>
          <button type="button" className="pdpa-review-link" onClick={() => setShowPdpaReview(true)}>
            อ่านนโยบายความเป็นส่วนตัว (PDPA) อีกครั้ง
          </button>
        </div>

        <label className="consent">
          <input name="consent" type="checkbox" defaultChecked required />
          <span>ข้าพเจ้าขอยืนยันว่าข้อมูลข้างต้นถูกต้องตรงตามความเป็นจริง และยินยอมให้ใช้ข้อมูลในการคัดกรองและจัดลำดับคิวรับบริการ <b>*</b></span>
        </label>

        {message && (
          <div className="alert" role="alert" style={{ marginBottom: "16px" }}>
            {message}
          </div>
        )}

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "กำลังบันทึกข้อมูล..." : hasToken ? "ยืนยันการจองคิวรับบริการ OPD" : "บันทึกข้อมูลผู้ป่วย"}</span>
            <i aria-hidden="true">{loading ? "↻" : "✓"}</i>
          </button>
          <button className="secondary-button" type="button" onClick={handleCancelClick}>ยกเลิก</button>
        </div>

        <p className="privacy-note">ระบบจะไม่แสดงชื่อ อาการ หรือข้อมูลส่วนบุคคลบนจอแสดงสถานะคิวสาธารณะ</p>
      </form>
    </section>
  );
}
