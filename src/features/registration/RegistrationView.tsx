import { useRef, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { RegistrationPayload, RegistrationResult } from "@/shared/api/types";
import {
  PatientProfileForm,
  PROFILE_DRAFT_KEY,
  type PatientProfileFormHandle,
} from "@/features/patient-profile/PatientProfileForm";
import { PdpaConsentGate } from "./PdpaConsentModal";

interface RegistrationViewProps {
  token?: string;
  hasToken?: boolean;
  initialPdpaAccepted?: boolean;
  onLogin: () => void;
  onCancel?: () => void;
  onSuccess: (token: string, result: RegistrationResult) => void;
  onUnauthorized?: () => void;
}

const numericFields = new Set(["age", "height_cm", "weight_kg"]);

function valueOrNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function collectRegistrationPayload(form: HTMLFormElement): RegistrationPayload {
  const data = new FormData(form);
  const payload = Object.fromEntries(
    [...data.entries()].map(([key, value]) => [key, valueOrNull(value)]),
  ) as Record<string, string | null>;

  payload.phone = valueOrNull(data.get("phone"));

  const emergencyNames = [data.get("emergency_name_1"), data.get("emergency_name_2"), data.get("emergency_name_3"), data.get("emergency_name")]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const emergencyPhones = [data.get("emergency_phone_1"), data.get("emergency_phone_2"), data.get("emergency_phone_3"), data.get("emergency_phone")]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const emergencyRels = [data.get("emergency_relationship_1"), data.get("emergency_relationship_2"), data.get("emergency_relationship_3"), data.get("emergency_relationship")]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  payload.emergency_name = emergencyNames.length > 0 ? emergencyNames.join(", ") : null;
  payload.emergency_phone = emergencyPhones.length > 0 ? emergencyPhones.join(", ") : null;
  payload.emergency_relationship = emergencyRels.length > 0 ? emergencyRels[0] : null;

  for (const field of numericFields) {
    payload[field] = payload[field] === null ? null : String(Number(payload[field]));
  }

  if (payload.national_id) {
    let cleanId = payload.national_id.replace(/\D/g, "");
    if (cleanId.length !== 13) {
      try {
        const saved = (sessionStorage.getItem("patient_national_id") || localStorage.getItem("patient_national_id") || "").replace(/\D/g, "");
        if (saved.length === 13) cleanId = saved;
      } catch {
        // ignore
      }
    }
    payload.national_id = cleanId;
  }

  return {
    ...payload,
    age: payload.age === null ? null : Number(payload.age),
    height_cm: payload.height_cm === null ? null : Number(payload.height_cm),
    weight_kg: payload.weight_kg === null ? null : Number(payload.weight_kg),
    consent: data.has("consent"),
  } as RegistrationPayload;
}

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

export function RegistrationView({
  token,
  hasToken,
  initialPdpaAccepted = false,
  onLogin,
  onCancel,
  onSuccess,
  onUnauthorized,
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

  function toggleSymptom(item: string) {
    setSelectedSymptoms((prev) => (prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]));
  }

  function resetForm() {
    profileRef.current?.clearDraft();
    setSelectedSymptoms([]);
    setCustomSymptom("");
  }

  function handleCancelClick() {
    if (isFormDirty) {
      setShowCancelConfirm(true);
      return;
    }
    resetForm();
    (onCancel ?? onLogin)();
  }

  function handleConfirmCancel() {
    setShowCancelConfirm(false);
    resetForm();
    (onCancel ?? onLogin)();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setInvalidField("");
    if (!form.reportValidity()) return;

    const profileError = profileRef.current?.validate();
    if (profileError) {
      setInvalidField(profileError.field);
      setMessage(profileError.message);
      return;
    }

    const payload = collectRegistrationPayload(form);

    setLoading(true);
    try {
      const result = await patientApi.register(payload);
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      try {
        localStorage.removeItem(PROFILE_DRAFT_KEY);
        sessionStorage.removeItem("opd_cancelled_queue_number");
        if (payload.national_id) {
          sessionStorage.setItem("patient_national_id", payload.national_id);
          localStorage.setItem("patient_national_id", payload.national_id);
        }
      } catch {
        // ignore
      }
      onSuccess(result.access_token, result);
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
      {showPdpaReview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="หน้านโยบาย PDPA">
          <div className="modal-inner">
            <PdpaConsentGate onAccept={() => setShowPdpaReview(false)} onDecline={() => setShowPdpaReview(false)} />
          </div>
        </div>
      )}

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

      {message && <div className="alert" role="alert">{message}</div>}

      <form ref={formRef} className="form-card" autoComplete="on" onSubmit={submit}>
        <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <PatientProfileForm
          ref={profileRef}
          mode="register"
          token={token}
          hasToken={hasToken}
          draftKey={token ? undefined : PROFILE_DRAFT_KEY}
          onUnauthorized={onUnauthorized}
          onDirtyChange={setProfileDirty}
        >
          {/* Block 2: อาการที่มารับบริการ */}
          <fieldset>
            <legend>
              <span className="section-number">2</span>
              <span>อาการสำคัญที่มารับบริการ <b>*</b><small>เลือกอาการเบื้องต้น หรือพิมพ์ระบุรายละเอียดเพิ่มเติม</small></span>
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
