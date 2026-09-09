import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { PatientProfile, ProfileUpdatePayload } from "@/shared/api/types";
import { ALL_77_PROVINCES, getDistricts, getPostalCode, getSubdistricts } from "@/shared/data/thai-address";
import { isValidThaiNationalId } from "@/shared/data/thai-id";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export const CHRONIC_OPTIONS = [
  "ไม่มีโรคประจำตัว",
  "ความดันโลหิตสูง",
  "เบาหวาน",
  "โรคหัวใจ",
  "โรคไต",
  "หอบหืด / ภูมิแพ้",
  "ไขมันในเลือดสูง",
];

export const ALLERGY_OPTIONS = [
  "ไม่มีประวัติแพ้ยา",
  "แพ้ยากลุ่มเพนิซิลลิน (Penicillin)",
  "แพ้ยาแก้ปวด (NSAIDs / แอสไพริน)",
  "แพ้ยาซัลฟา (Sulfa)",
  "แพ้อาหารทะเล",
];

export const MEDICATION_OPTIONS = [
  "ไม่มียาที่ใช้ประจำ",
  "ยาลดความดันโลหิต",
  "ยารักษาโรคเบาหวาน",
  "ยาลดไขมันในเลือด",
  "ยาโรคหัวใจ",
  "ยาละลายลิ่มเลือด / ต้านเกล็ดเลือด",
  "ยาพ่นหอบหืด / ยาภูมิแพ้",
  "ยาลดกรด / ยาโรคกระเพาะ",
  "ยาไทรอยด์",
];

export const PROFILE_DRAFT_KEY = "opd_patient_registration_draft_v1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const CURRENT_YEAR = new Date().getFullYear();
const DOB_YEARS = Array.from({ length: 121 }, (_, i) => CURRENT_YEAR - i);

function daysInMonth(month: string, year: string): number {
  const m = Number(month);
  if (!m) return 31;
  return new Date(Number(year) || 2000, m, 0).getDate();
}

type EmergencyContact = { id: string; name: string; relationship: string; phone: string };

/** Payload the form collects — a superset of ProfileUpdatePayload plus national_id. */
export interface PatientProfilePayload extends ProfileUpdatePayload {
  national_id: string;
}

export interface PatientProfileFormHandle {
  /** First blocking error, or null when the profile section is valid. Focuses/scrolls to the field. */
  validate(): { field: string; message: string } | null;
  getPayload(): PatientProfilePayload;
  clearDraft(): void;
  isDirty(): boolean;
}

