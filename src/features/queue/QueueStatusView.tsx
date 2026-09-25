import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { PatientJourney, QueueData, Visit } from "@/shared/api/types";
import { getRuntimeConfig } from "@/shared/config/runtime-config";
import { useQueuePolling } from "./useQueuePolling";
import { useQueueNotification } from "./useQueueNotification";
import { generateQueueCardImage } from "./queue-card-canvas";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

// พร็อพส์สำหรับคอมโพเนนต์แสดงสถานะคิว (QueueStatusViewProps)
interface QueueStatusViewProps {
  token: string;                                          // Access Token ของผู้ป่วย
  initialQueue?: Partial<QueueData> | null;               // ข้อมูลคิวเริ่มต้น
  onBookQueue?: () => void;                               // ฟังก์ชันนำทางไปหน้าจองคิว
  onLogin?: () => void;                                   // ฟังก์ชันนำทางไปหน้าเข้าสู่ระบบ
  onAccount: () => void;                                  // ฟังก์ชันนำทางไปหน้าบัญชี/ข้อมูลผู้ป่วย
  onUnauthorized: () => void;                             // ฟังก์ชันจัดการเมื่อ Token หมดอายุ
  onQueueStateChange?: (hasActiveQueue: boolean) => void; // ฟังก์ชันแจ้งการเปลี่ยนแปลงว่ามีคิวตรวจค้างอยู่หรือไม่
}

const queueProgressSteps = [
  { key: "registration", label: "จองคิว" },
  { key: "vitals", label: "ตรวจร่างกาย" },
  { key: "queue", label: "รอห้องตรวจ" },
  { key: "doctor", label: "เข้าตรวจ" },
  { key: "billing", label: "ชำระเงิน" },
  { key: "pharmacy", label: "จ่ายยา" },
  { key: "complete", label: "เสร็จสิ้น" },
] as const;

type ProgressState = "done" | "current" | "pending" | "skipped" | "cancelled" | "unknown";

function currentClinicalStep(status?: string): number {
  switch (status) {
    case "WAITING_VITALS":
    case "WAITING_CONFIRMATION":
      return 2;
    case "WAITING_QUEUE":
    case "WAITING":
    case "OBSERVATION_MONITORING":
    case "REASSESSMENT_REQUIRED":
      return 3;
    case "CALLED":
    case "MONITORING":
    case "OPD_DONE":
    case "FOLLOWUP":
    case "EMERGENCY_TRANSFER":
    case "DISCHARGED":
      return 4;
    default:
      return 1;
  }
}

function QueueStepIcon({ number }: { number: number }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {number === 1 && <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></>}
      {number === 2 && <path d="M2 12h4l2-4 3 8 2-4h9" />}
      {number === 3 && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {number === 4 && <><path d="M4 21V3h11v18M4 21h16M17 12h4m-2-2 2 2-2 2" /></>}
      {number === 5 && <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>}
      {number === 6 && <><path d="M8 5a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V9a4 4 0 0 0-4-4Zm-4 7h8M16 7h5M18.5 4.5v5" /></>}
      {number === 7 && <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>}
    </svg>
  );
}

