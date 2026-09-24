import { useEffect, useRef, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";
import {
  PatientProfileForm,
  type PatientProfileFormHandle,
} from "@/features/patient-profile/PatientProfileForm";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { formatMaskedNationalId } from "@/shared/data/thai-id";

// พร็อพส์สำหรับคอมโพเนนต์หน้าบัญชีและประวัติผู้ป่วย
interface AccountViewProps {
  token: string;              // Access Token สำหรับเรียกดูข้อมูลส่วนตัว
  onQueue: () => void;        // สลับไปยังหน้าแสดงสถานะคิวสด
  onLogout: () => void;       // ฟังก์ชันออกจากระบบ
  onUnauthorized: () => void; // ฟังก์ชันจัดการเมื่อ Token หมดอายุ
}

// ชนิดของแท็บในหน้าบัญชีผู้ป่วย (ข้อมูลส่วนตัว & สุขภาพ, รายการนัดหมาย, ประวัติการรักษา)
type AccountTab = "profile" | "health" | "appointments" | "visits";

/**
 * ฟังก์ชันตัวช่วย: หากค่าเป็น null, undefined หรือค่าว่าง จะแทนที่ด้วยเครื่องหมาย "–"
 */
const dash = (value: unknown) => (value === null || value === undefined || value === "" ? "–" : String(value));

/**
 * แปลงสตริงวันที่ ISO ให้แสดงผลเป็นวันที่และเวลาภาษาไทย (พ.ศ.)
 *
 * @param {string | null} [value] - สตริงวันที่ในรูปแบบ ISO
 * @param {boolean} [includeTime=true] - แสดงเวลาด้วยหรือไม่ (ค่าเริ่มต้นคือ true)
 * @returns {string} วันที่ภาษาไทยที่จัดรูปแบบแล้ว
 */
const thaiDate = (value?: string | null, includeTime = true) =>
  value
    ? new Intl.DateTimeFormat("th-TH", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "–";

/**
 * สร้างและดาวน์โหลดไฟล์ปฏิทินมาตรฐาน iCalendar (`.ics`) สำหรับการนัดหมายแพทย์
 * (ฟังก์ชันอำนวยความสะดวก: ช่วยให้ผู้ป่วยกดเพิ่มนัดหมายเข้า Google Calendar หรือ Apple Calendar บนมือถือได้ทันที)
 *
 * ขั้นตอนการทำงาน:
 * 1. แยกวันและเวลาจากข้อมูลนัดหมาย มาจัดรูปแบบตามมาตรฐาน VCALENDAR (DTSTART, DTEND)
 * 2. กำหนดชื่อหัวข้อนัดหมาย รายละเอียด และสถานที่ (แผนก OPD)
 * 3. บันทึกเป็นไฟล์ Blob ชนิด text/calendar แล้วสร้างลิงก์ดาวน์โหลดอัตโนมัติ
 *
 * @param {Appointment} appointment - ข้อมูลการนัดหมายแพทย์
 */
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

/**
 * คอมโพเนนต์หน้าบัญชีผู้ป่วยและประวัติการรักษา (`AccountView`)
 *
 * ประกอบด้วยส่วนสำคัญ 4 ด้าน:
 * 1. ข้อมูลส่วนบุคคลและสุขภาพ: เลข HN, บัตรประชาชน (Masking), ที่อยู่, ผู้ติดต่อฉุกเฉิน, BMI, โรคประจำตัว, ประวัติแพ้ยา
 * 2. การ์ดแสดงคิวที่กำลังรับบริการวันนี้ (ถ้ามี) พร้อมปุ่มลัดไปหน้าคิวสด
 * 3. รายการนัดหมายพบแพทย์: ดูวันเวลา คำแนะนำ และปุ่มดาวน์โหลดไฟล์นัดหมายลงปฏิทินมือถือ (.ics)
 * 4. ประวัติการตรวจรักษาและสัญญาณชีพ: แสดงบันทึกความดัน ชีพจร อุณหภูมิ และคำวินิจฉัยย้อนหลัง
 * 5. ฟังก์ชันแก้ไขข้อมูลส่วนตัวผ่านหน้าต่าง Modal ป๊อปอัป
 */
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const profileRef = useRef<PatientProfileFormHandle>(null);

  // ดึงข้อมูลบัญชีและข้อมูลคิวพร้อมกันด้วย Promise.allSettled เพื่อความรวดเร็วและป้องกันข้อผิดพลาด
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

        // จัดการสถานะคิวปัจจุบันที่เชื่อมโยงกับบัญชีผู้ป่วย
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

  /**
   * บันทึกการแก้ไขข้อมูลส่วนตัวและสุขภาพของผู้ป่วย (ส่งคำขอ PATCH ไปยัง API)
   */
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account || saving || !profileRef.current) return;

    // ตรวจสอบความถูกต้องของข้อมูลในแบบฟอร์มก่อนส่ง
    const validationError = profileRef.current.validate();
    if (validationError) {
      setSaveError(validationError.message);
      return;
    }
    const payload = profileRef.current.getPayload();
    // ตัดฟิลด์เลขบัตรประชาชนออก เพราะไม่อนุญาตให้แก้ไขเลขบัตรประชาชนได้โดยตรง
    const { national_id: _nationalId, ...profileUpdatePayload } = payload;
    const updatedProfile: PatientProfile = {
      ...account.profile,
      ...profileUpdatePayload,
      first_name: profileUpdatePayload.first_name ?? account.profile.first_name,
      last_name: profileUpdatePayload.last_name ?? account.profile.last_name,
      emergency_contacts: profileUpdatePayload.emergency_contacts ?? [],
    };

    setSaving(true);
    setSaveError("");
    try {
      await patientApi.updateProfile(profileUpdatePayload, token);
      setAccount({ ...account, profile: updatedProfile });
      setIsEditing(false);
      setSaveSuccessMsg("บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว");
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch (reason) {
      const apiError = reason instanceof ApiError
        ? reason
        : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถบันทึกข้อมูลได้");
      if (apiError.status === 401) {
        onUnauthorized();
        return;
      }
      setSaveError(
        apiError.message === "Failed to fetch"
          ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
          : apiError.message,
      );
    } finally {
      setSaving(false);
    }
  }

  const profile = account?.profile;

  // กรณีอยู่ระหว่างโหลดข้อมูลครั้งแรก
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
      {/* ส่วนหัวแสดงชื่อผู้ป่วยและรหัสประจำตัว HN */}
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

      {/* กล่องสรุปสถานะคิวปัจจุบัน (ถ้ามีคิวที่กำลังรอรับบริการ) */}
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

      {/* แถบสลับหมวดหมู่ข้อมูล (แท็บข้อมูลผู้ป่วย, นัดหมาย, ประวัติการรักษา) */}
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
            {/* แท็บที่ 1: ข้อมูลส่วนตัวและข้อมูลสุขภาพ */}
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
                      setSaveError("");
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

            {/* แท็บที่ 2: รายการนัดหมายพบแพทย์ */}
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

            {/* แท็บที่ 3: ประวัติการรับบริการและการตรวจรักษา */}
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

      {/* หน้าต่างป๊อปอัปแก้ไขข้อมูลส่วนตัวและสุขภาพ (Modal) */}
      {isEditing && account && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="editModalTitle">แก้ไขข้อมูลส่วนตัวและสุขภาพ</h2>
              <button type="button" className="close-modal-btn" onClick={() => setIsEditing(false)} aria-label="ปิด">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="edit-profile-form">
              {saveError && <div className="alert" role="alert">{saveError}</div>}
              <PatientProfileForm ref={profileRef} mode="edit" initialProfile={account.profile} />

              <div className="modal-actions">
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
                <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={saving}>
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

/**
 * คอมโพเนนต์ย่อยแสดงรายละเอียดข้อมูลส่วนบุคคลและการติดต่อ
 */
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
    ["เลขประจำตัวประชาชน", formatMaskedNationalId(profile.national_id)],
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

/**
 * คอมโพเนนต์ย่อยแสดงข้อมูลสุขภาพ ค่า BMI โรคประจำตัว และประวัติการแพ้
 */
function HealthDetails({ profile }: { profile: PatientProfile }) {
  // คำนวณค่าดัชนีมวลกาย BMI = น้ำหนัก (กก.) / ส่วนสูง (เมตร)^2
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

/**
 * คอมโพเนนต์ย่อยแสดงรายการนัดหมายแพทย์ล่วงหน้า พร้อมปุ่มกดบันทึกลงปฏิทิน
 */
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

/**
 * คอมโพเนนต์ย่อยแสดงประวัติการรับบริการตรวจรักษาในอดีต (Timeline) และสัญญาณชีพ
 */
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
          {/* ข้อมูลสัญญาณชีพ (ความดันโลหิต, ชีพจร, อุณหภูมิ, ออกซิเจนในเลือด SpO2) */}
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
