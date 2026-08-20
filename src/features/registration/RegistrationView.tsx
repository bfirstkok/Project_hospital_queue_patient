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
  
  // Single personal phone
  payload.phone = valueOrNull(data.get("phone"));

  // Handle multiple emergency contacts (Max 3)
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
  return {
    ...payload,
    age: payload.age === null ? null : Number(payload.age),
    height_cm: payload.height_cm === null ? null : Number(payload.height_cm),
    weight_kg: payload.weight_kg === null ? null : Number(payload.weight_kg),
    consent: data.has("consent"),
  } as RegistrationPayload;
}

const SYMPTOM_OPTIONS = [
  "🤒 มีไข้ / หนาวสั่น",
  "🗣️ ไอ / เจ็บคอ / มีน้ำมูก",
  "😵‍💫 เวียนศีรษะ / หน้ามืด",
  "🤢 ปวดท้อง / คลื่นไส้",
  "🫁 แน่นหน้าอก / หายใจเหนื่อย",
  "🦴 ปวดกล้ามเนื้อ / ปวดข้อ",
  "🩹 มีแผล / ได้รับบาดเจ็บ",
  "👁️ ตาแดง / ระคายเคืองตา",
];

const CHRONIC_OPTIONS = [
  "ไม่มีโรคประจำตัว",
  "ความดันโลหิตสูง",
  "เบาหวาน",
  "โรคหัวใจ",
  "โรคไต",
  "หอบหืด / ภูมิแพ้",
  "ไขมันในเลือดสูง",
];

const ALLERGY_OPTIONS = [
  "ไม่มีประวัติแพ้ยา",
  "แพ้ยากลุ่มเพนิซิลลิน (Penicillin)",
  "แพ้ยาแก้ปวด (NSAIDs / แอสไพริน)",
  "แพ้ยาซัลฟา (Sulfa)",
  "แพ้อาหารทะเล",
];

