import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { AccountData, Appointment, PatientProfile, Visit } from "@/shared/api/types";

interface AccountViewProps {
  token: string;
  onQueue: () => void;
  onLogout: () => void;
  onUnauthorized: () => void;
}

const dash = (value: unknown) => value === null || value === undefined || value === "" ? "–" : String(value);
const thaiDate = (value?: string | null, includeTime = true) => value ? new Intl.DateTimeFormat("th-TH", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value)) : "–";

export function AccountView({ token, onQueue, onLogout, onUnauthorized }: AccountViewProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void patientApi.account(token).then((result) => {
      if (active) setAccount(result);
    }).catch((reason: unknown) => {
      const error = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดข้อมูลได้");
      if (error.status === 401) onUnauthorized();
      else if (active) setMessage(error.message);
    });
    return () => { active = false; };
  }, [token, onUnauthorized]);

  const profile = account?.profile;
  return (
    <section id="accountView" className="page-shell account-view">
      <div className="account-heading"><div><p className="eyebrow">บัญชีผู้ป่วย</p><h1>{profile ? `${profile.first_name} ${profile.last_name}` : "ข้อมูลของฉัน"}</h1><p>HN {dash(profile?.hn)}</p></div><button className="secondary-button compact-button" type="button" onClick={onLogout}>ออกจากระบบ</button></div>
      {message && <div className="alert" role="alert">{message}</div>}
      {!account && !message ? <div className="empty-state" role="status">กำลังโหลดข้อมูล...</div> : account && <>
        <section className="account-card queue-summary" aria-labelledby="accountQueueTitle"><div className="card-heading"><div><span className="section-number">คิว</span><h2 id="accountQueueTitle">คิวปัจจุบัน</h2></div>{account.active_queue && <button className="text-button" type="button" onClick={onQueue}>ดูสถานะเต็ม</button>}</div><QueueSummary queue={account.active_queue} /></section>
        <section className="account-card" aria-labelledby="profileTitle"><div className="card-heading"><div><span className="section-number">1</span><h2 id="profileTitle">ข้อมูลส่วนตัว</h2></div></div><ProfileDetails profile={account.profile} /></section>
        <section className="account-card" aria-labelledby="historyTitle"><div className="card-heading"><div><span className="section-number">2</span><h2 id="historyTitle">ประวัติการรับบริการ</h2></div></div><VisitHistory visits={account.visits || []} /></section>
        <section className="account-card" aria-labelledby="appointmentTitle"><div className="card-heading"><div><span className="section-number">3</span><h2 id="appointmentTitle">นัดหมาย</h2></div></div><AppointmentHistory appointments={account.appointments || []} /></section>
      </>}
    </section>
  );
}

function QueueSummary({ queue }: { queue: AccountData["active_queue"] }) {
  if (!queue) return <div className="empty-state">ขณะนี้ไม่มีคิวที่กำลังดำเนินการ</div>;
  return <div className="queue-overview"><strong>{queue.queue_number}</strong><div><b>{queue.status_label}</b><p>{queue.instruction}{queue.room ? ` · ${queue.room}` : ""}</p></div></div>;
}

function ProfileDetails({ profile }: { profile: PatientProfile }) {
  const rows: Array<[string, unknown, boolean?]> = [
    ["ชื่อ-นามสกุล", `${profile.first_name} ${profile.last_name}`], ["เลขบัตรประชาชน", profile.national_id], ["HN", profile.hn], ["เบอร์โทรศัพท์", profile.phone], ["เพศ", profile.gender], ["อายุ", profile.age ? `${profile.age} ปี` : null], ["หมู่เลือด", profile.blood_type], ["ส่วนสูง / น้ำหนัก", [profile.height_cm && `${profile.height_cm} ซม.`, profile.weight_kg && `${profile.weight_kg} กก.`].filter(Boolean).join(" / ")], ["ที่อยู่", profile.address, true], ["โรคประจำตัว", profile.chronic_diseases, true], ["ประวัติแพ้ยา / อาหาร", profile.allergies, true], ["ยาที่ใช้ประจำ", profile.medications, true], ["ผู้ติดต่อฉุกเฉิน", [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(" · "), true],
  ];
  return <dl className="detail-grid">{rows.map(([label, value, wide]) => <div className={`detail-item${wide ? " wide" : ""}`} key={label}><dt>{label}</dt><dd>{dash(value)}</dd></div>)}</dl>;
}

function VisitHistory({ visits }: { visits: Visit[] }) {
  if (!visits.length) return <div className="empty-state">ยังไม่มีประวัติการรับบริการ</div>;
  return <div className="timeline-list">{visits.map((visit, index) => <article className="timeline-item" key={`${visit.queue_number}-${visit.registered_at}-${index}`}><div className="timeline-item-header"><strong>{visit.queue_number} · {visit.status_label}</strong><time>{thaiDate(visit.registered_at)}</time></div>{visit.note && <p>อาการ: {visit.note}</p>}{visit.diagnosis && <p>ผลวินิจฉัย: {visit.diagnosis}</p>}{visit.treatment && <p>การรักษา: {visit.treatment}</p>}{visit.vitals && <p>{[[visit.vitals.sys_bp && visit.vitals.dia_bp ? `BP ${visit.vitals.sys_bp}/${visit.vitals.dia_bp}` : null], [visit.vitals.pr ? `ชีพจร ${visit.vitals.pr}` : null], [visit.vitals.bt ? `อุณหภูมิ ${visit.vitals.bt}°C` : null], [visit.vitals.o2sat ? `SpO₂ ${visit.vitals.o2sat}%` : null]].flat().filter(Boolean).join(" · ")}</p>}</article>)}</div>;
}

function AppointmentHistory({ appointments }: { appointments: Appointment[] }) {
  const labels: Record<string, string> = { SCHEDULED: "นัดหมายแล้ว", ATTENDED: "มาตามนัด", MISSED: "ขาดนัด", CANCELLED: "ยกเลิก" };
  if (!appointments.length) return <div className="empty-state">ยังไม่มีรายการนัดหมาย</div>;
  return <div className="timeline-list">{appointments.map((appointment, index) => <article className="timeline-item" key={`${appointment.date}-${appointment.time}-${index}`}><div className="timeline-item-header"><strong>{labels[appointment.status] || appointment.status_label || appointment.status}</strong><time>{thaiDate(`${appointment.date}T00:00:00`, false)}{appointment.time ? ` เวลา ${appointment.time} น.` : ""}</time></div>{appointment.note && <p>{appointment.note}</p>}</article>)}</div>;
}
