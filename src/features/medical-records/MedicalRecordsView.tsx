import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";

interface MedicalRecordsViewProps {
  token: string;
  onLogin: () => void;
  onBookQueue: () => void;
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

export function MedicalRecordsView({ token, onLogin, onBookQueue, onUnauthorized }: MedicalRecordsViewProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(token));

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

  if (!token) {
    return (
      <section id="medicalView" className="page-shell medical-records-view">
        <div className="intro">
          <span className="eyebrow">ประวัติสุขภาพ & การรักษา</span>
          <h1>ข้อมูลของฉัน</h1>
          <p>เข้าสู่ระบบเพื่อดูประวัติการตรวจ สัญญาณชีพ รายการนัดหมายแพทย์ และข้อมูลสุขภาพส่วนบุคคล</p>
        </div>

        <div className="guest-prompt-card">
          <div className="guest-icon" aria-hidden="true">📋</div>
          <h2>ยังไม่ได้เข้าสู่ระบบ</h2>
          <p>กรุณาเข้าสู่ระบบด้วยเลขบัตรประชาชน หรือลงทะเบียนรับบริการ OPD เพื่อเปิดดูข้อมูลสุขภาพของคุณ</p>
          <div className="guest-actions">
            <button className="primary-button" type="button" onClick={onLogin}>
              <span>เข้าสู่ระบบเพื่อดูประวัติ</span>
              <i aria-hidden="true">→</i>
            </button>
            <button className="secondary-button" type="button" onClick={onBookQueue}>
              ลงทะเบียน / จองคิวใหม่
            </button>
          </div>
        </div>
      </section>
    );
  }

  const profile = account?.profile;

  return (
    <section id="medicalView" className="page-shell medical-records-view">
      <div className="account-heading">
        <div>
          <p className="eyebrow">ประวัติสุขภาพและการรักษา</p>
          <h1>ข้อมูลสุขภาพของฉัน</h1>
          <p>ผู้ป่วย: <strong>{profile ? `${profile.first_name} ${profile.last_name}` : "–"}</strong> (HN: {dash(profile?.hn)})</p>
        </div>
      </div>

      {message && <div className="alert" role="alert">{message}</div>}

      {loading ? (
        <div className="empty-state" role="status">กำลังโหลดข้อมูลประวัติการรักษา...</div>
      ) : (
        account && (
          <>
            {/* Block 1: สรุปข้อมูลสุขภาพ */}
            <section className="account-card" aria-labelledby="healthSummaryTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">1</span>
                  <h2 id="healthSummaryTitle">ข้อมูลสุขภาพเบื้องต้น</h2>
                </div>
              </div>
              <HealthSummary profile={account.profile} />
            </section>

            {/* Block 2: รายการนัดหมายแพทย์ */}
            <section className="account-card" aria-labelledby="appointmentTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">2</span>
                  <h2 id="appointmentTitle">รายการนัดหมายพบแพทย์</h2>
                </div>
              </div>
              <AppointmentHistory appointments={account.appointments || []} />
            </section>

            {/* Block 3: ประวัติการรับบริการ */}
            <section className="account-card" aria-labelledby="historyTitle">
              <div className="card-heading">
                <div>
                  <span className="section-number">3</span>
                  <h2 id="historyTitle">ประวัติการตรวจ & ผลวินิจฉัย</h2>
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

function HealthSummary({ profile }: { profile: PatientProfile }) {
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