export function RegistrationView({ onLogin, onSuccess }: RegistrationViewProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [loading, setLoading] = useState(false);

  // Emergency contact list state (Max 3)
  const [emergencyCount, setEmergencyCount] = useState<number>(1);

  // Quick choice chip states
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState<string>("");

  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [customDisease, setCustomDisease] = useState<string>("");

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState<string>("");

  // Detailed Age Calculation State
  const [birthDate, setBirthDate] = useState<string>("");
  const [calculatedAgeText, setCalculatedAgeText] = useState<string>("");
  const [ageYears, setAgeYears] = useState<number | string>("");

  function handleBirthDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setBirthDate(val);
    if (!val) {
      setCalculatedAgeText("");
      setAgeYears("");
      return;
    }
    const birth = new Date(val);
    const now = new Date();
    if (isNaN(birth.getTime()) || birth > now) return;

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    setAgeYears(years);
    setCalculatedAgeText(`อายุ: ${years} ปี ${months} เดือน ${days} วัน`);
  }

  function toggleSymptom(item: string) {
    const clean = item.replace(/^[^\s]+\s/, "");
    setSelectedSymptoms((prev) =>
      prev.includes(clean) ? prev.filter((s) => s !== clean) : [...prev, clean]
    );
  }

  function toggleDisease(item: string) {
    if (item === "ไม่มีโรคประจำตัว") {
      setSelectedDiseases(["ไม่มีโรคประจำตัว"]);
      return;
    }
    setSelectedDiseases((prev) => {
      const filtered = prev.filter((d) => d !== "ไม่มีโรคประจำตัว");
      return filtered.includes(item) ? filtered.filter((d) => d !== item) : [...filtered, item];
    });
  }

  function toggleAllergy(item: string) {
    if (item === "ไม่มีประวัติแพ้ยา") {
      setSelectedAllergies(["ไม่มีประวัติแพ้ยา"]);
      return;
    }
    setSelectedAllergies((prev) => {
      const filtered = prev.filter((a) => a !== "ไม่มีประวัติแพ้ยา");
      return filtered.includes(item) ? filtered.filter((a) => a !== item) : [...filtered, item];
    });
  }

  const finalDiseases = [...selectedDiseases, customDisease.trim()].filter(Boolean).join(", ");
  const finalAllergies = [...selectedAllergies, customAllergy.trim()].filter(Boolean).join(", ");

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
        <span className="eyebrow">ลงทะเบียนรับบริการ OPD</span>
        <h1>กรอกข้อมูลผู้ป่วย</h1>
        <p>แตะเลือกตัวเลือกที่ตรงกับอาการของคุณ หรือพิมพ์ระบุเพิ่มเติมได้สะดวก</p>
        <div className="login-prompt">
          <span>มีประวัติหรือลงทะเบียนไว้แล้ว?</span>
          <button className="login-button" type="button" onClick={onLogin}>เข้าสู่ระบบ</button>
        </div>
      </div>

      <ol className="steps" aria-label="ขั้นตอนรับบริการ">
        <li className="active"><span>1</span>ลงทะเบียน</li>
        <li><span>2</span>วัดสัญญาณชีพ</li>
        <li><span>3</span>รอเรียกคิว</li>
      </ol>

      {message && <div className="alert" role="alert">{message}</div>}

      <form ref={formRef} className="form-card" autoComplete="on" onSubmit={submit}>
        <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        
        {/* Block 1: ข้อมูลระบุตัวตนผู้ป่วย */}
        <fieldset>
          <legend>
            <span className="section-number">👤</span>
            <span>ข้อมูลผู้ป่วย<small>ระบุตัวตนและข้อมูลการติดต่อส่วนตัว</small></span>
          </legend>
          <div className="form-grid">
            <Field label="ชื่อ" required>
              <input name="first_name" maxLength={100} required placeholder="เช่น สมชาย" autoComplete="given-name" className={fieldClass("first_name")} />
            </Field>
            <Field label="นามสกุล" required>
              <input name="last_name" maxLength={100} required placeholder="เช่น ใจดี" autoComplete="family-name" className={fieldClass("last_name")} />
            </Field>
            <Field label="เลขบัตรประชาชน" required wide help="ตัวเลข 13 หลักสำหรับค้นหาประวัติการรักษา">
              <input name="national_id" maxLength={13} minLength={13} inputMode="numeric" pattern="[0-9]{13}" required placeholder="ตัวเลข 13 หลัก ไม่ต้องใส่ขีด" onInput={normalizeNationalId} className={fieldClass("national_id")} />
            </Field>
            <Field label="เพศ">
              <select name="gender">
                <option value="UNKNOWN">ไม่ระบุ</option>
                <option value="M">ชาย</option>
                <option value="F">หญิง</option>
                <option value="O">อื่น ๆ</option>
              </select>
            </Field>
            
            {/* Age & Date of Birth */}
            <Field label="อายุ">
              <SuffixInput
                name="age"
                type="number"
                min={0}
                max={130}
                inputMode="numeric"
                placeholder="0"
                suffix="ปี"
                value={ageYears}
                onChange={(e) => {
                  setAgeYears(e.target.value);
                  if (e.target.value) {
                    const days = Number(e.target.value) * 365;
                    setCalculatedAgeText(`อายุประมาณ: ${e.target.value} ปี (ประมาณ ${days.toLocaleString()} วัน)`);
                  } else {
                    setCalculatedAgeText("");
                  }
                }}
              />
            </Field>
            <div className="field">
              <span>หรือเลือกวันเกิด (คำนวณอายุอัตโนมัติ)</span>
              <input type="date" value={birthDate} onChange={handleBirthDateChange} aria-label="วันเดือนปีเกิด" max={new Date().toISOString().split("T")[0]} />
              {calculatedAgeText && <div className="age-badge-notification" role="status">📅 {calculatedAgeText}</div>}
            </div>

            {/* Single Personal Phone Number */}
            <Field label="เบอร์โทรศัพท์ส่วนตัว">
              <input name="phone" maxLength={20} inputMode="tel" placeholder="08xxxxxxxx" autoComplete="tel" />
            </Field>
          </div>
        </fieldset>

        {/* Block 2: อาการที่มารับบริการ (มีช้อยส์ติ๊กเลือก + พิมพ์เสริม) */}
        <fieldset>
          <legend>
            <span className="section-number">💬</span>
            <span>อาการสำคัญที่มารับบริการ <b>*</b><small>แตะเลือกอาการที่ตรงกับคุณ หรือพิมพ์ระบุเพิ่มเติม</small></span>
          </legend>
          
          <div className="choice-chips-group" role="group" aria-label="ตัวเลือกอาการยอดนิยม">
            {SYMPTOM_OPTIONS.map((symptom) => {
              const clean = symptom.replace(/^[^\s]+\s/, "");
              const isSelected = selectedSymptoms.includes(clean);
              return (
                <button
                  type="button"
                  key={symptom}
                  className={`choice-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleSymptom(symptom)}
                >
                  {symptom}
                </button>
              );
            })}
          </div>

          <Field label="ระบุอาการเพิ่มเติม / รายละเอียด" required>
            <textarea
              name="note"
              placeholder="เช่น เวียนศีรษะ มีไข้ และไอติดต่อกัน 2 วัน"
              value={customSymptom || (selectedSymptoms.length > 0 ? selectedSymptoms.join(", ") : "")}
              onChange={(e) => setCustomSymptom(e.target.value)}
              className={fieldClass("note")}
              required
            />
          </Field>
        </fieldset>

        {/* Block 3: ข้อมูลสุขภาพเบื้องต้น & โรคประจำตัว / แพ้ยา (มีช้อยส์) */}
        <fieldset>
          <legend>
            <span className="section-number">🩺</span>
            <span>ข้อมูลสุขภาพ & ประวัติแพ้ยา<small>แตะเลือกเพื่อความสะดวกรวดเร็ว</small></span>
          </legend>
          <div className="info-strip">สัญญาณชีพ (ความดัน, ชีพจร, ไข้) จะวัดที่จุดคัดกรองโดยเจ้าหน้าที่</div>

          <div className="form-grid three">
            <Field label="หมู่เลือด">
              <select name="blood_type">
                <option value="UNKNOWN">ไม่ทราบ</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </Field>
            <Field label="ส่วนสูง">
              <SuffixInput name="height_cm" type="number" min={30} max={250} step="0.1" inputMode="decimal" placeholder="170" suffix="ซม." />
            </Field>
            <Field label="น้ำหนัก">
              <SuffixInput name="weight_kg" type="number" min={1} max={400} step="0.1" inputMode="decimal" placeholder="65" suffix="กก." />
            </Field>
          </div>

          {/* โรคประจำตัว ช้อยส์ */}
          <div className="field-group-spacing">
            <span className="field-group-title">โรคประจำตัว:</span>
            <div className="choice-chips-group">
              {CHRONIC_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`choice-chip ${selectedDiseases.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleDisease(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <input placeholder="โรคประจำตัวอื่น ๆ (หากมี)" value={customDisease} onChange={(e) => setCustomDisease(e.target.value)} />
            <input type="hidden" name="chronic_diseases" value={finalDiseases} />
          </div>

          {/* ประวัติแพ้ยา ช้อยส์ */}
          <div className="field-group-spacing">
            <span className="field-group-title">ประวัติแพ้ยา / อาหาร:</span>
            <div className="choice-chips-group">
              {ALLERGY_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`choice-chip danger ${selectedAllergies.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleAllergy(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <input placeholder="ยาหรือสารที่แพ้อื่น ๆ (หากมี)" value={customAllergy} onChange={(e) => setCustomAllergy(e.target.value)} />
            <input type="hidden" name="allergies" value={finalAllergies} />
          </div>

          <Field label="ยาที่ใช้ประจำ" wide>
            <input name="medications" maxLength={1000} placeholder="ระบุชื่อยา (ถ้าทราบ เช่น ยาความดัน, ยาเบาหวาน)" />
          </Field>
        </fieldset>

        {/* Block 4: ที่อยู่ */}
        <fieldset>
          <legend>
            <span className="section-number">📍</span>
            <span>ที่อยู่ปัจจุบัน<small>สำหรับระบุพื้นที่รับบริการ</small></span>
          </legend>
          <div className="form-grid">
            <Field label="จังหวัด"><input name="province" maxLength={100} placeholder="เช่น ขอนแก่น" autoComplete="address-level1" /></Field>
            <Field label="อำเภอ / เขต"><input name="district" maxLength={100} autoComplete="address-level2" /></Field>
            <Field label="ตำบล / แขวง"><input name="subdistrict" maxLength={100} autoComplete="address-level3" /></Field>
            <Field label="รหัสไปรษณีย์"><input name="postal_code" maxLength={5} inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" /></Field>
          </div>
        </fieldset>

        {/* Block 5: ผู้ติดต่อฉุกเฉิน (เพิ่มได้สูงสุด 3 คน/เบอร์) */}
        <fieldset>
          <legend>
            <span className="section-number">🚨</span>
            <span>ผู้ติดต่อฉุกเฉิน<small>ใช้ติดต่อกรณีจำเป็นเร่งด่วน (เพิ่มได้สูงสุด 3 คน/เบอร์)</small></span>
          </legend>
          
          <div className="emergency-contacts-wrapper">
            {/* Contact 1 */}
            <div className="emergency-entry-card">
              <span className="entry-tag">ผู้ติดต่อฉุกเฉินคนที่ 1 (หลัก)</span>
              <div className="form-grid three">
                <Field label="ชื่อผู้ติดต่อ"><input name="emergency_name_1" maxLength={120} autoComplete="name" placeholder="ชื่อ-นามสกุล" /></Field>
                <Field label="ความสัมพันธ์">
                  <select name="emergency_relationship_1">
                    <option value="">-- เลือก --</option>
                    <option value="FATHER">พ่อ</option>
                    <option value="MOTHER">แม่</option>
                    <option value="SPOUSE">คู่สมรส</option>
                    <option value="CHILD">บุตร</option>
                    <option value="SIBLING">พี่น้อง</option>
                    <option value="RELATIVE">ญาติ</option>
                    <option value="FRIEND">เพื่อน</option>
                    <option value="CAREGIVER">ผู้ดูแล</option>
                    <option value="OTHER">อื่น ๆ</option>
                  </select>
                </Field>
                <Field label="เบอร์โทรศัพท์"><input name="emergency_phone_1" maxLength={20} inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxx" /></Field>
              </div>
            </div>

            {/* Contact 2 */}
            {emergencyCount >= 2 && (
              <div className="emergency-entry-card">
                <div className="entry-header">
                  <span className="entry-tag">ผู้ติดต่อฉุกเฉินคนที่ 2</span>
                  <button type="button" className="remove-entry-btn" onClick={() => setEmergencyCount(1)}>✕ ลบ</button>
                </div>
                <div className="form-grid three">
                  <Field label="ชื่อผู้ติดต่อ"><input name="emergency_name_2" maxLength={120} placeholder="ชื่อ-นามสกุล" /></Field>
                  <Field label="ความสัมพันธ์">
                    <select name="emergency_relationship_2">
                      <option value="">-- เลือก --</option>
                      <option value="FATHER">พ่อ</option>
                      <option value="MOTHER">แม่</option>
                      <option value="SPOUSE">คู่สมรส</option>
                      <option value="CHILD">บุตร</option>
                      <option value="SIBLING">พี่น้อง</option>
                      <option value="RELATIVE">ญาติ</option>
                      <option value="FRIEND">เพื่อน</option>
                      <option value="CAREGIVER">ผู้ดูแล</option>
                      <option value="OTHER">อื่น ๆ</option>
                    </select>
                  </Field>
                  <Field label="เบอร์โทรศัพท์"><input name="emergency_phone_2" maxLength={20} inputMode="tel" placeholder="08xxxxxxxx" /></Field>
                </div>
              </div>
            )}

            {/* Contact 3 */}
            {emergencyCount >= 3 && (
              <div className="emergency-entry-card">
                <div className="entry-header">
                  <span className="entry-tag">ผู้ติดต่อฉุกเฉินคนที่ 3</span>
                  <button type="button" className="remove-entry-btn" onClick={() => setEmergencyCount(2)}>✕ ลบ</button>
                </div>
                <div className="form-grid three">
                  <Field label="ชื่อผู้ติดต่อ"><input name="emergency_name_3" maxLength={120} placeholder="ชื่อ-นามสกุล" /></Field>
                  <Field label="ความสัมพันธ์">
                    <select name="emergency_relationship_3">
                      <option value="">-- เลือก --</option>
                      <option value="FATHER">พ่อ</option>
                      <option value="MOTHER">แม่</option>
                      <option value="SPOUSE">คู่สมรส</option>
                      <option value="CHILD">บุตร</option>
                      <option value="SIBLING">พี่น้อง</option>
                      <option value="RELATIVE">ญาติ</option>
                      <option value="FRIEND">เพื่อน</option>
                      <option value="CAREGIVER">ผู้ดูแล</option>
                      <option value="OTHER">อื่น ๆ</option>
                    </select>
                  </Field>
                  <Field label="เบอร์โทรศัพท์"><input name="emergency_phone_3" maxLength={20} inputMode="tel" placeholder="08xxxxxxxx" /></Field>
                </div>
              </div>
            )}

            {emergencyCount < 3 && (
              <button
                type="button"
                className="add-emergency-btn"
                onClick={() => setEmergencyCount((c) => Math.min(3, c + 1))}
              >
                ➕ เพิ่มผู้ติดต่อฉุกเฉิน / เบอร์สำรอง ({emergencyCount}/3)
              </button>
            )}
          </div>
        </fieldset>

        <label className="consent">
          <input name="consent" type="checkbox" required />
          <span>ข้าพเจ้ายืนยันว่าข้อมูลถูกต้อง และยินยอมให้ใช้ข้อมูลเพื่อการลงทะเบียน คัดกรอง และจัดคิวรับบริการ <b>*</b></span>
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "กำลังบันทึกข้อมูล..." : "บันทึกผู้ป่วย"}</span>
            <i aria-hidden="true">{loading ? "↻" : "✓"}</i>
          </button>
          <button className="secondary-button" type="reset">ยกเลิก</button>
        </div>

        <p className="privacy-note">ระบบจะไม่แสดงชื่อ อาการ หรือระดับความเร่งด่วนบนหน้าสถานะคิว</p>
      </form>
    </section>
  );
}

function Field({ label, required, wide, help, children }: { label: string; required?: boolean; wide?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <label className={`field${wide ? " field-wide" : ""}`}>
      <span>{label} {required && <b>*</b>}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function SuffixInput(props: React.InputHTMLAttributes<HTMLInputElement> & { name: string; suffix: string }) {
  const { suffix, ...inputProps } = props;
  const labels: Record<string, string> = { age: "อายุ", height_cm: "ส่วนสูง", weight_kg: "น้ำหนัก" };
  return (
    <div className="input-suffix">
      <input aria-label={labels[inputProps.name]} {...inputProps} />
      <em>{suffix}</em>
    </div>
  );
}
