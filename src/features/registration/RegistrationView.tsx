import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { RegistrationPayload, RegistrationResult } from "@/shared/api/types";
import { ALL_77_PROVINCES, getDistricts, getPostalCode, getSubdistricts } from "@/shared/data/thai-address";
import { PdpaConsentGate } from "./PdpaConsentModal";

interface RegistrationViewProps {
  hasToken?: boolean;
  initialPdpaAccepted?: boolean;
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
  "มีไข้ / หนาวสั่น",
  "ไอ / เจ็บคอ / มีน้ำมูก",
  "เวียนศีรษะ / หน้ามืด",
  "ปวดท้อง / คลื่นไส้",
  "แน่นหน้าอก / หายใจเหนื่อย",
  "ปวดกล้ามเนื้อ / ปวดข้อ",
  "มีบาดแผล / อุบัติเหตุ",
  "ตาแดง / ระคายเคืองตา",
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

const STORAGE_KEY = "opd_patient_registration_draft_v1";

export function RegistrationView({ hasToken, initialPdpaAccepted = false, onLogin, onSuccess }: RegistrationViewProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPdpaAccepted, setIsPdpaAccepted] = useState<boolean>(initialPdpaAccepted);
  const [showPdpaReview, setShowPdpaReview] = useState<boolean>(false);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [loading, setLoading] = useState(false);

  // Local Draft status
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const [draftSavedTime, setDraftSavedTime] = useState<string>("");

  // Block 1 Form states
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [nationalId, setNationalId] = useState<string>("");
  const [gender, setGender] = useState<string>("UNKNOWN");
  const [phone, setPhone] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [calculatedAgeText, setCalculatedAgeText] = useState<string>("");
  const [ageYears, setAgeYears] = useState<number | string>("");

  // Block 2: Symptom state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState<string>("");

