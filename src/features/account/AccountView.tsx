import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";

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
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editChronic, setEditChronic] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editMeds, setEditMeds] = useState("");
  const [editEmergName, setEditEmergName] = useState("");
  const [editEmergPhone, setEditEmergPhone] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void patientApi
      .account(token)
      .then((result) => {
        if (active) {
          setAccount(result);
          initEditForm(result.profile);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        const error = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดข้อมูลได้");
        if (error.status === 401) onUnauthorized();
        else if (active) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token, onUnauthorized]);

  function initEditForm(p?: PatientProfile) {
    if (!p) return;
    setEditPhone(p.phone || "");
    setEditAddress(p.address || "");
    setEditChronic(p.chronic_diseases || "");
    setEditAllergies(p.allergies || "");
    setEditMeds(p.medications || "");
    setEditEmergName(p.emergency_name || "");
    setEditEmergPhone(p.emergency_phone || "");
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;

    // Update local profile state
    const updatedProfile: PatientProfile = {
      ...account.profile,
      phone: editPhone.trim() || null,
      address: editAddress.trim() || null,
      chronic_diseases: editChronic.trim() || null,
      allergies: editAllergies.trim() || null,
      medications: editMeds.trim() || null,
      emergency_name: editEmergName.trim() || null,
      emergency_phone: editEmergPhone.trim() || null,
    };

    setAccount({
      ...account,
      profile: updatedProfile,
    });

    setIsEditing(false);
    setSaveSuccessMsg("บันทึกการแก้ไขข้อมูลส่วนตัวเรียบร้อยแล้ว");
    setTimeout(() => setSaveSuccessMsg(""), 4000);
  }

  const profile = account?.profile;

  return (
    <section id="accountView" className="page-shell account-view">
      {/* Profile Header Banner */}
      <div className="account-heading">
        <div>
          <p className="eyebrow">บัตรประจำตัวและประวัติผู้ป่วย OPD</p>
          <h1>{profile ? `${profile.first_name} ${profile.last_name}` : "ข้อมูล & บัญชีของฉัน"}</h1>
          <p>HN: <strong>{dash(profile?.hn)}</strong> · เลขบัตร ปชช.: <strong>{dash(profile?.national_id)}</strong></p>
        </div>
        <div className="account-heading-actions">
          <button
            type="button"
            className="primary-button compact-button edit-profile-btn"
            onClick={() => {
              initEditForm(profile);
              setIsEditing(true);
            }}
          >
            ✏️ แก้ไขข้อมูลส่วนตัว
          </button>
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
          👤 ข้อมูลส่วนตัว & ติดต่อ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "health"}
          className={`account-tab-btn ${activeTab === "health" ? "active" : ""}`}
          onClick={() => setActiveTab("health")}
        >
          🩺 สุขภาพ & ประวัติแพ้ยา
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
          📜 ประวัติการตรวจ ({account?.visits?.length || 0})
        </button>
      </div>

      {loading ? (
        <div className="empty-state" role="status">กำลังโหลดข้อมูล...</div>
      ) : (
        account && (
          <div className="account-tab-content">
            {/* Tab 1: Profile & Contacts */}
            {activeTab === "profile" && (
              <section className="account-card" aria-labelledby="profileTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">1</span>
                    <h2 id="profileTitle">ข้อมูลส่วนตัว & การติดต่อ</h2>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      initEditForm(profile);
                      setIsEditing(true);
                    }}
                  >
                    ✏️ แก้ไข
                  </button>
                </div>
                <ProfileDetails profile={account.profile} />
              </section>
            )}

            {/* Tab 2: Health & Allergies */}
            {activeTab === "health" && (
              <section className="account-card" aria-labelledby="healthTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">2</span>
                    <h2 id="healthTitle">ข้อมูลสุขภาพ & ประวัติแพ้ยา</h2>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      initEditForm(profile);
                      setIsEditing(true);
                    }}
                  >
                    ✏️ แก้ไข
                  </button>
                </div>
                <HealthDetails profile={account.profile} />
              </section>
            )}

            {/* Tab 3: Appointments */}
            {activeTab === "appointments" && (
              <section className="account-card" aria-labelledby="appointmentTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">3</span>
                    <h2 id="appointmentTitle">รายการนัดหมายพบแพทย์</h2>
                  </div>
                </div>
                <AppointmentHistory appointments={account.appointments || []} />
              </section>
            )}

            {/* Tab 4: Visits History */}
            {activeTab === "visits" && (
              <section className="account-card" aria-labelledby="visitTitle">
                <div className="card-heading">
                  <div>
                    <span className="section-number">4</span>
                    <h2 id="visitTitle">ประวัติการรับบริการ & ผลวินิจฉัย</h2>
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
              <h2 id="editModalTitle">แก้ไขข้อมูลส่วนตัว</h2>
              <button type="button" className="close-modal-btn" onClick={() => setIsEditing(false)} aria-label="ปิด">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="edit-profile-form">
              <div className="edit-form-grid">
                <label className="field">
                  <span>เบอร์โทรศัพท์ส่วนตัว</span>
                  <input
                    type="tel"
                    aria-label="เบอร์โทรศัพท์ส่วนตัว"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="08xxxxxxxx"
                  />
                </label>

                <label className="field field-wide">
                  <span>ที่อยู่ปัจจุบัน</span>
                  <input
                    type="text"
                    aria-label="ที่อยู่ปัจจุบัน"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="เลขที่ หมู่ ตำบล อำเภอ จังหวัด"
                  />
                </label>

                <label className="field field-wide">
                  <span>โรคประจำตัว</span>
                  <input
                    type="text"
                    aria-label="โรคประจำตัว"
                    value={editChronic}
                    onChange={(e) => setEditChronic(e.target.value)}
                    placeholder="เช่น ความดันโลหิตสูง, เบาหวาน (ถ้าไม่มีให้ระบุ ไม่มี)"
                  />
                </label>

                <label className="field field-wide">
                  <span>ประวัติแพ้ยา / แพ้อาหาร</span>
                  <input
                    type="text"
                    aria-label="ประวัติแพ้ยา / แพ้อาหาร"
                    value={editAllergies}
                    onChange={(e) => setEditAllergies(e.target.value)}
                    placeholder="เช่น แพ้ยาเพนิซิลลิน, แพ้อาหารทะเล"
                  />
                </label>

                <label className="field field-wide">
                  <span>ยาที่ใช้ประจำ</span>
                  <input
                    type="text"
                    aria-label="ยาที่ใช้ประจำ"
                    value={editMeds}
                    onChange={(e) => setEditMeds(e.target.value)}
                    placeholder="ระบุชื่อยาที่รับประทานต่อเนื่อง"
                  />
                </label>

                <div className="field-divider">
                  <strong>ข้อมูลผู้ติดต่อฉุกเฉิน</strong>
                </div>

                <label className="field">
                  <span>ชื่อผู้ติดต่อฉุกเฉิน</span>
                  <input
                    type="text"
                    aria-label="ชื่อผู้ติดต่อฉุกเฉิน"
                    value={editEmergName}
                    onChange={(e) => setEditEmergName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล (ความสัมพันธ์)"
                  />
                </label>

                <label className="field">
                  <span>เบอร์โทรผู้ติดต่อฉุกเฉิน</span>
                  <input
                    type="tel"
                    aria-label="เบอร์โทรผู้ติดต่อฉุกเฉิน"
                    value={editEmergPhone}
                    onChange={(e) => setEditEmergPhone(e.target.value)}
                    placeholder="08xxxxxxxx"
                  />
                </label>
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
  const rows: Array<[string, unknown, boolean?]> = [
    ["ชื่อ-นามสกุล", `${profile.first_name} ${profile.last_name}`],
    ["เลขบัตรประชาชน", profile.national_id],
    ["HN", profile.hn],
    ["เบอร์โทรศัพท์", profile.phone],
    ["เพศ", profile.gender === "M" ? "ชาย" : profile.gender === "F" ? "หญิง" : profile.gender],
    ["อายุ", profile.age ? `${profile.age} ปี` : null],
    ["ที่อยู่", profile.address, true],
    ["ผู้ติดต่อฉุกเฉิน", [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(" · "), true],
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

function HealthDetails({ profile }: { profile: PatientProfile }) {
  const rows: Array<[string, unknown, boolean?]> = [
    ["หมู่เลือด", profile.blood_type],
    [
      "ส่วนสูง / น้ำหนัก",
      [profile.height_cm && `${profile.height_cm} ซม.`, profile.weight_kg && `${profile.weight_kg} กก.`].filter(Boolean).join(" / "),
    ],
    ["โรคประจำตัว", profile.chronic_diseases, true],
    ["ประวัติแพ้ยา / อาหาร", profile.allergies, true],
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
