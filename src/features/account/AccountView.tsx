import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";

interface AccountViewProps {
  token: string;
  onQueue: () => void;
  onLogout: () => void;
  onUnauthorized: () => void;
}

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

export function AccountView({ token, onQueue, onLogout, onUnauthorized }: AccountViewProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void patientApi
      .account(token)
      .then((result) => {
        if (active) setAccount(result);
      })
      .catch((reason: unknown) => {
        const error = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดข้อมูลได้");
        if (error.status === 401) onUnauthorized();
        else if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [token, onUnauthorized]);

  const profile = account?.profile;
  return (
    <section id="accountView" className="page-shell account-view">
      <div className="account-heading">
        <div>
          <p className="eyebrow">บัตรประจำตัวผู้ป่วย OPD</p>
          <h1>{profile ? `${profile.first_name} ${profile.last_name}` : "ข้อมูลของฉัน"}</h1>
          <p>HN: <strong>{dash(profile?.hn)}</strong></p>
        </div>
        <button className="secondary-button compact-button" type="button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>

      {message && <div className="alert" role="alert">{message}</div>}

      {!account && !message ? (
        <div className="empty-state" role="status">กำลังโหลดข้อมูล...</div>
      ) : (
        account && (
          <>
            {/* Block: Current Queue */}
            <section className="account-card queue-summary" aria-labelledby="accountQueueTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">🎫</span>
                  <h2 id="accountQueueTitle">คิวปัจจุบัน</h2>
                </div>
                {account.active_queue && (
                  <button className="text-button" type="button" onClick={onQueue}>
                    ดูสถานะเต็ม
                  </button>
                )}
              </div>
              <QueueSummary queue={account.active_queue} />
            </section>

            {/* Block: Profile Info */}
            <section className="account-card" aria-labelledby="profileTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">👤</span>
                  <h2 id="profileTitle">ข้อมูลส่วนตัว</h2>
                </div>
              </div>
              <ProfileDetails profile={account.profile} />
            </section>

            {/* Block: Appointments (Native App Notification style) */}
            <section className="account-card" aria-labelledby="appointmentTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">📅</span>
                  <h2 id="appointmentTitle">นัดหมาย</h2>
                </div>
              </div>
              <AppointmentHistory appointments={account.appointments || []} />
            </section>

            {/* Block: Visit History */}
            <section className="account-card" aria-labelledby="historyTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">📋</span>
                  <h2 id="historyTitle">ประวัติการรับบริการ</h2>
                </div>
              </div>
              <VisitHistory visits={account.visits || []} />
            </section>
          </>
        )
      )}
    </section>
  );
}

function QueueSummary({ queue }: { queue: AccountData["active_queue"] }) {
  if (!queue) return <div className="empty-state">ขณะนี้ไม่มีคิวที่กำลังดำเนินการ</div>;
  return (
    <div className="queue-overview">
      <strong>{queue.queue_number}</strong>
      <div>
        <b>{queue.status_label}</b>
        <p>{queue.instruction}{queue.room ? ` · ${queue.room}` : ""}</p>
      </div>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: PatientProfile }) {
  const rows: Array<[string, unknown, string, boolean?]> = [
    ["ชื่อ-นามสกุล", `${profile.first_name} ${profile.last_name}`, "👤"],
    ["เลขบัตรประชาชน", profile.national_id, "🪪"],
    ["HN", profile.hn, "🏥"],
    ["เบอร์โทรศัพท์", profile.phone, "📞"],
    ["เพศ", profile.gender === "M" ? "ชาย" : profile.gender === "F" ? "หญิง" : profile.gender, "⚧"],
    ["อายุ", profile.age ? `${profile.age} ปี` : null, "🎂"],
    ["หมู่เลือด", profile.blood_type, "🩸"],
    [
      "ส่วนสูง / น้ำหนัก",
      [profile.height_cm && `${profile.height_cm} ซม.`, profile.weight_kg && `${profile.weight_kg} กก.`].filter(Boolean).join(" / "),
      "⚖️",
    ],
    ["ที่อยู่", profile.address, "📍", true],
    ["โรคประจำตัว", profile.chronic_diseases, "🩺", true],
    ["ประวัติแพ้ยา / อาหาร", profile.allergies, "⚠️", true],
    ["ยาที่ใช้ประจำ", profile.medications, "💊", true],
    ["ผู้ติดต่อฉุกเฉิน", [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(" · "), "🚨", true],
  ];
  return (
    <dl className="detail-grid">
      {rows.map(([label, value, icon, wide]) => (
        <div className={`detail-item${wide ? " wide" : ""}`} key={label}>
          <dt>
            <span aria-hidden="true">{icon}</span> {label}
          </dt>
          <dd>{dash(value)}</dd>
        </div>
      ))}
    </dl>
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
          {visit.note && <p>💬 อาการ: {visit.note}</p>}
          {visit.diagnosis && <p>🩺 ผลวินิจฉัย: {visit.diagnosis}</p>}
          {visit.treatment && <p>💊 การรักษา: {visit.treatment}</p>}
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

function AppointmentHistory({ appointments }: { appointments: Appointment[] }) {
  const labels: Record<string, string> = {
    SCHEDULED: "นัดหมายแล้ว",
    ATTENDED: "มาตามนัด",
    MISSED: "ขาดนัด",
    CANCELLED: "ยกเลิก",
  };
  if (!appointments.length) return <div className="empty-state">ยังไม่มีรายการนัดหมาย</div>;
  return (
    <div className="appointment-card-list">
      {appointments.map((appointment, index) => (
        <article className="appointment-native-card" key={`${appointment.date}-${appointment.time}-${index}`}>
          <div className="appointment-card-header">
            <div className="appointment-badge">
              <span className="app-icon" aria-hidden="true">👨‍⚕️</span>
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
              📅 เพิ่มลงปฏิทิน
            </button>
          </div>

          <div className="appointment-time-box">
            <span className="app-date">📅 {thaiDate(`${appointment.date}T00:00:00`, false)}</span>
            <span className="app-time">⏰ {appointment.time ? `เวลา ${appointment.time} น.` : "ช่วงเช้า 09:00 น."}</span>
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
