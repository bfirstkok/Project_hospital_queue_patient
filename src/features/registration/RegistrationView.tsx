import { useRef, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { RegistrationPayload, RegistrationResult } from "@/shared/api/types";

interface RegistrationViewProps {
  onLogin: () => void;
  onSuccess: (token: string, result: RegistrationResult) => void;
}

const numericFields = new Set(["age", "height_cm", "weight_kg"]);

function valueOrNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function collectRegistrationPayload(form: HTMLFormElement): RegistrationPayload {
  const data = new FormData(form);
  const payload = Object.fromEntries([...data.entries()].map(([key, value]) => [key, valueOrNull(value)])) as Record<string, string | null>;
  for (const field of numericFields) {
    payload[field] = payload[field] === null ? null : String(Number(payload[field]));
  }
  return {
    ...payload,
    age: payload.age === null ? null : Number(payload.age),
    height_cm: payload.height_cm === null ? null : Number(payload.height_cm),
    weight_kg: payload.weight_kg === null ? null : Number(payload.weight_kg),
    consent: data.has("consent"),
  } as RegistrationPayload;
}

export function RegistrationView({ onLogin, onSuccess }: RegistrationViewProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setInvalidField("");
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      const result = await patientApi.register(collectRegistrationPayload(form));
      if (!result.access_token) throw new ApiError("เว็บหลักไม่ได้ส่ง access token กลับมา");
      onSuccess(result.access_token, result);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้");
      const [field, errors] = Object.entries(apiError.errors || {})[0] || [];
      setInvalidField(field || "");
      const input = field ? form.elements.namedItem(field) : null;
      if (input instanceof HTMLElement) input.focus();
      const detail = Array.isArray(errors) ? errors[0] : errors;
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อเว็บหลักไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือติดต่อเจ้าหน้าที่" : detail || apiError.message);
    } finally {
      setLoading(false);
    }
  }

  const normalizeNationalId = (event: FormEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13);
  };
  const fieldClass = (name: string) => invalidField === name ? "invalid" : "";

  return (
    <section id="registrationView" className="page-shell">
      <div className="intro">
        <span className="eyebrow">ลงทะเบียนรับบริการ</span>
        <h1>กรอกข้อมูลผู้ป่วย</h1>
        <p>กรุณาตรวจสอบข้อมูลให้ถูกต้อง หลังลงทะเบียนให้นำหน้านี้ไปแสดงที่จุดวัดสัญญาณชีพ</p>
        <div className="login-prompt"><span>ลงทะเบียนไว้แล้ว?</span><button className="login-button" type="button" onClick={onLogin}>เข้าสู่ระบบ</button></div>
      </div>
      <ol className="steps" aria-label="ขั้นตอนรับบริการ"><li className="active"><span>1</span>ลงทะเบียน</li><li><span>2</span>วัดสัญญาณชีพ</li><li><span>3</span>รอเรียกคิว</li></ol>
      {message && <div className="alert" role="alert">{message}</div>}
      <form ref={formRef} className="form-card" autoComplete="on" onSubmit={submit}>
        <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <fieldset>
          <legend><span className="section-number">1</span><span>ข้อมูลผู้ป่วย<small>ข้อมูลสำหรับระบุตัวตนและติดต่อ</small></span></legend>
          <div className="form-grid">
            <Field label="ชื่อ" required><input name="first_name" maxLength={100} required placeholder="เช่น สมชาย" autoComplete="given-name" className={fieldClass("first_name")} /></Field>
            <Field label="นามสกุล" required><input name="last_name" maxLength={100} required placeholder="เช่น ใจดี" autoComplete="family-name" className={fieldClass("last_name")} /></Field>
            <Field label="เลขบัตรประชาชน" required wide help="ใช้ตรวจสอบข้อมูลผู้ป่วยเดิมในระบบ"><input name="national_id" maxLength={13} minLength={13} inputMode="numeric" pattern="[0-9]{13}" required placeholder="ตัวเลข 13 หลัก ไม่ต้องใส่ขีด" onInput={normalizeNationalId} className={fieldClass("national_id")} /></Field>
            <Field label="เพศ"><select name="gender"><option value="UNKNOWN">ไม่ระบุ</option><option value="M">ชาย</option><option value="F">หญิง</option><option value="O">อื่น ๆ</option></select></Field>
            <Field label="อายุ"><SuffixInput name="age" type="number" min={0} max={130} inputMode="numeric" placeholder="0" suffix="ปี" /></Field>
            <Field label="เบอร์โทรศัพท์"><input name="phone" maxLength={20} inputMode="tel" placeholder="08xxxxxxxx" autoComplete="tel" /></Field>
          </div>
        </fieldset>
        <fieldset>
          <legend><span className="section-number">2</span><span>ข้อมูลสุขภาพเบื้องต้น<small>สัญญาณชีพวัดโดยเจ้าหน้าที่หรืออุปกรณ์ IoT</small></span></legend>
          <div className="info-strip">ไม่ต้องกรอกค่าความดัน ชีพจร อุณหภูมิ หรือออกซิเจนในเลือดด้วยตนเอง</div>
          <div className="form-grid three">
            <Field label="หมู่เลือด"><select name="blood_type"><option value="UNKNOWN">ไม่ทราบ</option><option value="A">A</option><option value="B">B</option><option value="AB">AB</option><option value="O">O</option></select></Field>
            <Field label="ส่วนสูง"><SuffixInput name="height_cm" type="number" min={30} max={250} step="0.1" inputMode="decimal" placeholder="170" suffix="ซม." /></Field>
            <Field label="น้ำหนัก"><SuffixInput name="weight_kg" type="number" min={1} max={400} step="0.1" inputMode="decimal" placeholder="65" suffix="กก." /></Field>
            <Field label="BP ตัวบน"><input type="number" placeholder="บันทึกโดยเจ้าหน้าที่" disabled /></Field>
            <Field label="BP ตัวล่าง"><input type="number" placeholder="บันทึกโดยเจ้าหน้าที่" disabled /></Field>
          </div>
          <div className="form-grid">
            <Field label="โรคประจำตัว" wide><textarea name="chronic_diseases" maxLength={1000} placeholder="หากไม่มีให้เว้นว่าง" /></Field>
            <Field label="ประวัติแพ้ยา / อาหาร" wide><textarea name="allergies" maxLength={1000} placeholder="หากไม่มีให้เว้นว่าง" /></Field>
            <Field label="ยาที่ใช้ประจำ" wide><textarea name="medications" maxLength={1000} placeholder="ระบุชื่อยา (ถ้าทราบ)" /></Field>
          </div>
        </fieldset>
        <fieldset>
          <legend><span className="section-number">3</span><span>อาการที่มารับบริการ<small>บอกอาการสำคัญให้กระชับและชัดเจน</small></span></legend>
          <Field label="อาการของผู้ป่วย" required><textarea name="note" maxLength={1500} required placeholder="เช่น เวียนศีรษะ มีไข้ และไอติดต่อกัน 2 วัน" className={fieldClass("note")} /></Field>
        </fieldset>
        <fieldset>
          <legend><span className="section-number">4</span><span>ที่อยู่<small>ข้อมูลที่อยู่ปัจจุบัน</small></span></legend>
          <div className="form-grid"><Field label="จังหวัด"><input name="province" maxLength={100} placeholder="เช่น ขอนแก่น" autoComplete="address-level1" /></Field><Field label="อำเภอ / เขต"><input name="district" maxLength={100} autoComplete="address-level2" /></Field><Field label="ตำบล / แขวง"><input name="subdistrict" maxLength={100} autoComplete="address-level3" /></Field><Field label="รหัสไปรษณีย์"><input name="postal_code" maxLength={5} inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" /></Field></div>
        </fieldset>
        <fieldset>
          <legend><span className="section-number">5</span><span>ผู้ติดต่อฉุกเฉิน<small>ใช้ติดต่อเฉพาะกรณีจำเป็น</small></span></legend>
          <div className="form-grid three"><Field label="ชื่อผู้ติดต่อ"><input name="emergency_name" maxLength={120} autoComplete="name" /></Field><Field label="ความสัมพันธ์"><select name="emergency_relationship"><option value="">-- เลือก --</option><option value="FATHER">พ่อ</option><option value="MOTHER">แม่</option><option value="SPOUSE">คู่สมรส</option><option value="CHILD">บุตร</option><option value="SIBLING">พี่น้อง</option><option value="RELATIVE">ญาติ</option><option value="FRIEND">เพื่อน</option><option value="CAREGIVER">ผู้ดูแล</option><option value="OTHER">อื่น ๆ</option></select></Field><Field label="เบอร์โทรศัพท์"><input name="emergency_phone" maxLength={20} inputMode="tel" autoComplete="tel" /></Field></div>
        </fieldset>
        <label className="consent"><input name="consent" type="checkbox" required /><span>ข้าพเจ้ายืนยันว่าข้อมูลถูกต้อง และยินยอมให้ใช้ข้อมูลเพื่อการลงทะเบียน คัดกรอง และจัดคิวรับบริการ <b>*</b></span></label>
        <div className="form-actions"><button className="primary-button" type="submit" disabled={loading}><span>{loading ? "กำลังบันทึกข้อมูล..." : "บันทึกผู้ป่วย"}</span><i aria-hidden="true">{loading ? "↻" : "✓"}</i></button><button className="secondary-button" type="reset">ยกเลิก</button></div>
        <p className="privacy-note">ระบบจะไม่แสดงชื่อ อาการ หรือระดับความเร่งด่วนบนหน้าสถานะคิว</p>
      </form>
    </section>
  );
}

function Field({ label, required, wide, help, children }: { label: string; required?: boolean; wide?: boolean; help?: string; children: React.ReactNode }) {
  return <label className={`field${wide ? " field-wide" : ""}`}><span>{label} {required && <b>*</b>}</span>{children}{help && <small>{help}</small>}</label>;
}

function SuffixInput(props: React.InputHTMLAttributes<HTMLInputElement> & { name: string; suffix: string }) {
  const { suffix, ...inputProps } = props;
  const labels: Record<string, string> = { age: "อายุ", height_cm: "ส่วนสูง", weight_kg: "น้ำหนัก" };
  return <div className="input-suffix"><input aria-label={labels[inputProps.name]} {...inputProps} /><em>{suffix}</em></div>;
}
