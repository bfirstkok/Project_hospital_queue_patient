import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

interface AccountViewProps {
  token: string;
  onQueue: () => void;
  onLogout: () => void;
  onUnauthorized: () => void;
}

type AccountTab = "profile" | "health" | "appointments" | "visits";

const dash = (value: unknown) => (value === null || value === undefined || value === "" ? "–" : String(value));
const thaiDate = (value?: string | null, includeTime = true) =>
  value
    ? new Intl.DateTimeFormat("th-TH", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "–";

function downloadIcsCalendar(appointment: Appointment) {
  const dateParts = appointment.date.split("-");
  if (dateParts.length < 3) return;
  const [year, month, day] = dateParts;
  const time = appointment.time ? appointment.time.replace(/[^0-9]/g, "").slice(0, 4) : "0900";
  const startDt = `${year}${month}${day}T${time.padEnd(4, "0")}00`;
  const endDt = `${year}${month}${day}T${(Number(time.slice(0, 2) || 9) + 1).toString().padStart(2, "0")}${time.slice(2, 4) || "00"}00`;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hospital Queue Patient Portal//TH",
    "BEGIN:VEVENT",
    `SUMMARY:นัดหมายพบแพทย์ - โรงพยาบาล (${appointment.status_label || "ตรวจติดตาม"})`,
    `DESCRIPTION:นัดหมายตรวจติดตามอาการ: ${appointment.note || "กรุณานำใบนัดและยาเดิมมาด้วย"}`,
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    "LOCATION:แผนกผู้ป่วยนอก (OPD) โรงพยาบาล",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `นัดหมายแพทย์-${appointment.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

interface EmergencyContactItem {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export function AccountView({
  token,
  onQueue,
  onLogout,
  onUnauthorized,
}: AccountViewProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Edit form state
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editGender, setEditGender] = useState("UNKNOWN");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBloodType, setEditBloodType] = useState("UNKNOWN");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editChronic, setEditChronic] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editMeds, setEditMeds] = useState("");
  const [editEmergencyContacts, setEditEmergencyContacts] = useState<EmergencyContactItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      patientApi.account(token),
      patientApi.queue(token),
    ])
      .then(([accountRes, queueRes]) => {
        if (!active) return;
        if (accountRes.status === "rejected") {
          const error = accountRes.reason;
          const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลบัญชีได้");
          if (apiError.status === 401) onUnauthorized();
          else setMessage(apiError.message);
          return;
        }

        const data = accountRes.value;
        const cancelledQueue = typeof window !== "undefined" ? sessionStorage.getItem("opd_cancelled_queue_number") : null;

        if (queueRes.status === "fulfilled" && queueRes.value && queueRes.value.queue_number) {
          const liveQ = queueRes.value;
          if (cancelledQueue && liveQ.queue_number === cancelledQueue) {
            data.active_queue = null;
          } else {
            data.active_queue = {
              ok: true,
              queue_number: liveQ.queue_number,
              status_label: liveQ.status_label || "รอตรวจ",
              instruction: liveQ.instruction || "กรุณารอเรียกตรวจตามลำดับ",
              queue_position: liveQ.queue_position ?? null,
              room: liveQ.room || null,
              updated_at: liveQ.updated_at || new Date().toISOString(),
            };
          }
        } else if (cancelledQueue && data.active_queue?.queue_number === cancelledQueue) {
          data.active_queue = null;
        } else if (queueRes.status === "fulfilled" && (!queueRes.value || !queueRes.value.queue_number)) {
          // If queue API explicitly returns empty queue (no queue today), clear active_queue
          data.active_queue = null;
        }

        setAccount(data);
      })
      .catch((error) => {
        if (!active) return;
        const apiError = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลบัญชีได้");
        if (apiError.status === 401) onUnauthorized();
        else setMessage(apiError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, onUnauthorized]);

  function initEditForm(p?: PatientProfile) {
    if (!p) return;
    setEditFirstName(p.first_name || "");
    setEditLastName(p.last_name || "");
    setEditGender(p.gender || "UNKNOWN");
    setEditBirthDate(p.birth_date || "");
    setEditAge(p.age ? String(p.age) : "");
    setEditPhone(p.phone || "");
    setEditBloodType(p.blood_type || "UNKNOWN");
    setEditHeightCm(p.height_cm ? String(p.height_cm) : "");
    setEditWeightKg(p.weight_kg ? String(p.weight_kg) : "");
    setEditAddress(p.address || "");
    setEditChronic(p.chronic_diseases || "");
    setEditAllergies(p.allergies || "");
    setEditMeds(p.medications || "");

    const contacts = (p.emergency_contacts && p.emergency_contacts.length > 0)
      ? p.emergency_contacts.map((c: { id?: string; name: string; relationship?: string; phone: string }) => ({
          id: c.id || Math.random().toString(),
          name: c.name || "",
          relationship: c.relationship || "",
          phone: c.phone || "",
        }))
      : [{ id: "c1", name: p.emergency_name || "", relationship: "", phone: p.emergency_phone || "" }];
    setEditEmergencyContacts(contacts);
  }

  function handleBirthDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEditBirthDate(val);
    if (!val) {
      setEditAge("");
      return;
    }
    const birth = new Date(val);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      years--;
    }
    setEditAge(String(Math.max(0, years)));
  }

  function addEmergencyContact() {
    if (editEmergencyContacts.length >= 3) return;
    setEditEmergencyContacts([
      ...editEmergencyContacts,
      { id: Date.now().toString(), name: "", relationship: "", phone: "" },
    ]);
  }

  function removeEmergencyContact(id: string) {
    if (editEmergencyContacts.length <= 1) return;
    setEditEmergencyContacts(editEmergencyContacts.filter((c) => c.id !== id));
  }

  function updateEmergencyContact(id: string, field: keyof EmergencyContactItem, value: string) {
    setEditEmergencyContacts(
      editEmergencyContacts.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;

    const primaryContact = editEmergencyContacts[0] || { name: "", relationship: "", phone: "" };

    // Update local profile state
    const updatedProfile: PatientProfile = {
      ...account.profile,
      first_name: editFirstName.trim() || account.profile.first_name,
      last_name: editLastName.trim() || account.profile.last_name,
      gender: editGender,
      birth_date: editBirthDate || null,
      age: editAge ? Number(editAge) : null,
      phone: editPhone.trim() || null,
      blood_type: editBloodType,
      height_cm: editHeightCm ? Number(editHeightCm) : null,
      weight_kg: editWeightKg ? Number(editWeightKg) : null,
      address: editAddress.trim() || null,
      chronic_diseases: editChronic.trim() || null,
      allergies: editAllergies.trim() || null,
      medications: editMeds.trim() || null,
      emergency_name: primaryContact.name.trim() || null,
      emergency_phone: primaryContact.phone.trim() || null,
      emergency_contacts: editEmergencyContacts.filter((c) => c.name.trim() || c.phone.trim()),
    };

    setAccount({
      ...account,
      profile: updatedProfile,
    });

    setIsEditing(false);
    setSaveSuccessMsg("บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว");
    setTimeout(() => setSaveSuccessMsg(""), 4000);
  }

  const profile = account?.profile;

  if (loading && !account) {
    return (
      <section id="accountView" className="page-shell account-view">
        <LoadingScreen
          title="กำลังโหลด"
          subtitle="กรุณารอสักครู่ ระบบกำลังดึงประวัติการรักษาและนัดหมายของคุณ"
        />
      </section>
    );
  }

  return (
    <section id="accountView" className="page-shell account-view">
      {/* Profile Header Banner */}
      <div className="account-heading">
        <div>
          <p className="eyebrow">บัตรประจำตัวและประวัติผู้ป่วย OPD</p>
          <h1>{profile ? `${profile.first_name} ${profile.last_name}` : "ข้อมูลผู้ป่วย"}</h1>
          <p>HN: <strong>{dash(profile?.hn)}</strong> · เลขประจำตัว ปชช.: <strong>{dash(profile?.national_id)}</strong></p>
        </div>
        <div className="account-heading-actions">
          <button className="secondary-button compact-button" type="button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      {message && <div className="alert" role="alert">{message}</div>}
      {saveSuccessMsg && <div className="success-banner" role="status">✓ {saveSuccessMsg}</div>}

      {/* Active Queue Card if any */}
      {account?.active_queue && (
        <section className="account-card queue-summary" aria-labelledby="accountQueueTitle">
          <div className="card-heading">
            <div>
              <span className="section-number">!</span>
              <h2 id="accountQueueTitle">คิวที่กำลังรับบริการวันนี้</h2>
            </div>
            <button className="text-button" type="button" onClick={onQueue}>
              ดูสถานะคิวสด →
            </button>
          </div>
          <div className="queue-overview">
            <strong>{account.active_queue.queue_number}</strong>
            <div>
              <b>{account.active_queue.status_label}</b>
              <p>{account.active_queue.instruction}{account.active_queue.room ? ` · ${account.active_queue.room}` : ""}</p>
            </div>
          </div>
        </section>
      )}

      {/* Unified Section Tabs */}
      <div className="account-section-tabs" role="tablist" aria-label="หมวดหมู่ข้อมูล">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`account-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          👤 ข้อมูลผู้ป่วย & สุขภาพ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "appointments"}
          className={`account-tab-btn ${activeTab === "appointments" ? "active" : ""}`}
          onClick={() => setActiveTab("appointments")}
        >
          📅 รายการนัดหมาย ({account?.appointments?.length || 0})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "visits"}
          className={`account-tab-btn ${activeTab === "visits" ? "active" : ""}`}
          onClick={() => setActiveTab("visits")}
        >
          📜 ประวัติการรักษา ({account?.visits?.length || 0})
        </button>
      </div>

      {loading ? (
        <div className="empty-state" role="status">กำลังโหลดข้อมูล...</div>
      ) : (
        account && (
          <div className="account-tab-content">
            {/* Tab 1: Profile & Health Unified */}
            {activeTab === "profile" && (
              <section className="account-card" aria-labelledby="profileTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">1</span>
                    <h2 id="profileTitle">ข้อมูลผู้ป่วยและสุขภาพ</h2>
                  </div>
                  <button
                    type="button"
                    className="primary-button compact-button edit-profile-btn"
                    onClick={() => {
                      initEditForm(profile);
                      setIsEditing(true);
                    }}
                  >
                    ✏️ แก้ไขข้อมูล
                  </button>
                </div>

                <div className="profile-subgroup-title">
                  <strong>ข้อมูลส่วนบุคคลและการติดต่อ</strong>
                </div>
                <ProfileDetails profile={account.profile} />

                <div className="profile-section-separator" />

                <div className="profile-subgroup-title">
                  <strong>ข้อมูลสุขภาพและประวัติการแพ้</strong>
                </div>
                <HealthDetails profile={account.profile} />
              </section>
            )}

            {/* Tab 2: Appointments */}
            {activeTab === "appointments" && (
              <section className="account-card" aria-labelledby="appointmentTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">2</span>
                    <h2 id="appointmentTitle">รายการนัดหมายพบแพทย์</h2>
                  </div>
                </div>
                <AppointmentHistory appointments={account.appointments || []} />
              </section>
            )}

            {/* Tab 3: Visits History */}
            {activeTab === "visits" && (
              <section className="account-card" aria-labelledby="visitTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">3</span>
                    <h2 id="visitTitle">ประวัติการรับบริการและผลตรวจรักษา</h2>
                  </div>
                </div>
                <VisitHistory visits={account.visits || []} />
              </section>
            )}
          </div>
        )
      )}

      {/* Edit Profile Modal Dialog */}
      {isEditing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="editModalTitle">แก้ไขข้อมูลส่วนตัวและสุขภาพ</h2>
              <button type="button" className="close-modal-btn" onClick={() => setIsEditing(false)} aria-label="ปิด">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="edit-profile-form">
              <div className="edit-form-grid">
                {/* 1. Basic Info */}
                <label className="field">
                  <span>ชื่อ</span>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="ชื่อ"
                    required
                  />
                </label>

                <label className="field">
                  <span>นามสกุล</span>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="นามสกุล"
                    required
                  />
                </label>

                <label className="field">
                  <span>เพศ</span>
                  <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                    <option value="UNKNOWN">ไม่ระบุ</option>
                    <option value="M">ชาย</option>
                    <option value="F">หญิง</option>
                    <option value="O">อื่น ๆ</option>
                  </select>
                </label>

                <label className="field">
                  <span>เบอร์โทรศัพท์</span>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="08xxxxxxxx"
                  />
                </label>

                <label className="field">
                  <span>วัน/เดือน/ปีเกิด</span>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={handleBirthDateChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </label>

                <label className="field">
                  <span>อายุ (ปี)</span>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    placeholder="0"
                  />
                </label>

                <label className="field field-wide">
                  <span>ที่อยู่ปัจจุบัน</span>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                  />
                </label>

                {/* 2. Health Info Section */}
                <div className="field-divider">
                  <strong>ข้อมูลสุขภาพและประวัติการแพ้</strong>
                </div>

                <label className="field">
                  <span>หมู่เลือด</span>
                  <select value={editBloodType} onChange={(e) => setEditBloodType(e.target.value)}>
                    <option value="UNKNOWN">ไม่ทราบ</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </label>

                <label className="field">
                  <span>ส่วนสูง (ซม.)</span>
                  <input
                    type="number"
                    min={30}
                    max={250}
                    step="0.1"
                    value={editHeightCm}
                    onChange={(e) => setEditHeightCm(e.target.value)}
                    placeholder="เช่น 170"
                  />
                </label>

                <label className="field">
                  <span>น้ำหนัก (กก.)</span>
                  <input
                    type="number"
                    min={1}
                    max={400}
                    step="0.1"
                    value={editWeightKg}
                    onChange={(e) => setEditWeightKg(e.target.value)}
                    placeholder="เช่น 65"
                  />
                </label>

                <label className="field field-wide">
                  <span>โรคประจำตัว</span>
                  <input
                    type="text"
                    value={editChronic}
                    onChange={(e) => setEditChronic(e.target.value)}
                    placeholder="เช่น ความดันโลหิตสูง, เบาหวาน (ถ้าไม่มีให้ระบุ ไม่มี)"
                  />
                </label>

                <label className="field field-wide">
                  <span>ประวัติแพ้ยา / แพ้อาหาร</span>
                  <input
                    type="text"
                    value={editAllergies}
                    onChange={(e) => setEditAllergies(e.target.value)}
                    placeholder="เช่น แพ้ยาเพนิซิลลิน, แพ้อาหารทะเล (ถ้าไม่มีให้ระบุ ไม่มี)"
                  />
                </label>

                <label className="field field-wide">
                  <span>ยาที่ใช้ประจำ</span>
                  <input
                    type="text"
                    value={editMeds}
                    onChange={(e) => setEditMeds(e.target.value)}
                    placeholder="ระบุชื่อยาที่รับประทานต่อเนื่อง"
                  />
                </label>

                {/* 3. Emergency Contacts Section */}
                <div className="field-divider">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>ข้อมูลผู้ติดต่อฉุกเฉิน (สูงสุด 3 ท่าน)</strong>
                    {editEmergencyContacts.length < 3 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={addEmergencyContact}
                        style={{ fontSize: "0.88rem" }}
                      >
                        + เพิ่มผู้ติดต่อ
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {editEmergencyContacts.map((contact, index) => (
                    <div
                      key={contact.id}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        padding: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--primary)" }}>
                          ผู้ติดต่อท่านที่ {index + 1} {index === 0 ? "(หลัก)" : ""}
                        </span>
                        {editEmergencyContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEmergencyContact(contact.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#dc2626",
                              fontSize: "0.82rem",
                              cursor: "pointer",
                            }}
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                      <div className="edit-form-grid" style={{ gap: "10px" }}>
                        <input
                          type="text"
                          placeholder="ชื่อ-นามสกุล"
                          value={contact.name}
                          onChange={(e) => updateEmergencyContact(contact.id, "name", e.target.value)}
                        />
                        <select
                          value={contact.relationship}
                          onChange={(e) => updateEmergencyContact(contact.id, "relationship", e.target.value)}
                        >
                          <option value="">-- ความสัมพันธ์ --</option>
                          <option value="บิดา">บิดา</option>
                          <option value="มารดา">มารดา</option>
                          <option value="คู่สมรส">คู่สมรส</option>
                          <option value="บุตร">บุตร</option>
                          <option value="พี่น้อง">พี่น้อง</option>
                          <option value="ญาติ">ญาติ</option>
                          <option value="เพื่อน">เพื่อน</option>
                          <option value="ผู้ดูแล">ผู้ดูแล</option>
                          <option value="อื่น ๆ">อื่น ๆ</option>
                        </select>
                        <input
                          type="tel"
                          placeholder="เบอร์โทรศัพท์"
                          value={contact.phone}
                          onChange={(e) => updateEmergencyContact(contact.id, "phone", e.target.value)}
                          style={{ gridColumn: "1 / -1" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="primary-button">
                  บันทึกข้อมูล
                </button>
                <button type="button" className="secondary-button" onClick={() => setIsEditing(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function ProfileDetails({ profile }: { profile: PatientProfile }) {
  const contactText = profile.emergency_contacts && profile.emergency_contacts.length > 0
    ? profile.emergency_contacts
        .map(
          (c: { id?: string; name: string; relationship?: string; phone: string }, i: number) =>
            `${i + 1}. ${c.name} (${c.relationship || "ผู้ติดต่อ"}) · ${c.phone}`
        )
        .join("\n")
    : [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(" · ");

  const rows: Array<[string, unknown, boolean?]> = [
    ["ชื่อ-นามสกุล", `${profile.first_name} ${profile.last_name}`],
    ["เลขประจำตัวประชาชน", profile.national_id],
    ["HN", profile.hn],
    ["เบอร์โทรศัพท์", profile.phone],
    ["เพศ", profile.gender === "M" ? "ชาย" : profile.gender === "F" ? "หญิง" : profile.gender === "O" ? "อื่น ๆ" : profile.gender],
    ["อายุ", profile.age ? `${profile.age} ปี` : null],
    ["ที่อยู่", profile.address, true],
    ["ผู้ติดต่อฉุกเฉิน", contactText, true],
  ];
  return (
    <dl className="detail-grid">
      {rows.map(([label, value, wide]) => (
        <div className={`detail-item${wide ? " wide" : ""}`} key={label}>
          <dt>{label}</dt>
          <dd style={wide && label === "ผู้ติดต่อฉุกเฉิน" ? { whiteSpace: "pre-line" } : undefined}>
            {dash(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function HealthDetails({ profile }: { profile: PatientProfile }) {
  const bmi = profile.height_cm && profile.weight_kg
    ? (profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null;

  const rows: Array<[string, unknown, boolean?]> = [
    ["หมู่เลือด", profile.blood_type && profile.blood_type !== "UNKNOWN" ? profile.blood_type : "ไม่ทราบ"],
    [
      "ส่วนสูง / น้ำหนัก / BMI",
      [
        profile.height_cm && `${profile.height_cm} ซม.`,
        profile.weight_kg && `${profile.weight_kg} กก.`,
        bmi && `BMI ${bmi}`,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    ],
    ["โรคประจำตัว", profile.chronic_diseases, true],
    ["ประวัติแพ้ยา / แพ้อาหาร", profile.allergies, true],
    ["ยาที่ใช้ประจำ", profile.medications, true],
  ];
  return (
    <dl className="detail-grid">
      {rows.map(([label, value, wide]) => (
        <div className={`detail-item${wide ? " wide" : ""}`} key={label}>
          <dt>{label}</dt>
          <dd>{dash(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function AppointmentHistory({ appointments }: { appointments: Appointment[] }) {
  const labels: Record<string, string> = {
    SCHEDULED: "นัดหมายแล้ว",
    ATTENDED: "มาตามนัด",
    MISSED: "ขาดนัด",
    CANCELLED: "ยกเลิก",
  };
  if (!appointments.length) return <div className="empty-state">ยังไม่มีรายการนัดหมายพบแพทย์</div>;
  return (
    <div className="appointment-card-list">
      {appointments.map((appointment, index) => (
        <article className="appointment-native-card" key={`${appointment.date}-${appointment.time}-${index}`}>
          <div className="appointment-card-header">
            <div className="appointment-badge">
              <div>
                <strong>{labels[appointment.status] || appointment.status_label || appointment.status}</strong>
                <span className="app-clinic">คลินิกผู้ป่วยนอก (OPD)</span>
              </div>
            </div>
            <button
              type="button"
              className="add-calendar-btn"
              onClick={() => downloadIcsCalendar(appointment)}
              title="เพิ่มการแจ้งเตือนลงในปฏิทินมือถือ"
            >
              + เพิ่มลงปฏิทิน
            </button>
          </div>

          <div className="appointment-time-box">
            <span className="app-date">วันที่ {thaiDate(`${appointment.date}T00:00:00`, false)}</span>
            <span className="app-time">{appointment.time ? `เวลา ${appointment.time} น.` : "ช่วงเช้า 09:00 น."}</span>
          </div>

          {appointment.note && (
            <div className="appointment-prep-note">
              <strong>คำแนะนำ:</strong>
              <p>{appointment.note}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function VisitHistory({ visits }: { visits: Visit[] }) {
  if (!visits.length) return <div className="empty-state">ยังไม่มีประวัติการรับบริการ</div>;
  return (
    <div className="timeline-list">
      {visits.map((visit, index) => (
        <article className="timeline-item" key={`${visit.queue_number}-${visit.registered_at}-${index}`}>
          <div className="timeline-item-header">
            <strong>{visit.queue_number} · {visit.status_label}</strong>
            <time>{thaiDate(visit.registered_at)}</time>
          </div>
          {visit.note && <p>อาการ: {visit.note}</p>}
          {visit.diagnosis && <p>ผลวินิจฉัย: {visit.diagnosis}</p>}
          {visit.treatment && <p>การรักษา: {visit.treatment}</p>}
          {visit.vitals && (
            <p className="vitals-strip">
              {[
                [visit.vitals.sys_bp && visit.vitals.dia_bp ? `BP ${visit.vitals.sys_bp}/${visit.vitals.dia_bp}` : null],
                [visit.vitals.pr ? `ชีพจร ${visit.vitals.pr}` : null],
                [visit.vitals.bt ? `อุณหภูมิ ${visit.vitals.bt}°C` : null],
                [visit.vitals.o2sat ? `SpO₂ ${visit.vitals.o2sat}%` : null],
              ]
                .flat()
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