  // Block 3: Health state
  const [bloodType, setBloodType] = useState<string>("UNKNOWN");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [customDisease, setCustomDisease] = useState<string>("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState<string>("");
  const [medications, setMedications] = useState<string>("");

  // Block 4: Address Dropdown states (77 provinces cascading)
  const [province, setProvince] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [subdistrict, setSubdistrict] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");

  // Block 5: Emergency contact list state (Max 3 items with stable IDs)
  const [emergencyContacts, setEmergencyContacts] = useState<Array<{ id: string; name: string; relationship: string; phone: string }>>([
    { id: "em-initial-1", name: "", relationship: "", phone: "" },
  ]);

  // Load saved draft on initial mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === "object") {
        if (draft.firstName) setFirstName(draft.firstName);
        if (draft.lastName) setLastName(draft.lastName);
        if (draft.nationalId) setNationalId(draft.nationalId);
        if (draft.gender) setGender(draft.gender);
        if (draft.phone) setPhone(draft.phone);
        if (draft.birthDate) setBirthDate(draft.birthDate);
        if (draft.ageYears !== undefined && draft.ageYears !== "") setAgeYears(draft.ageYears);
        if (draft.calculatedAgeText) setCalculatedAgeText(draft.calculatedAgeText);
        if (Array.isArray(draft.selectedSymptoms)) setSelectedSymptoms(draft.selectedSymptoms);
        if (draft.customSymptom) setCustomSymptom(draft.customSymptom);
        if (draft.bloodType) setBloodType(draft.bloodType);
        if (draft.heightCm) setHeightCm(draft.heightCm);
        if (draft.weightKg) setWeightKg(draft.weightKg);
        if (Array.isArray(draft.selectedDiseases)) setSelectedDiseases(draft.selectedDiseases);
        if (draft.customDisease) setCustomDisease(draft.customDisease);
        if (Array.isArray(draft.selectedAllergies)) setSelectedAllergies(draft.selectedAllergies);
        if (draft.customAllergy) setCustomAllergy(draft.customAllergy);
        if (draft.medications) setMedications(draft.medications);
        if (draft.province) setProvince(draft.province);
        if (draft.district) setDistrict(draft.district);
        if (draft.subdistrict) setSubdistrict(draft.subdistrict);
        if (draft.postalCode) setPostalCode(draft.postalCode);
        if (Array.isArray(draft.emergencyContacts) && draft.emergencyContacts.length > 0) {
          setEmergencyContacts(draft.emergencyContacts);
        }
        if (draft.isPdpaAccepted) setIsPdpaAccepted(true);
        if (draft.savedAt) setDraftSavedTime(draft.savedAt);
        setHasRestoredDraft(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Autosave draft when user modifies any input
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasContent =
        firstName ||
        lastName ||
        nationalId ||
        phone ||
        birthDate ||
        customSymptom ||
        selectedSymptoms.length > 0 ||
        heightCm ||
        weightKg ||
        medications ||
        province ||
        emergencyContacts.some((c) => c.name || c.phone);

      if (hasContent) {
        const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
        const draftData = {
          firstName,
          lastName,
          nationalId,
          gender,
          phone,
          birthDate,
          ageYears,
          calculatedAgeText,
          selectedSymptoms,
          customSymptom,
          bloodType,
          heightCm,
          weightKg,
          selectedDiseases,
          customDisease,
          selectedAllergies,
          customAllergy,
          medications,
          province,
          district,
          subdistrict,
          postalCode,
          emergencyContacts,
          isPdpaAccepted,
          savedAt: now,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
          setDraftSavedTime(now);
        } catch {
          // Ignore quota errors
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    firstName,
    lastName,
    nationalId,
    gender,
    phone,
    birthDate,
    ageYears,
    calculatedAgeText,
    selectedSymptoms,
    customSymptom,
    bloodType,
    heightCm,
    weightKg,
    selectedDiseases,
    customDisease,
    selectedAllergies,
    customAllergy,
    medications,
    province,
    district,
    subdistrict,
    postalCode,
    emergencyContacts,
    isPdpaAccepted,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setFirstName("");
    setLastName("");
    setNationalId("");
    setGender("UNKNOWN");
    setPhone("");
    setBirthDate("");
    setAgeYears("");
    setCalculatedAgeText("");
    setSelectedSymptoms([]);
    setCustomSymptom("");
    setBloodType("UNKNOWN");
    setHeightCm("");
    setWeightKg("");
    setSelectedDiseases([]);
    setCustomDisease("");
    setSelectedAllergies([]);
    setCustomAllergy("");
    setMedications("");
    setProvince("");
    setDistrict("");
    setSubdistrict("");
    setPostalCode("");
    setEmergencyContacts([{ id: "em-initial-1", name: "", relationship: "", phone: "" }]);
    setHasRestoredDraft(false);
    setDraftSavedTime("");
  };

  const addEmergencyContact = () => {
    if (emergencyContacts.length < 3) {
      setEmergencyContacts((prev) => [
        ...prev,
        {
          id: `em-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: "",
          relationship: "",
          phone: "",
        },
      ]);
    }
  };

  const removeEmergencyContact = (idToRemove: string) => {
    setEmergencyContacts((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const updateEmergencyContact = (
    id: string,
    field: "name" | "relationship" | "phone",
    value: string
  ) => {
    setEmergencyContacts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

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
    setSelectedSymptoms((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
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
      try {
        localStorage.removeItem(STORAGE_KEY);
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
      setMessage(apiError.message === "Failed to fetch" ? "เชื่อมต่อเว็บหลักไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือติดต่อเจ้าหน้าที่" : detail || apiError.message);
    } finally {
      setLoading(false);
    }
  }

  // Cascading Address Handlers
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProvince(val);
    setDistrict("");
    setSubdistrict("");
    setPostalCode("");
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDistrict(val);
    setSubdistrict("");
    setPostalCode("");
  };

  const handleSubdistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSubdistrict(val);
    if (val && province && district) {
      const code = getPostalCode(province, district, val);
      if (code) {
        setPostalCode(code);
      }
    }
  };

  const districtOptions = province ? getDistricts(province) : [];
  const subdistrictOptions = province && district ? getSubdistricts(province, district) : [];

  const normalizeNationalId = (event: FormEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13);
  };
  const fieldClass = (name: string) => invalidField === name ? "invalid" : "";

  // PDPA Consent Gate Screen before entering registration form
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

        <PdpaConsentGate
          onAccept={() => setIsPdpaAccepted(true)}
          onDecline={onLogin}
        />
      </section>
    );
  }

  return (
    <section id="registrationView" className="page-shell">
      {showPdpaReview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="หน้านโยบาย PDPA">
          <div className="modal-inner">
            <PdpaConsentGate
              onAccept={() => setShowPdpaReview(false)}
              onDecline={() => setShowPdpaReview(false)}
            />
          </div>
        </div>
      )}

      <div className="intro">
        <span className="eyebrow">ลงทะเบียนรับบริการ OPD</span>
        <h1>{hasToken ? "จองคิวรับบริการ OPD วันนี้" : "กรอกข้อมูลผู้ป่วย"}</h1>
        <p>แตะเลือกตัวเลือกที่ตรงกับอาการของคุณ หรือพิมพ์ระบุเพิ่มเติมได้สะดวก</p>
        {!hasToken && (
          <div className="login-prompt">
            <span>มีประวัติหรือลงทะเบียนไว้แล้ว?</span>
            <button className="login-button" type="button" onClick={onLogin}>เข้าสู่ระบบ</button>
          </div>
        )}
      </div>

      <ol className="steps" aria-label="ขั้นตอนรับบริการ">
        <li className="active"><span>1</span>ลงทะเบียน</li>
        <li><span>2</span>วัดสัญญาณชีพ</li>
        <li><span>3</span>รอเรียกคิว</li>
      </ol>

      {hasRestoredDraft && (
        <div className="draft-restore-banner" role="status">
          <div className="draft-banner-text">
            <span className="draft-icon" aria-hidden="true">💾</span>
            <div>
              <strong>กู้คืนข้อมูลร่างที่คุณเคยกรอกไว้ให้อัตโนมัติ</strong>
              {draftSavedTime && <small> (บันทึกล่าสุดเมื่อ {draftSavedTime} น.)</small>}
            </div>
          </div>
          <button type="button" className="draft-clear-button" onClick={clearDraft}>
            ล้างข้อมูลเพื่อเริ่มใหม่
          </button>
        </div>
      )}

      {message && <div className="alert" role="alert">{message}</div>}

      <form ref={formRef} className="form-card" autoComplete="on" onSubmit={submit}>
        <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        
        {/* Block 1: ข้อมูลระบุตัวตนผู้ป่วย */}
        <fieldset>
          <legend>
            <span className="section-number">1</span>
            <span>ข้อมูลผู้ป่วย<small>ระบุตัวตนและข้อมูลการติดต่อส่วนตัว</small></span>
          </legend>
          <div className="form-grid">
            <Field label="ชื่อ" required>
              <input
                name="first_name"
                maxLength={100}
                required
                placeholder="เช่น สมชาย"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={fieldClass("first_name")}
              />
            </Field>
            <Field label="นามสกุล" required>
              <input
                name="last_name"
                maxLength={100}
                required
                placeholder="เช่น ใจดี"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={fieldClass("last_name")}
              />
            </Field>
            <Field label="เลขบัตรประชาชน" required wide help="ตัวเลข 13 หลักสำหรับค้นหาประวัติการรักษา">
              <input
                name="national_id"
                maxLength={13}
                minLength={13}
                inputMode="numeric"
                pattern="[0-9]{13}"
                required
                placeholder="ตัวเลข 13 หลัก ไม่ต้องใส่ขีด"
                value={nationalId}
                onInput={normalizeNationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className={fieldClass("national_id")}
              />
            </Field>
            <Field label="เพศ">
              <select name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="UNKNOWN">ไม่ระบุ</option>
                <option value="M">ชาย</option>
                <option value="F">หญิง</option>
                <option value="O">อื่น ๆ</option>
              </select>
            </Field>
            <Field label="เบอร์โทรศัพท์ส่วนตัว">
              <input
                name="phone"
                maxLength={20}
                inputMode="tel"
                placeholder="08xxxxxxxx"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>

            {/* Row 4: Birth date and Age side by side, aligned */}
            <Field label="วันเดือนปีเกิด">
              <input
                type="date"
                name="birth_date"
                value={birthDate}
                onChange={handleBirthDateChange}
                aria-label="วันเดือนปีเกิด"
                max={new Date().toISOString().split("T")[0]}
              />
            </Field>

            <Field label="อายุ (ปี)">
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
                    setCalculatedAgeText(`อายุประมาณ ${e.target.value} ปี (ประมาณ ${days.toLocaleString()} วัน)`);
                  } else {
                    setCalculatedAgeText("");
                  }
                }}
              />
            </Field>

            {calculatedAgeText && (
              <div className="field-wide">
                <div className="age-badge-notification" role="status">
                  <span className="badge-icon">ℹ️</span>
                  <span>{calculatedAgeText}</span>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {/* Block 2: อาการที่มารับบริการ (มีช้อยส์ติ๊กเลือก + พิมพ์เสริม) */}
        <fieldset>
          <legend>
            <span className="section-number">2</span>
            <span>อาการสำคัญที่มารับบริการ <b>*</b><small>แตะเลือกอาการที่ตรงกับคุณ หรือพิมพ์ระบุเพิ่มเติม</small></span>
          </legend>
          
          <div className="choice-chips-group" role="group" aria-label="ตัวเลือกอาการยอดนิยม">
            {SYMPTOM_OPTIONS.map((symptom) => {
              const isSelected = selectedSymptoms.includes(symptom);
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
            <span className="section-number">3</span>
            <span>ข้อมูลสุขภาพ & ประวัติแพ้ยา<small>แตะเลือกเพื่อความสะดวกรวดเร็ว</small></span>
          </legend>
          <div className="info-strip">สัญญาณชีพ (ความดัน, ชีพจร, ไข้) จะวัดที่จุดคัดกรองโดยเจ้าหน้าที่</div>

          <div className="form-grid three">
            <Field label="หมู่เลือด">
              <select name="blood_type" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
                <option value="UNKNOWN">ไม่ทราบ</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </Field>
            <Field label="ส่วนสูง">
              <SuffixInput
                name="height_cm"
                type="number"
                min={30}
                max={250}
                step="0.1"
                inputMode="decimal"
                placeholder="170"
                suffix="ซม."
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </Field>
            <Field label="น้ำหนัก">
              <SuffixInput
                name="weight_kg"
                type="number"
                min={1}
                max={400}
                step="0.1"
                inputMode="decimal"
                placeholder="65"
                suffix="กก."
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
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
            <input
              placeholder="โรคประจำตัวอื่น ๆ (หากมี)"
              value={customDisease}
              onChange={(e) => setCustomDisease(e.target.value)}
            />
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
                  className={`choice-chip ${selectedAllergies.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleAllergy(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              placeholder="ยาหรือสารที่แพ้อื่น ๆ (หากมี)"
              value={customAllergy}
              onChange={(e) => setCustomAllergy(e.target.value)}
            />
            <input type="hidden" name="allergies" value={finalAllergies} />
          </div>

          <Field label="ยาที่ใช้ประจำ" wide>
            <input
              name="medications"
              maxLength={1000}
              placeholder="ระบุชื่อยา (ถ้าทราบ เช่น ยาความดัน, ยาเบาหวาน)"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
            />
          </Field>
        </fieldset>

        {/* Block 4: ที่อยู่ (Dropdown 77 จังหวัด และเชื่อมโยง อำเภอ/ตำบล/รหัสไปรษณีย์) */}
        <fieldset>
          <legend>
            <span className="section-number">4</span>
            <span>ที่อยู่ปัจจุบัน<small>สำหรับระบุพื้นที่รับบริการ (เลือกจังหวัดเพื่อค้นหาอำเภอและตำบล)</small></span>
          </legend>
          <div className="form-grid">
            <Field label="จังหวัด">
              <select
                name="province"
                value={province}
                onChange={handleProvinceChange}
                autoComplete="address-level1"
                className={fieldClass("province")}
              >
                <option value="">-- เลือกจังหวัด (77 จังหวัด) --</option>
                {ALL_77_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="อำเภอ / เขต">
              <select
                name="district"
                value={district}
                onChange={handleDistrictChange}
                disabled={!province}
                autoComplete="address-level2"
                className={fieldClass("district")}
              >
                <option value="">
                  {province ? "-- เลือกอำเภอ / เขต --" : "-- กรุณาเลือกจังหวัดก่อน --"}
                </option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ตำบล / แขวง">
              <select
                name="subdistrict"
                value={subdistrict}
                onChange={handleSubdistrictChange}
                disabled={!district}
                autoComplete="address-level3"
                className={fieldClass("subdistrict")}
              >
                <option value="">
                  {district ? "-- เลือกตำบล / แขวง --" : "-- กรุณาเลือกอำเภอก่อน --"}
                </option>
                {subdistrictOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="รหัสไปรษณีย์">
              <input
                name="postal_code"
                maxLength={5}
                inputMode="numeric"
                pattern="[0-9]{5}"
                autoComplete="postal-code"
                placeholder="5 หลัก"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className={fieldClass("postal_code")}
              />
            </Field>
          </div>
        </fieldset>

        {/* Block 5: ผู้ติดต่อฉุกเฉิน (เพิ่มได้สูงสุด 3 คน/เบอร์) */}
        <fieldset>
          <legend>
            <span className="section-number">5</span>
            <span>ผู้ติดต่อฉุกเฉิน<small>ใช้ติดต่อกรณีจำเป็นเร่งด่วน (เพิ่มได้สูงสุด 3 รายการ)</small></span>
          </legend>
          
          <div className="emergency-contacts-wrapper">
            {emergencyContacts.map((contact, index) => (
              <div key={contact.id} className="emergency-entry-card">
                <div className="entry-header">
                  <span className="entry-tag">
                    ผู้ติดต่อฉุกเฉินคนที่ {index + 1} {index === 0 ? "(หลัก)" : ""}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      className="remove-entry-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeEmergencyContact(contact.id);
                      }}
                    >
                      ลบรายการ
                    </button>
                  )}
                </div>
                <div className="form-grid three">
                  <Field label="ชื่อผู้ติดต่อ">
                    <input
                      name={`emergency_name_${index + 1}`}
                      maxLength={120}
                      autoComplete={index === 0 ? "name" : undefined}
                      placeholder="ชื่อ-นามสกุล"
                      value={contact.name}
                      onChange={(e) => updateEmergencyContact(contact.id, "name", e.target.value)}
                    />
                  </Field>
                  <Field label="ความสัมพันธ์">
                    <select
                      name={`emergency_relationship_${index + 1}`}
                      value={contact.relationship}
                      onChange={(e) => updateEmergencyContact(contact.id, "relationship", e.target.value)}
                    >
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
                  <Field label="เบอร์โทรศัพท์">
                    <input
                      name={`emergency_phone_${index + 1}`}
                      maxLength={20}
                      inputMode="tel"
                      autoComplete={index === 0 ? "tel" : undefined}
                      placeholder="08xxxxxxxx"
                      value={contact.phone}
                      onChange={(e) => updateEmergencyContact(contact.id, "phone", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ))}

            {emergencyContacts.length < 3 && (
              <button
                type="button"
                className="add-emergency-btn"
                onClick={addEmergencyContact}
              >
                + เพิ่มผู้ติดต่อฉุกเฉิน ({emergencyContacts.length}/3)
              </button>
            )}
          </div>
        </fieldset>

        {/* PDPA Verified status and Consent */}
        <div className="pdpa-verified-box">
          <div className="pdpa-verified-badge">
            <span className="pdpa-check-icon">✓</span>
            <span>ยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) แล้ว</span>
          </div>
          <button
            type="button"
            className="pdpa-review-link"
            onClick={() => setShowPdpaReview(true)}
          >
            อ่านนโยบาย PDPA อีกครั้ง
          </button>
        </div>

        <label className="consent">
          <input name="consent" type="checkbox" defaultChecked required />
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