interface PatientProfileFormProps {
  /** "register": part of the new-patient flow. "edit": inside the account edit modal. */
  mode: "register" | "edit";
  /** Present in register/booking mode — used to prefill from the existing profile when initialProfile is absent. */
  token?: string;
  /** In register mode, whether the user is already a known patient (locks the national ID). */
  hasToken?: boolean;
  /** When given, prefill from this instead of fetching. */
  initialProfile?: PatientProfile | null;
  /** When set, autosave/restore the section to localStorage under this key (guest onboarding only). */
  draftKey?: string;
  /** Rendered right after the personal-info fieldset (registration puts its symptom fieldset here). */
  children?: ReactNode;
  onUnauthorized?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function splitStored(value: string | null | undefined, options: string[]) {
  const items = (value || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    matched: items.filter((i) => options.includes(i)),
    custom: items.filter((i) => !options.includes(i)).join(", "),
  };
}

export const PatientProfileForm = forwardRef<PatientProfileFormHandle, PatientProfileFormProps>(
  function PatientProfileForm(
    { mode, token, hasToken, initialProfile, draftKey, children, onUnauthorized, onDirtyChange },
    ref,
  ) {
    const [invalidField, setInvalidField] = useState("");
    const [profileLoading, setProfileLoading] = useState<boolean>(Boolean(token && !initialProfile));
    const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [draftSavedTime, setDraftSavedTime] = useState("");

    // Block 1 — personal
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nationalId, setNationalId] = useState("");
    const [gender, setGender] = useState("UNKNOWN");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [birthDate, setBirthDate] = useState(""); // committed ISO YYYY-MM-DD (source of truth)
    const [dobDay, setDobDay] = useState("");
    const [dobMonth, setDobMonth] = useState(""); // "1".."12"
    const [dobYear, setDobYear] = useState(""); // CE year as string
    const [calculatedAgeText, setCalculatedAgeText] = useState("");
    const [ageYears, setAgeYears] = useState<number | string>("");

    // Block 3 — health
    const [bloodType, setBloodType] = useState("UNKNOWN");
    const [heightCm, setHeightCm] = useState("");
    const [weightKg, setWeightKg] = useState("");
    const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
    const [customDisease, setCustomDisease] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [customAllergy, setCustomAllergy] = useState("");
    const [selectedMedications, setSelectedMedications] = useState<string[]>([]);
    const [customMedication, setCustomMedication] = useState("");

    // Block 4 — address (77-province cascade)
    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [subdistrict, setSubdistrict] = useState("");
    const [postalCode, setPostalCode] = useState("");

    // Block 5 — emergency contacts (max 3, stable ids)
    const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
      { id: "em-initial-1", name: "", relationship: "", phone: "" },
    ]);

    function calculateAge(val: string) {
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
        days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      }
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      setAgeYears(years);
      setCalculatedAgeText(`อายุ: ${years} ปี ${months} เดือน ${days} วัน`);
    }

    /** Fold the three DOB selects into the committed ISO value + recompute age. */
    function commitDob(day: string, month: string, year: string) {
      if (day && month && year) {
        const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        setBirthDate(iso);
        calculateAge(iso);
      } else {
        setBirthDate("");
        calculateAge("");
      }
    }

    function changeDobPart(part: "day" | "month" | "year", value: string) {
      let d = part === "day" ? value : dobDay;
      const m = part === "month" ? value : dobMonth;
      const y = part === "year" ? value : dobYear;
      // Keep the day valid when month/year shrinks it (e.g. 31 -> Feb).
      const max = daysInMonth(m, y);
      if (d && Number(d) > max) d = String(max);
      setDobDay(d);
      setDobMonth(m);
      setDobYear(y);
      commitDob(d, m, y);
    }

    function applyProfile(p: PatientProfile) {
      if (p.first_name) setFirstName(p.first_name);
      if (p.last_name) setLastName(p.last_name);

      let savedRawId = "";
      try {
        savedRawId = sessionStorage.getItem("patient_national_id") || localStorage.getItem("patient_national_id") || "";
      } catch {
        // ignore
      }
      const cleanSaved = savedRawId.replace(/\D/g, "");
      const cleanP = p.national_id ? p.national_id.replace(/\D/g, "") : "";
      if (cleanP.length === 13) {
        setNationalId(cleanP);
        try {
          sessionStorage.setItem("patient_national_id", cleanP);
          localStorage.setItem("patient_national_id", cleanP);
        } catch {
          // ignore
        }
      } else if (cleanSaved.length === 13) {
        setNationalId(cleanSaved);
      }

      if (p.gender) setGender(p.gender);
      if (p.phone) setPhone(p.phone);
      if (p.email) setEmail(p.email);
      if (p.birth_date) {
        const [y, m, d] = p.birth_date.split("-");
        if (y && m && d) {
          setDobYear(y);
          setDobMonth(String(Number(m)));
          setDobDay(String(Number(d)));
        }
        setBirthDate(p.birth_date);
        calculateAge(p.birth_date);
      } else if (p.age) {
        setAgeYears(p.age);
        setCalculatedAgeText(`อายุ: ${p.age} ปี`);
      }
      if (p.blood_type) setBloodType(p.blood_type);
      if (p.height_cm) setHeightCm(String(p.height_cm));
      if (p.weight_kg) setWeightKg(String(p.weight_kg));

      const chronic = splitStored(p.chronic_diseases, CHRONIC_OPTIONS);
      if (chronic.matched.length) setSelectedDiseases(chronic.matched);
      if (chronic.custom) setCustomDisease(chronic.custom);
      const allergy = splitStored(p.allergies, ALLERGY_OPTIONS);
      if (allergy.matched.length) setSelectedAllergies(allergy.matched);
      if (allergy.custom) setCustomAllergy(allergy.custom);
      const meds = splitStored(p.medications, MEDICATION_OPTIONS);
      if (meds.matched.length) setSelectedMedications(meds.matched);
      if (meds.custom) setCustomMedication(meds.custom);

      const withAddr = p as PatientProfile & {
        province?: string; district?: string; subdistrict?: string; postal_code?: string; emergency_relationship?: string;
      };
      const prov = withAddr.province || (p.address ? ALL_77_PROVINCES.find((pv) => p.address?.includes(pv)) : "");
      if (prov) {
        setProvince(prov);
        const dist = withAddr.district || (p.address ? getDistricts(prov).find((d) => p.address?.includes(d)) : "");
        if (dist) {
          setDistrict(dist);
          const sub = withAddr.subdistrict || (p.address ? getSubdistricts(prov, dist).find((s) => p.address?.includes(s)) : "");
          if (sub) {
            setSubdistrict(sub);
            const post = withAddr.postal_code || (p.address ? getPostalCode(prov, dist, sub) : "");
            if (post) setPostalCode(post);
          }
        }
      }

      if (p.emergency_contacts && p.emergency_contacts.length > 0) {
        setEmergencyContacts(
          p.emergency_contacts.map((c, i) => ({
            id: c.id || `em-prof-${i}`,
            name: c.name || "",
            relationship: c.relationship || "",
            phone: c.phone || "",
          })),
        );
      } else if (p.emergency_name || p.emergency_phone) {
        setEmergencyContacts([
          {
            id: "em-initial-1",
            name: p.emergency_name || "",
            relationship: withAddr.emergency_relationship || "",
            phone: p.emergency_phone || "",
          },
        ]);
      }
      setHasLoadedProfile(true);
    }

    // Prefill from initialProfile, or fetch it when only a token is available.
    useEffect(() => {
      if (initialProfile) {
        applyProfile(initialProfile);
        return;
      }
      if (!token) return;
      let active = true;
      setProfileLoading(true);
      patientApi
        .account(token)
        .then((data) => {
          if (active && data.profile) applyProfile(data.profile);
        })
        .catch((err) => {
          if (!active) return;
          const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : "");
          if (apiErr.status === 401) onUnauthorized?.();
        })
        .finally(() => {
          if (active) setProfileLoading(false);
        });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, initialProfile, onUnauthorized]);

    // Restore draft (guest onboarding only)
    useEffect(() => {
      if (!draftKey) return;
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (!d || typeof d !== "object") return;
        if (d.firstName) setFirstName(d.firstName);
        if (d.lastName) setLastName(d.lastName);
        if (d.nationalId) setNationalId(d.nationalId);
        if (d.gender) setGender(d.gender);
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
        if (typeof d.birthDate === "string" && d.birthDate) {
          const [y, m, dd] = d.birthDate.split("-");
          if (y && m && dd) {
            setDobYear(y);
            setDobMonth(String(Number(m)));
            setDobDay(String(Number(dd)));
          }
          setBirthDate(d.birthDate);
        }
        if (d.ageYears !== undefined && d.ageYears !== "") setAgeYears(d.ageYears);
        if (d.calculatedAgeText) setCalculatedAgeText(d.calculatedAgeText);
        if (d.bloodType) setBloodType(d.bloodType);
        if (d.heightCm) setHeightCm(d.heightCm);
        if (d.weightKg) setWeightKg(d.weightKg);
        if (Array.isArray(d.selectedDiseases)) setSelectedDiseases(d.selectedDiseases);
        if (d.customDisease) setCustomDisease(d.customDisease);
        if (Array.isArray(d.selectedAllergies)) setSelectedAllergies(d.selectedAllergies);
        if (d.customAllergy) setCustomAllergy(d.customAllergy);
        if (Array.isArray(d.selectedMedications)) setSelectedMedications(d.selectedMedications);
        if (d.customMedication) setCustomMedication(d.customMedication);
        if (d.province) setProvince(d.province);
        if (d.district) setDistrict(d.district);
        if (d.subdistrict) setSubdistrict(d.subdistrict);
        if (d.postalCode) setPostalCode(d.postalCode);
        if (Array.isArray(d.emergencyContacts) && d.emergencyContacts.length > 0) setEmergencyContacts(d.emergencyContacts);
        if (d.savedAt) setDraftSavedTime(d.savedAt);
        setHasRestoredDraft(true);
      } catch {
        // ignore
      }
    }, [draftKey]);

    const finalDiseases = [...selectedDiseases, customDisease.trim()].filter(Boolean).join(", ");
    const finalAllergies = [...selectedAllergies, customAllergy.trim()].filter(Boolean).join(", ");
    const finalMedications = [...selectedMedications, customMedication.trim()].filter(Boolean).join(", ");

    const dirty = Boolean(
      firstName.trim() || lastName.trim() || nationalId.trim() || phone.trim() || email.trim() || birthDate.trim() ||
      heightCm.trim() || weightKg.trim() || selectedDiseases.length || customDisease.trim() ||
      selectedAllergies.length || customAllergy.trim() || selectedMedications.length || customMedication.trim() ||
      province.trim() || district.trim() || subdistrict.trim() || postalCode.trim() ||
      emergencyContacts.some((c) => c.name.trim() || c.phone.trim()),
    );

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // Autosave draft
    useEffect(() => {
      if (!draftKey || !dirty) return;
      const timer = setTimeout(() => {
        const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              firstName, lastName, nationalId, gender, phone, email, birthDate, ageYears, calculatedAgeText,
              bloodType, heightCm, weightKg, selectedDiseases, customDisease, selectedAllergies, customAllergy,
              selectedMedications, customMedication, province, district, subdistrict, postalCode, emergencyContacts,
              savedAt: now,
            }),
          );
          setDraftSavedTime(now);
        } catch {
          // ignore quota errors
        }
      }, 500);
      return () => clearTimeout(timer);
    }, [
      draftKey, dirty, firstName, lastName, nationalId, gender, phone, email, birthDate, ageYears, calculatedAgeText,
      bloodType, heightCm, weightKg, selectedDiseases, customDisease, selectedAllergies, customAllergy,
      selectedMedications, customMedication, province, district, subdistrict, postalCode, emergencyContacts,
    ]);

    function clearDraft() {
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
      }
      setFirstName("");
      setLastName("");
      setNationalId("");
      setGender("UNKNOWN");
      setPhone("");
      setEmail("");
      setBirthDate("");
      setDobDay("");
      setDobMonth("");
      setDobYear("");
      setAgeYears("");
      setCalculatedAgeText("");
      setBloodType("UNKNOWN");
      setHeightCm("");
      setWeightKg("");
      setSelectedDiseases([]);
      setCustomDisease("");
      setSelectedAllergies([]);
      setCustomAllergy("");
      setSelectedMedications([]);
      setCustomMedication("");
      setProvince("");
      setDistrict("");
      setSubdistrict("");
      setPostalCode("");
      setEmergencyContacts([{ id: "em-initial-1", name: "", relationship: "", phone: "" }]);
      setHasRestoredDraft(false);
      setDraftSavedTime("");
    }

    function getPayload(): PatientProfilePayload {
      const contacts = emergencyContacts.filter((c) => c.name.trim() || c.phone.trim());
      const primary = contacts[0];
      const addressText = [subdistrict, district, province, postalCode].filter(Boolean).join(" ") || null;
      return {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        national_id: nationalId.replace(/\D/g, ""),
        gender,
        phone: phone.trim() || null,
        email: email.trim().toLowerCase() || null,
        birth_date: birthDate || null,
        age: ageYears === "" ? null : Number(ageYears),
        blood_type: bloodType,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        chronic_diseases: finalDiseases || null,
        allergies: finalAllergies || null,
        medications: finalMedications || null,
        province: province || null,
        district: district || null,
        subdistrict: subdistrict || null,
        postal_code: postalCode || null,
        address: addressText,
        emergency_name: primary?.name.trim() || null,
        emergency_relationship: contacts.find((c) => c.relationship)?.relationship || null,
        emergency_phone: primary?.phone.trim() || null,
        emergency_contacts: contacts.map((c) => ({
          id: c.id,
          name: c.name.trim(),
          relationship: c.relationship || undefined,
          phone: c.phone.trim(),
        })),
      };
    }

    function focusName(name: string) {
      const el = document.querySelector<HTMLElement>(`[name="${name}"]`);
      el?.focus();
    }
    function scrollToGroup(id: string) {
      document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }

    function validate(): { field: string; message: string } | null {
      // Edit mode is a partial patch of an existing record: the national ID is
      // read-only, and the health fields that are mandatory at registration are
      // left optional here.
      if (mode === "edit") {
        setInvalidField("");
        if (email.trim() && !EMAIL_RE.test(email.trim())) {
          setInvalidField("email");
          focusName("email");
          return { field: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" };
        }
        return null;
      }
      if (!isValidThaiNationalId(nationalId.replace(/\D/g, ""))) {
        setInvalidField("national_id");
        focusName("national_id");
        return { field: "national_id", message: "กรุณาระบุเลขประจำตัวประชาชนให้ถูกต้องและครบ 13 หลัก" };
      }
      if (phone.replace(/\D/g, "").length < 9) {
        setInvalidField("phone");
        focusName("phone");
        return { field: "phone", message: "กรุณาระบุเบอร์โทรศัพท์ให้ครบถ้วน" };
      }
      if (!EMAIL_RE.test(email.trim())) {
        setInvalidField("email");
        focusName("email");
        return { field: "email", message: "กรุณาระบุอีเมลที่ถูกต้อง (เช่น patient@example.com)" };
      }
      if (!finalDiseases) {
        setInvalidField("chronic_diseases");
        scrollToGroup("field-group-chronic");
        return { field: "chronic_diseases", message: "กรุณาระบุข้อมูลโรคประจำตัว หรือเลือก 'ไม่มีโรคประจำตัว'" };
      }
      if (!finalAllergies) {
        setInvalidField("allergies");
        scrollToGroup("field-group-allergies");
        return { field: "allergies", message: "กรุณาระบุประวัติแพ้ยาและอาหาร หรือเลือก 'ไม่มีประวัติแพ้ยา'" };
      }
      if (!finalMedications) {
        setInvalidField("medications");
        scrollToGroup("field-group-medications");
        return { field: "medications", message: "กรุณาระบุข้อมูลยาที่ใช้ประจำ หรือเลือก 'ไม่มียาที่ใช้ประจำ'" };
      }
      setInvalidField("");
      return null;
    }

    useImperativeHandle(ref, () => ({ validate, getPayload, clearDraft, isDirty: () => dirty }));

    const districtOptions = province ? getDistricts(province) : [];
    const subdistrictOptions = province && district ? getSubdistricts(province, district) : [];
    const fieldClass = (name: string) => (invalidField === name ? "invalid" : "");
    // National ID is not editable from the account edit modal, and is locked once
    // it has been pulled from a known patient record.
    const idLocked = mode === "edit" || Boolean(hasToken && nationalId.length === 13 && !nationalId.includes("x"));

    function toggleChip(
      item: string,
      noneLabel: string,
      list: string[],
      setList: (v: string[]) => void,
      clearName: string,
    ) {
      if (invalidField === clearName) setInvalidField("");
      if (item === noneLabel) {
        setList([noneLabel]);
        return;
      }
      const filtered = list.filter((x) => x !== noneLabel);
      setList(filtered.includes(item) ? filtered.filter((x) => x !== item) : [...filtered, item]);
    }

    function updateContact(id: string, field: "name" | "relationship" | "phone", value: string) {
      setEmergencyContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    }

    if (profileLoading) {
      return (
        <LoadingScreen
          title="กำลังดึงข้อมูลผู้ป่วย"
          subtitle="กรุณารอสักครู่ ระบบกำลังโหลดประวัติส่วนบุคคลเพื่อความสะดวกในการจองคิว"
        />
      );
    }

    return (
      <>
        {mode === "register" && hasToken && hasLoadedProfile && (
          <div
            className="profile-prefilled-banner"
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
              border: "1px solid #6ee7b7", color: "#065f46", padding: "14px 18px",
              borderRadius: "var(--radius-md, 8px)", marginBottom: "20px", fontSize: "0.95rem",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.08)",
            }}
          >
            <span style={{ fontSize: "1.5rem" }} aria-hidden="true">📋</span>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", color: "#064e3b" }}>
                ดึงข้อมูลผู้ป่วยเดิมให้อัตโนมัติเรียบร้อยแล้ว
              </strong>
              <span>คุณเพียงแค่ระบุ <u>อาการสำคัญที่มารับบริการ</u> ในข้อ 2 แล้วกดยืนยันเพื่อรับบัตรคิวได้ทันที</span>
            </div>
          </div>
        )}

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

        {/* Block 1: ข้อมูลระบุตัวตนผู้ป่วย */}
        <fieldset>
          <legend>
            <span className="section-number">1</span>
            <span>ข้อมูลส่วนบุคคล<small>ระบุชื่อและข้อมูลสำหรับติดต่อ</small></span>
          </legend>
          <div className="form-grid">
            <Field label="ชื่อ" required>
              <input
                name="first_name" maxLength={100} required placeholder="เช่น สมชาย" autoComplete="given-name"
                value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass("first_name")}
              />
            </Field>
            <Field label="นามสกุล" required>
              <input
                name="last_name" maxLength={100} required placeholder="เช่น ใจดี" autoComplete="family-name"
                value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass("last_name")}
              />
            </Field>
            <Field
              label="เลขประจำตัวประชาชน" required wide
              help={idLocked ? "ดึงจากบัญชีผู้ป่วยของคุณอัตโนมัติ" : "กรอกตัวเลข 13 หลักโดยไม่ต้องใส่เครื่องหมายขีด"}
            >
              <input
                name="national_id" maxLength={13} minLength={13} inputMode="numeric" pattern="[0-9]{13}" required
                placeholder="ตัวเลข 13 หลัก ไม่ต้องใส่ขีด" value={nationalId} readOnly={idLocked}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 13);
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setNationalId(val);
                  if (invalidField === "national_id") setInvalidField("");
                  if (val.length === 13) {
                    try {
                      sessionStorage.setItem("patient_national_id", val);
                      localStorage.setItem("patient_national_id", val);
                    } catch {
                      // ignore
                    }
                  }
                }}
                className={`${fieldClass("national_id")} ${idLocked ? "readonly-field" : ""}`}
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
            <Field label="เบอร์โทรศัพท์" required={mode === "register"}>
              <input
                name="phone" maxLength={20} inputMode="tel" placeholder="08xxxxxxxx" autoComplete="tel"
                required={mode === "register"}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (invalidField === "phone") setInvalidField("");
                }}
                className={fieldClass("phone")}
              />
            </Field>
            <Field
              label="อีเมล"
              required={mode === "register"}
              wide
              help="ใช้ยืนยันตัวตนและกู้คืนรหัส (ต้องยืนยันอีเมลตอนสมัคร)"
            >
              <input
                name="email" type="email" maxLength={190} placeholder="patient@example.com" autoComplete="email"
                required={mode === "register"}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (invalidField === "email") setInvalidField("");
                }}
                className={fieldClass("email")}
              />
            </Field>
            <label className="field">
              <span>วัน/เดือน/ปีเกิด</span>
              <div className="dob-select-row">
                <select
                  aria-label="วันเกิด" value={dobDay}
                  onChange={(e) => changeDobPart("day", e.target.value)}
                >
                  <option value="">วัน</option>
                  {Array.from({ length: daysInMonth(dobMonth, dobYear) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  aria-label="เดือนเกิด" value={dobMonth}
                  onChange={(e) => changeDobPart("month", e.target.value)}
                >
                  <option value="">เดือน</option>
                  {THAI_MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  aria-label="ปีเกิด (พ.ศ.)" value={dobYear}
                  onChange={(e) => changeDobPart("year", e.target.value)}
                >
                  <option value="">ปี พ.ศ.</option>
                  {DOB_YEARS.map((y) => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </div>
              <input type="hidden" name="birth_date" value={birthDate} />
            </label>
            <Field label="อายุ (ปี)">
              <SuffixInput
                name="age" type="number" min={0} max={130} inputMode="numeric" placeholder="0" suffix="ปี"
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

        {children}

        {/* Block 3: ข้อมูลสุขภาพ */}
        <fieldset>
          <legend>
            <span className="section-number">3</span>
            <span>ข้อมูลสุขภาพและประวัติการแพ้<small>ข้อมูลเบื้องต้นเพื่อความปลอดภัยในการตรวจรักษา</small></span>
          </legend>
          <div className="info-strip">สัญญาณชีพ (ความดันโลหิต ชีพจร อุณหภูมิ) จะได้รับการตรวจวัด ณ จุดคัดกรอง</div>

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
                name="height_cm" type="number" min={30} max={250} step="0.1" inputMode="decimal"
                placeholder="170" suffix="ซม." value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
              />
            </Field>
            <Field label="น้ำหนัก">
              <SuffixInput
                name="weight_kg" type="number" min={1} max={400} step="0.1" inputMode="decimal"
                placeholder="65" suffix="กก." value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
              />
            </Field>
          </div>

          <div id="field-group-chronic" className={`field-group-spacing ${invalidField === "chronic_diseases" ? "field-group-invalid" : ""}`}>
            <span className="field-group-title">
              โรคประจำตัว <b>*</b>
              <small className="field-group-subtitle">กรุณาเลือกอย่างน้อย 1 รายการ หรือระบุเพิ่มเติม (หากไม่มี ให้เลือก &quot;ไม่มีโรคประจำตัว&quot;)</small>
            </span>
            <div className="choice-chips-group">
              {CHRONIC_OPTIONS.map((item) => (
                <button
                  type="button" key={item}
                  className={`choice-chip ${selectedDiseases.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleChip(item, "ไม่มีโรคประจำตัว", selectedDiseases, setSelectedDiseases, "chronic_diseases")}
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              placeholder="ระบุโรคประจำตัวอื่น ๆ (หากมี)" value={customDisease}
              onChange={(e) => {
                setCustomDisease(e.target.value);
                if (invalidField === "chronic_diseases") setInvalidField("");
              }}
            />
            <input type="hidden" name="chronic_diseases" value={finalDiseases} />
          </div>

          <div id="field-group-allergies" className={`field-group-spacing ${invalidField === "allergies" ? "field-group-invalid" : ""}`}>
            <span className="field-group-title">
              ประวัติแพ้ยาและอาหาร <b>*</b>
              <small className="field-group-subtitle">กรุณาเลือกอย่างน้อย 1 รายการ หรือระบุเพิ่มเติม (หากไม่มี ให้เลือก &quot;ไม่มีประวัติแพ้ยา&quot;)</small>
            </span>
            <div className="choice-chips-group">
              {ALLERGY_OPTIONS.map((item) => (
                <button
                  type="button" key={item}
                  className={`choice-chip ${selectedAllergies.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleChip(item, "ไม่มีประวัติแพ้ยา", selectedAllergies, setSelectedAllergies, "allergies")}
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              placeholder="ระบุยาหรือสารที่แพ้อื่น ๆ (หากมี)" value={customAllergy}
              onChange={(e) => {
                setCustomAllergy(e.target.value);
                if (invalidField === "allergies") setInvalidField("");
              }}
            />
            <input type="hidden" name="allergies" value={finalAllergies} />
          </div>

          <div id="field-group-medications" className={`field-group-spacing ${invalidField === "medications" ? "field-group-invalid" : ""}`}>
            <span className="field-group-title">
              ยาที่ใช้ประจำ <b>*</b>
              <small className="field-group-subtitle">กรุณาเลือกอย่างน้อย 1 รายการ หรือระบุเพิ่มเติม (หากไม่มี ให้เลือก &quot;ไม่มียาที่ใช้ประจำ&quot;)</small>
            </span>
            <div className="choice-chips-group">
              {MEDICATION_OPTIONS.map((item) => (
                <button
                  type="button" key={item}
                  className={`choice-chip ${selectedMedications.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleChip(item, "ไม่มียาที่ใช้ประจำ", selectedMedications, setSelectedMedications, "medications")}
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              placeholder="ระบุชื่อยาอื่น ๆ หรือรายละเอียดเพิ่มเติม (หากมี เช่น ขนาดยา วิธีรับประทาน)" value={customMedication}
              onChange={(e) => {
                setCustomMedication(e.target.value);
                if (invalidField === "medications") setInvalidField("");
              }}
            />
            <input type="hidden" name="medications" value={finalMedications} />
          </div>
        </fieldset>

        {/* Block 4: ที่อยู่ */}
        <fieldset>
          <legend>
            <span className="section-number">4</span>
            <span>ที่อยู่ปัจจุบัน<small>ระบุที่อยู่เพื่อการติดต่อและบันทึกประวัติการรักษา</small></span>
          </legend>
          <div className="form-grid">
            <Field label="จังหวัด">
              <select
                name="province" value={province} autoComplete="address-level1" className={fieldClass("province")}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict("");
                  setSubdistrict("");
                  setPostalCode("");
                }}
              >
                <option value="">-- เลือกจังหวัด (77 จังหวัด) --</option>
                {ALL_77_PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="อำเภอ / เขต">
              <select
                name="district" value={district} disabled={!province} autoComplete="address-level2" className={fieldClass("district")}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setSubdistrict("");
                  setPostalCode("");
                }}
              >
                <option value="">{province ? "-- เลือกอำเภอ / เขต --" : "-- กรุณาเลือกจังหวัดก่อน --"}</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="ตำบล / แขวง">
              <select
                name="subdistrict" value={subdistrict} disabled={!district} autoComplete="address-level3" className={fieldClass("subdistrict")}
                onChange={(e) => {
                  const val = e.target.value;
                  setSubdistrict(val);
                  if (val && province && district) {
                    const code = getPostalCode(province, district, val);
                    if (code) setPostalCode(code);
                  }
                }}
              >
                <option value="">{district ? "-- เลือกตำบล / แขวง --" : "-- กรุณาเลือกอำเภอก่อน --"}</option>
                {subdistrictOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="รหัสไปรษณีย์">
              <input
                name="postal_code" maxLength={5} inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code"
                placeholder="5 หลัก" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={fieldClass("postal_code")}
              />
            </Field>
          </div>
        </fieldset>

        {/* Block 5: ผู้ติดต่อฉุกเฉิน */}
        <fieldset>
          <legend>
            <span className="section-number">5</span>
            <span>ผู้ติดต่อฉุกเฉิน<small>ข้อมูลบุคคลที่สามารถติดต่อได้ในกรณีจำเป็นเร่งด่วน (สูงสุด 3 ท่าน)</small></span>
          </legend>
          <div className="emergency-contacts-wrapper">
            {emergencyContacts.map((contact, index) => (
              <div key={contact.id} className="emergency-entry-card">
                <div className="entry-header">
                  <span className="entry-tag">
                    ผู้ติดต่อฉุกเฉินท่านที่ {index + 1} {index === 0 ? "(หลัก)" : ""}
                  </span>
                  {index > 0 && (
                    <button
                      type="button" className="remove-entry-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEmergencyContacts((prev) => prev.filter((c) => c.id !== contact.id));
                      }}
                    >
                      ลบรายการ
                    </button>
                  )}
                </div>
                <div className="form-grid three">
                  <Field label="ชื่อผู้ติดต่อ">
                    <input
                      name={`emergency_name_${index + 1}`} maxLength={120} autoComplete={index === 0 ? "name" : undefined}
                      placeholder="ชื่อ-นามสกุล" value={contact.name}
                      onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                    />
                  </Field>
                  <Field label="ความสัมพันธ์">
                    <select
                      name={`emergency_relationship_${index + 1}`} value={contact.relationship}
                      onChange={(e) => updateContact(contact.id, "relationship", e.target.value)}
                    >
                      <option value="">-- เลือก --</option>
                      <option value="FATHER">บิดา</option>
                      <option value="MOTHER">มารดา</option>
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
                      name={`emergency_phone_${index + 1}`} maxLength={20} inputMode="tel"
                      autoComplete={index === 0 ? "tel" : undefined} placeholder="08xxxxxxxx" value={contact.phone}
                      onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ))}
            {emergencyContacts.length < 3 && (
              <button
                type="button" className="add-emergency-btn"
                onClick={() =>
                  setEmergencyContacts((prev) => [
                    ...prev,
                    { id: `em-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name: "", relationship: "", phone: "" },
                  ])
                }
              >
                + เพิ่มผู้ติดต่อฉุกเฉิน ({emergencyContacts.length}/3)
              </button>
            )}
          </div>
        </fieldset>
      </>
    );
  },
);

function Field({
  label, required, wide, help, children,
}: { label: string; required?: boolean; wide?: boolean; help?: string; children: ReactNode }) {
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