function QueueProgress({ status, journey }: { status?: string | null; journey?: PatientJourney | null }) {
  const fallbackStep = currentClinicalStep(status || undefined);
  const backendSteps = new Map(journey?.steps?.map((step) => [step.key, step]));
  const afterExam = status === "OPD_DONE" || status === "DISCHARGED";
  const steps = queueProgressSteps.map(({ key, label }, index) => {
    const backendStep = backendSteps.get(key);
    let state: ProgressState;
    if (backendStep) {
      state = backendStep.state;
    } else if (index < 4) {
      if (afterExam || index + 1 < fallbackStep) state = "done";
      else if (index + 1 === fallbackStep) state = "current";
      else state = "pending";
    } else if (key === "complete") {
      state = status === "DISCHARGED" && !journey ? "done" : "pending";
    } else {
      state = afterExam ? "unknown" : "pending";
    }
    return { key, label, state, detail: backendStep?.detail };
  });
  const completed = steps[6].state === "done";
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const firstUnfinishedIndex = steps.findIndex((step) => step.state !== "done" && step.state !== "skipped");
  const progressIndex = firstUnfinishedIndex < 0 ? 6
    : steps[firstUnfinishedIndex].state === "current" ? firstUnfinishedIndex : Math.max(0, firstUnfinishedIndex - 1);
  const currentLabel = currentIndex >= 0 ? steps[currentIndex].label : "";
  const needsDownstreamStatus = steps[3].state === "done" || steps.slice(4, 6).some((step) => step.state === "current" || step.state === "done");
  let heading = currentLabel ? `ตอนนี้: ${currentLabel}` : "ตรวจเสร็จแล้ว · รอสถานะขั้นตอนถัดไป";
  let caption = currentLabel
    ? `ขั้นตอนที่ ${currentIndex + 1} จาก ${queueProgressSteps.length} · กำลังดำเนินการ`
    : "รอข้อมูลการเงินและห้องยาจากโรงพยาบาล";
  if (journey?.current_label) heading = `ตอนนี้: ${journey.current_label}`;
  if (journey?.current_detail) caption = journey.current_detail;
  if (completed) heading = "เสร็จสิ้นการรับบริการ";
  if (completed && !journey?.current_detail) caption = "ดำเนินการเสร็จแล้ว";
  const downstreamStatus = journey
    ? steps.slice(4, 6).map((step) => `${step.label}: ${step.detail || (step.state === "skipped" ? "ไม่ต้องดำเนินการ" : "รอข้อมูล")}`).join(" · ")
    : completed ? "สถานะชำระเงินและจ่ายยา: โรงพยาบาลยังไม่ส่งรายละเอียดแยก" : "สถานะชำระเงินและจ่ายยา: รอข้อมูลจากโรงพยาบาล";

  return (
    <div className="queue-progress-section">
      <h2>{heading}</h2>
      <p className="queue-progress-caption">{caption}</p>
      <div className="queue-progress-timeline">
        <div className="queue-progress-track" aria-hidden="true">
          <span style={{ width: `${(progressIndex / (queueProgressSteps.length - 1)) * 100}%` }} />
        </div>
        <ol className="queue-progress" aria-label="ความคืบหน้าการรับบริการ">
          {steps.map(({ key, label, state }, index) => {
            const number = index + 1;
            return (
              <li key={key} className={state} aria-current={state === "current" || (key === "complete" && completed) ? "step" : undefined}>
                <span className="queue-progress-marker"><QueueStepIcon number={number} /></span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {needsDownstreamStatus && <p className="queue-progress-detail">{downstreamStatus}</p>}
    </div>
  );
}

/**
 * คำนวณระยะเวลารอตรวจโดยประมาณ (Estimated Wait Time) ตามลำดับคิวและสถานะปัจจุบัน
 * (สูตรการคำนวณที่ใช้นำเสนอต่อคณะกรรมการสอบวิทยานิพนธ์)
 *
 * กฎการประเมินระยะเวลา:
 * - หากสถานะระบุว่า "ตรวจเสร็จ" หรือ "รับยา" -> ผู้ป่วยตรวจเสร็จสิ้นแล้ว
 * - หากสถานะระบุว่า "กำลังตรวจ" หรือลำดับคิว = 0 -> ผู้ป่วยกำลังอยู่ในห้องตรวจ
 * - หากลำดับคิว = 1 -> เป็นคิวถัดไป ให้เตรียมตัวเข้าตรวจ (ประมาณ 1 - 5 นาที)
 * - หากลำดับคิว > 1 -> คำนวณจากอัตราเฉลี่ย 5 ถึง 7 นาทีต่อคนไข้ 1 คน (min = n * 5, max = n * 7 นาที)
 *
 * @param {number | null | undefined} position - ลำดับคิวที่เหลือก่อนถึงผู้ป่วย
 * @param {string} statusLabel - ข้อความแสดงสถานะคิว
 * @returns {string} ข้อความแสดงผลระยะเวลารอโดยประมาณ
 */
function calculateEstimatedWaitTime(position: number | null | undefined, statusLabel: string): string {
  if (statusLabel.includes("ตรวจเสร็จ") || statusLabel.includes("รับยา")) return "ตรวจเสร็จสิ้นแล้ว";
  if (statusLabel.includes("กำลังตรวจ") || position === 0) return "กำลังรับการตรวจในห้องตรวจ";
  if (position === 1) return "เตรียมตัวเข้าตรวจ (ประมาณ 1 – 5 นาที)";
  if (typeof position === "number" && position > 1) {
    const minTime = position * 5;
    const maxTime = position * 7;
    return `รออีกประมาณ ${minTime} – ${maxTime} นาที (${position} คิวก่อนหน้า)`;
  }
  return "ระบบกำลังประเมินระยะเวลารอ";
}

/**
 * คอมโพเนนต์หน้าจอแสดงสถานะบัตรคิวตรวจผู้ป่วยนอก (`QueueStatusView`)
 *
 * จัดการมุมมองหลัก 3 กรณี (Core Views):
 * 1. กำลังโหลดเริ่มต้น (Initial Loading): แสดงหน้าจอ `LoadingScreen`
 * 2. มีคิวรอตรวจ (Active Queue): แสดงบัตรคิวสด, ลำดับคิว, ห้องตรวจ, เวลาโดยประมาณ,
 *    ปุ่มบันทึกรูปภาพบัตรคิว, และหน้าต่างป๊อปอัปยืนยันการยกเลิกคิวแบบ 2 ขั้นตอน (2-Step Safety Modal)
 * 3. ไม่มีคิวรอตรวจ (No Queue): แสดงสถานะว่างพร้อมปุ่มกดจองคิวใหม่
 * 4. ผู้ใช้ทั่วไปที่ยังไม่ได้ล็อกอิน (Guest / Landing): แสดงปุ่มทางเลือกเข้าสู่ระบบหรือจองคิว
 */
export function QueueStatusView({
  token,
  initialQueue,
  onBookQueue,
  onLogin,
  onAccount,
  onUnauthorized,
  onQueueStateChange,
}: QueueStatusViewProps) {
  // ดึงข้อมูลคิวอัตโนมัติด้วย Background Polling
  const { queue, error, loading, initialLoading, refresh, clearActiveQueue } = useQueuePolling({
    enabled: Boolean(token),
    token,
    initialQueue,
    onUnauthorized,
  });

  // ระบบเสียงกริ่งสังเคราะห์และระบบสั่นเตือนเมื่อใกล้ถึงคิว
  const { enabled: soundEnabled, toggleNotification } = useQueueNotification(queue);

  // สถานะจัดการ Modal ยืนยันยกเลิกคิวแบบ 2 ขั้นตอน ป้องกันผู้ป่วยกดผิดพลาด
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [recentVisit, setRecentVisit] = useState<Visit | null>(null);

  // อัปเดตสถานะให้คอมโพเนนต์แม่รับรู้ว่ามีคิวตรวจอยู่หรือไม่ เพื่อปรับ UI แถบนำทาง (Navbar)
  useEffect(() => {
    if (!initialLoading) {
      onQueueStateChange?.(Boolean(queue?.queue_number));
    }
  }, [initialLoading, onQueueStateChange, queue?.queue_number]);

  useEffect(() => {
    if (!token || initialLoading || queue?.queue_number || cancelSuccess) {
      setRecentVisit(null);
      return;
    }
    let active = true;
    let timer: number | undefined;
    const loadRecentVisit = async () => {
      let shouldPoll = false;
      try {
        const account = await patientApi.account(token);
        const latest = account.visits?.[0];
        const isToday = latest?.registered_at && new Date(latest.registered_at).toDateString() === new Date().toDateString();
        const isAfterExam = ["OPD_DONE", "DISCHARGED"].includes(latest?.status || "");
        if (active) setRecentVisit(isToday && isAfterExam ? latest : null);
        shouldPoll = Boolean(isToday && latest?.status === "OPD_DONE" && !latest.patient_journey?.steps?.some((step) => step.key === "complete" && step.state === "done"));
      } catch {
        if (active) setRecentVisit(null);
      }
      if (active && shouldPoll) timer = window.setTimeout(() => void loadRecentVisit(), getRuntimeConfig().statusRefreshMs);
    };
    void loadRecentVisit();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token, initialLoading, queue?.queue_number, cancelSuccess]);

  // ฟอร์แมตเวลาอัปเดตล่าสุดให้เป็นรูปแบบเวลาไทย (ชั่วโมง:นาที:วินาที)
  const updatedAt = (() => {
    if (!queue?.updated_at) return "กำลังอัปเดต...";
    try {
      const d = new Date(queue.updated_at);
      if (isNaN(d.getTime())) {
        return queue.updated_at;
      }
      return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
    } catch {
      return queue.updated_at || "กำลังอัปเดต...";
    }
  })();

  const position = queue?.queue_position;
  const statusLabel = queue?.status_label || "";
  // ตรวจสอบเงื่อนไขว่าใกล้ถึงคิวหรือไม่ (เหลือ 1-3 คิว หรือ กำลังเรียก)
  const isNearQueue = (typeof position === "number" && position > 0 && position <= 3) || statusLabel.includes("เรียก");
  const estimatedWaitText = calculateEstimatedWaitTime(position, statusLabel);

  // รายการสถานะคิวที่อนุญาตให้ผู้ป่วยกดยกเลิกได้ด้วยตนเอง
  const patientCancellableStatuses = new Set([
    "WAITING_VITALS",
    "WAITING_CONFIRMATION",
    "WAITING_QUEUE",
    "WAITING",
    "CALLED",
  ]);
  const rawQueueStatus = queue?.status || "";
  const canCancelQueue = !rawQueueStatus || patientCancellableStatuses.has(rawQueueStatus);
  const postExamInProgress = recentVisit?.status === "OPD_DONE"
    && !recentVisit.patient_journey?.steps?.some((step) => step.key === "complete" && step.state === "done");
  const cancelUnavailableText = rawQueueStatus
    ? "คิวอยู่ในขั้นตอนที่ไม่สามารถยกเลิกด้วยตนเองได้ กรุณาติดต่อเจ้าหน้าที่"
    : "";

  /**
   * บันทึกรูปภาพบัตรคิวลงเครื่องโดยใช้อัลกอริทึมวาด Canvas 2D
   */
  function handleSaveImage() {
    if (!queue) return;
    generateQueueCardImage(queue, estimatedWaitText);
  }

  /**
   * ส่งคำขอยกเลิกบัตรคิวไปยัง API และอัปเดตสถานะหน้าจอเมื่อยกเลิกสำเร็จ
   */
  async function handleConfirmCancelQueue() {
    if (!token) return;
    setCancelling(true);
    setCancelMessage("");
    try {
      await patientApi.cancelQueue(token);
      try {
        sessionStorage.setItem("opd_cancelled_queue_number", queue?.queue_number || "");
      } catch {
        // ข้ามข้อผิดพลาด storage
      }
      clearActiveQueue();
      setShowCancelModal(false);
      setCancelSuccess(true);
      setCancelStep(1);
    } catch (reason) {
      const apiError = reason instanceof ApiError
        ? reason
        : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถยกเลิกคิวได้");
      if (apiError.status === 401) onUnauthorized();
      else setCancelMessage(apiError.message);
    } finally {
      setCancelling(false);
    }
  }

  // กรณีที่ 1: กำลังโหลดข้อมูลคิวครั้งแรก
  if (initialLoading) {
    return (
      <section id="statusView" className="page-shell status-view">
        <LoadingScreen
          title="กำลังโหลด"
          subtitle="กรุณารอสักครู่ ระบบกำลังค้นหาข้อมูลคิวรับบริการของคุณจากโรงพยาบาล"
        />
      </section>
    );
  }

  // กรณีที่ 2: มีคิวที่กำลังรอตรวจอยู่ในระบบ (Active Queue)
  if (queue && queue.queue_number) {
    return (
      <section id="statusView" className="page-shell status-view">
        {/* แบนเนอร์สีส้มแจ้งเตือนพิเศษเมื่อใกล้ถึงคิว */}
        {isNearQueue && (
          <div className="near-queue-banner" role="alert">
            <div className="banner-badge">แจ้งเตือน</div>
            <div>
              <strong>ใกล้ถึงคิวของคุณแล้ว!</strong>
              <p>กรุณาเตรียมตัวและรอเรียกชื่อ ณ บริเวณหน้าห้องตรวจ {queue?.room || ""}</p>
            </div>
          </div>
        )}

        <div className="status-card">
          {/* ปุ่มสลับเปิด/ปิดเสียงและระบบสั่นเตือน */}
          <div className="card-top-actions">
            <button
              type="button"
              className={`notif-toggle-btn ${soundEnabled ? "active" : ""}`}
              onClick={toggleNotification}
              title={soundEnabled ? "ปิดเสียงและการสั่นเตือน" : "เปิดเสียงและการสั่นเตือน"}
              aria-label={soundEnabled ? "ปิดเสียงเตือน" : "เปิดเสียงเตือน"}
            >
              <span>{soundEnabled ? "แจ้งเตือน & สั่น: เปิด" : "แจ้งเตือน & สั่น: ปิด"}</span>
            </button>
          </div>

          <div className="success-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">ระบบคิวผู้ป่วยนอก (OPD)</p>
          <h1>บัตรคิวรับบริการของคุณ</h1>
          <div className="queue-number">{queue?.queue_number || "-"}</div>
          <div className="status-pill"><span /><strong>{queue?.status_label || "กำลังโหลดสถานะ"}</strong></div>

          <QueueProgress status={rawQueueStatus} journey={queue?.patient_journey} />
          
          {/* กล่องแสดงระยะเวลาประมาณการ */}
          <div className="wait-time-card">
            <div className="wait-icon-tag">รอตรวจ</div>
            <div>
              <span className="wait-title">ประมาณการเวลารอตรวจ</span>
              <strong>{estimatedWaitText}</strong>
            </div>
          </div>

          <p className="instruction">{queue?.instruction || "กรุณารอเรียกตรวจตามลำดับ"}</p>
          
          {/* รายละเอียด 3 คอลัมน์: ลำดับ, คิวก่อนหน้า, ห้องตรวจ */}
          <div className="queue-details three-col">
            <div>
              <span>ลำดับของคุณ</span>
              <strong>{Number.isInteger(queue?.queue_position) ? `อันดับ ${queue?.queue_position}` : "รอจัดลำดับ"}</strong>
            </div>
            <div>
              <span>คิวก่อนหน้า</span>
              <strong>
                {typeof queue?.queue_position === "number"
                  ? queue.queue_position <= 1
                    ? "คิวถัดไป"
                    : `อีก ${queue.queue_position - 1} คิว`
                  : "–"}
              </strong>
            </div>
            <div>
              <span>ห้องตรวจ</span>
              <strong>{queue?.room || "กำลังจัดสรร"}</strong>
            </div>
          </div>

          <p className="last-updated" role={error ? "alert" : undefined}>{error || `อัปเดตล่าสุด ${updatedAt} น.`}</p>

          {/* แผงปุ่มดำเนินการ: อัปเดต, บันทึกรูป, ดูประวัติ, ยกเลิกคิว */}
          <div className="queue-action-buttons">
            <button className="primary-button" type="button" onClick={() => void refresh()} disabled={loading}>
              <span>อัปเดตสถานะคิว</span><i aria-hidden="true">{loading ? "↻" : "⟳"}</i>
            </button>
            <button className="action-button-image" type="button" onClick={handleSaveImage}>
              บันทึกบัตรคิวเป็นรูปภาพ
            </button>
            <button className="secondary-button" type="button" onClick={onAccount}>ดูข้อมูลและประวัติการรักษา</button>
            {canCancelQueue ? (
              <button
                className="cancel-queue-btn"
                type="button"
                onClick={() => {
                  setCancelMessage("");
                  setCancelStep(1);
                  setShowCancelModal(true);
                }}
              >
                ยกเลิกคิวรับบริการ
              </button>
            ) : (
              <div className="cancel-queue-unavailable" role="status">
                <strong>ไม่สามารถยกเลิกคิวด้วยตนเองในขั้นตอนนี้</strong>
                <span>{cancelUnavailableText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal ยืนยันการยกเลิกคิว 2 ขั้นตอน (Safety 2-Step Confirmation Modal) */}
        {showCancelModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancelQueueTitle">
            <div className="modal-content" style={{ maxWidth: "460px", textAlign: "center", padding: "32px 28px" }}>
              {cancelStep === 1 ? (
                <>
                  <div style={{ fontSize: "2.8rem", marginBottom: "8px" }} aria-hidden="true">⚠️</div>
                  <span className="modal-step-badge step-1">
                    ขั้นตอนที่ 1 จาก 2 : ตรวจสอบความตั้งใจ
                  </span>
                  <h2 id="cancelQueueTitle" style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "10px", color: "var(--ink)" }}>
                    คุณต้องการยกเลิกคิวรับบริการหรือไม่?
                  </h2>
                  <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "22px" }}>
                    คุณกำลังจะสละสิทธิ์คิวหมายเลข <strong style={{ color: "var(--ink)", fontSize: "1.05rem" }}>{queue?.queue_number}</strong><br />
                    หากคุณกดผิดหรือไม่ตั้งใจยกเลิก สามารถกดปุ่ม &quot;ไม่ยกเลิก (คงคิวไว้)&quot; ได้ทันที
                  </p>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ flex: 1 }}
                      onClick={() => setShowCancelModal(false)}
                    >
                      ไม่ยกเลิก (คงคิวไว้)
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ flex: 1, backgroundColor: "#ea580c", borderColor: "#ea580c" }}
                      onClick={() => setCancelStep(2)}
                    >
                      ดำเนินการต่อ (ขั้นที่ 2) →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "2.8rem", marginBottom: "8px" }} aria-hidden="true">🛑</div>
                  <span className="modal-step-badge step-2">
                    ขั้นตอนที่ 2 จาก 2 : ยืนยันครั้งสุดท้าย
                  </span>
                  <h2 id="cancelQueueTitle" style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "10px", color: "var(--danger)" }}>
                    ยืนยันการสละสิทธิ์คิว {queue?.queue_number}
                  </h2>
                  
                  <div className="modal-warning-box">
                    <strong>⚠️ คำเตือนสำคัญ:</strong> เมื่อยืนยันแล้ว คิวหมายเลข <b>{queue?.queue_number}</b> จะถูกยกเลิกทันทีและไม่สามารถกู้คืนได้ ประวัติการรับบริการจะยังถูกเก็บไว้ และหากต้องการรับบริการอีกครั้งให้เข้าสู่ระบบด้วยบัญชีเดิมแล้วกดรับบริการครั้งใหม่
                  </div>

                  {cancelMessage && (
                    <div className="alert" role="alert" style={{ marginBottom: "16px", textAlign: "left" }}>
                      {cancelMessage}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ flex: 1 }}
                      disabled={cancelling}
                      onClick={() => setCancelStep(1)}
                    >
                      ← ย้อนกลับ
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ flex: 1, backgroundColor: "var(--danger)", borderColor: "var(--danger)" }}
                      disabled={cancelling}
                      onClick={handleConfirmCancelQueue}
                    >
                      {cancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิกคิวทันที"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ลิงก์เชื่อมโยงไปยังจอแสดงผลคิวรวมทั้งโรงพยาบาล (Live OPD Queue Board) */}
        <a
          href="https://hospital.bfirstkok.me/queues/display/"
          target="_blank"
          rel="noopener noreferrer"
          className="live-display-board-card"
        >
          <div className="live-display-icon">📺</div>
          <div className="live-display-info">
            <strong>ดูจอแสดงผลคิวรวมทั้งโรงพยาบาล (Live OPD Board)</strong>
            <p>ติดตามสถานะคิวทุกแผนกและห้องตรวจแบบเรียลไทม์ ↗</p>
          </div>
        </a>

        <div className="notice-card">
          <strong>คำแนะนำการรับบริการ</strong>
          <p>ระบบจะอัปเดตสถานะอัตโนมัติทุก 10 วินาที พร้อมส่งเสียงและสั่นเตือนบนโทรศัพท์เมื่อใกล้ถึงคิว</p>
        </div>
      </section>
    );
  }

  // กรณีที่ 3: ผู้ป่วยเข้าสู่ระบบแล้ว แต่ยังไม่มีคิวตรวจในวันนี้
  if (token) {
    return (
      <section id="statusView" className="page-shell status-view">
        <div className="intro">
          <span className="eyebrow">ระบบบริการผู้ป่วยนอก (OPD)</span>
          <h1>สถานะคิวรับบริการ</h1>
          <p>ขณะนี้คุณยังไม่มีคิวที่กำลังรอตรวจ สามารถกดจองคิวเพื่อรับบริการได้ทันที</p>
        </div>

        {/* แถบแจ้งเตือนเมื่อเพิ่งยกเลิกคิวสำเร็จ */}
        {cancelSuccess && (
          <div className="success-banner" role="status">
            <span className="success-banner-icon" aria-hidden="true">✓</span>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", color: "#14532d", marginBottom: "2px" }}>
                ยกเลิกคิวรับบริการเรียบร้อยแล้ว
              </strong>
              <span style={{ fontSize: "0.9rem", color: "#166534", lineHeight: 1.4 }}>
                ประวัติเดิมยังถูกเก็บไว้ หากต้องการรับบริการอีกครั้งให้ใช้บัญชีเดิมและกดปุ่ม &quot;จองคิวรับบริการวันนี้&quot; ด้านล่าง
              </span>
            </div>
          </div>
        )}

        <div className="status-card no-queue-card">
          {recentVisit && !cancelSuccess && (
            <div className="recent-visit-progress" role="status">
              <strong>คิวล่าสุดวันนี้ {recentVisit.queue_number} · {recentVisit.status_label}</strong>
              <QueueProgress status={recentVisit.status} journey={recentVisit.patient_journey} />
            </div>
          )}
          <div className="no-queue-icon" aria-hidden="true">🎟️</div>
          <h2>{postExamInProgress ? "กำลังดำเนินการหลังตรวจ" : "ยังไม่มีคิวรับบริการในขณะนี้"}</h2>
          <p className="instruction">
            {postExamInProgress
              ? "ติดตามสถานะชำระเงินและจ่ายยาด้านบน หากยังไม่แสดงข้อมูล กรุณารอเจ้าหน้าที่อัปเดตสถานะ"
              : "หากต้องการเข้ารับการตรวจหรือคัดกรองอาการวันนี้ สามารถกดลงทะเบียนเพื่อรับบัตรคิวได้ทันที"}
          </p>

          <div className="queue-action-buttons">
            {onBookQueue && (
              <button className="primary-button" type="button" onClick={onBookQueue}>
                <span>จองคิวรับบริการวันนี้</span>
                <i aria-hidden="true">+</i>
              </button>
            )}
            <button className="secondary-button" type="button" onClick={onAccount}>
              ดูข้อมูลส่วนตัวและประวัติการรักษา
            </button>
            <button className="text-button" type="button" onClick={() => void refresh()} disabled={loading}>
              {loading ? "กำลังตรวจสอบคิว..." : "⟳ ตรวจสอบคิวอีกครั้ง"}
            </button>
          </div>
        </div>

        {/* ลิงก์เชื่อมโยงไปยังจอแสดงผลคิวรวม */}
        <a
          href="https://hospital.bfirstkok.me/queues/display/"
          target="_blank"
          rel="noopener noreferrer"
          className="live-display-board-card"
        >
          <div className="live-display-icon">📺</div>
          <div className="live-display-info">
            <strong>ดูจอแสดงผลคิวรวมทั้งโรงพยาบาล (Live OPD Board)</strong>
            <p>ติดตามสถานะคิวทุกแผนกและห้องตรวจแบบเรียลไทม์ ↗</p>
          </div>
        </a>

        <div className="notice-card">
          <strong>เวลาทำการแผนกผู้ป่วยนอก</strong>
          <p>เปิดให้บริการวันจันทร์ - วันศุกร์ เวลา 08:00 - 16:00 น.</p>
        </div>
      </section>
    );
  }

  // กรณีที่ 4: ผู้ใช้ทั่วไปที่ยังไม่ได้เข้าสู่ระบบ (หน้าแรก Landing Portal)
  return (
    <section id="statusView" className="page-shell status-view">
      <div className="intro">
        <span className="eyebrow">โรงพยาบาลรัฐ · ระบบบริการผู้ป่วยนอก (OPD)</span>
        <h1>ระบบจองและตรวจสอบคิว</h1>
        <p>ลงทะเบียนรับบริการ OPD รวดเร็ว สะดวก ตรวจสอบสถานะคิวแบบเรียลไทม์ผ่านมือถือ</p>
      </div>

      <div className="portal-hero-card">
        <div className="hero-icon-badge" aria-hidden="true">✚</div>
        <h2>เริ่มต้นรับบริการ</h2>
        <p>เลือกขั้นตอนที่ต้องการเพื่อเข้ารับการตรวจ หรือเข้าสู่ระบบเพื่อดูคิวและประวัติของคุณ</p>

        <div className="hero-action-grid">
          {onBookQueue && (
            <button className="hero-primary-btn" type="button" onClick={onBookQueue}>
              <div className="hero-btn-icon">📝</div>
              <div>
                <strong>จองคิว / ลงทะเบียนใหม่</strong>
                <small>สำหรับผู้ป่วยใหม่และผู้ป่วยเก่าที่ต้องการรับบริการวันนี้</small>
              </div>
              <span>→</span>
            </button>
          )}

          {onLogin && (
            <button className="hero-secondary-btn" type="button" onClick={onLogin}>
              <div className="hero-btn-icon">👤</div>
              <div>
                <strong>เข้าสู่ระบบด้วยเลขบัตรประชาชน</strong>
                <small>ค้นหาคิวเดิม ตรวจสอบประวัติการรักษา และรายการนัดหมาย</small>
              </div>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {/* จุดเด่นของระบบ 3 ด้าน */}
      <div className="feature-highlights-grid">
        <div className="highlight-item">
          <span className="highlight-icon">⚡</span>
          <strong>คิวเรียลไทม์</strong>
          <p>รู้เวลารอตรวจโดยประมาณและลำดับคิวก่อนหน้า</p>
        </div>
        <div className="highlight-item">
          <span className="highlight-icon">🔔</span>
          <strong>สั่น & แจ้งเตือน</strong>
          <p>เตือนอัตโนมัติเมื่อใกล้ถึงคิว 3 ลำดับล่วงหน้า</p>
        </div>
        <div className="highlight-item">
          <span className="highlight-icon">🔍</span>
          <strong>อ่านง่าย ทุกวัย</strong>
          <p>ปรับขนาดตัวอักษรได้ 3 ระดับ เหมาะกับผู้สูงอายุ</p>
        </div>
      </div>
    </section>
  );
}
