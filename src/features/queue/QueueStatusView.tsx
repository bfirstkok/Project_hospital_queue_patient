import { useEffect, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { QueueData } from "@/shared/api/types";
import { useQueuePolling } from "./useQueuePolling";
import { useQueueNotification } from "./useQueueNotification";
import { generateQueueCardImage } from "./queue-card-canvas";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

interface QueueStatusViewProps {
  token: string;
  initialQueue?: Partial<QueueData> | null;
  onBookQueue?: () => void;
  onLogin?: () => void;
  onMedical?: () => void;
  onAccount: () => void;
  onUnauthorized: () => void;
  onQueueStateChange?: (hasActiveQueue: boolean) => void;
}

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

export function QueueStatusView({
  token,
  initialQueue,
  onBookQueue,
  onLogin,
  onMedical,
  onAccount,
  onUnauthorized,
  onQueueStateChange,
}: QueueStatusViewProps) {
  const { queue, error, loading, initialLoading, refresh, clearActiveQueue } = useQueuePolling({
    enabled: Boolean(token),
    token,
    initialQueue,
    onUnauthorized,
  });
  const { enabled: soundEnabled, toggleNotification } = useQueueNotification(queue);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    if (!initialLoading) {
      onQueueStateChange?.(Boolean(queue?.queue_number));
    }
  }, [initialLoading, onQueueStateChange, queue?.queue_number]);

  const updatedAt = queue?.updated_at
    ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(queue.updated_at))
    : "กำลังอัปเดต...";

  const position = queue?.queue_position;
  const statusLabel = queue?.status_label || "";
  const isNearQueue = (typeof position === "number" && position > 0 && position <= 3) || statusLabel.includes("เรียก");
  const estimatedWaitText = calculateEstimatedWaitTime(position, statusLabel);

  function handleSaveImage() {
    if (!queue) return;
    generateQueueCardImage(queue, estimatedWaitText);
  }

  async function handleConfirmCancelQueue() {
    if (!token) return;
    setCancelling(true);
    setCancelMessage("");
    try {
      await patientApi.cancelQueue(token);
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

  // Initial Loading state
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

  // Case 1: Has active queue
  if (queue && queue.queue_number) {
    return (
      <section id="statusView" className="page-shell status-view">
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
          
          <div className="wait-time-card">
            <div className="wait-icon-tag">รอตรวจ</div>
            <div>
              <span className="wait-title">ประมาณการเวลารอตรวจ</span>
              <strong>{estimatedWaitText}</strong>
            </div>
          </div>

          <p className="instruction">{queue?.instruction || "กรุณารอเรียกตรวจตามลำดับ"}</p>
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

          <div className="queue-action-buttons">
            <button className="primary-button" type="button" onClick={() => void refresh()} disabled={loading}>
              <span>อัปเดตสถานะคิว</span><i aria-hidden="true">{loading ? "↻" : "⟳"}</i>
            </button>
            <button className="action-button-image" type="button" onClick={handleSaveImage}>
              บันทึกบัตรคิวเป็นรูปภาพ
            </button>
            <button className="secondary-button" type="button" onClick={onAccount}>ดูข้อมูลและประวัติการรักษา</button>
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
          </div>
        </div>

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
                    <strong>⚠️ คำเตือนสำคัญ:</strong> เมื่อยืนยันแล้ว คิวหมายเลข <b>{queue?.queue_number}</b> จะถูกยกเลิกทันทีและไม่สามารถกู้คืนได้ หากต้องการรับบริการในภายหลังจะต้องลงทะเบียนเพื่อจองคิวใหม่
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

        {/* Link to Full Hospital Queue Display Board */}
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

  // Case 2: Logged in but no active queue today
  if (token) {
    return (
      <section id="statusView" className="page-shell status-view">
        <div className="intro">
          <span className="eyebrow">ระบบบริการผู้ป่วยนอก (OPD)</span>
          <h1>สถานะคิวรับบริการ</h1>
          <p>ขณะนี้คุณยังไม่มีคิวที่กำลังรอตรวจ สามารถกดจองคิวเพื่อรับบริการได้ทันที</p>
        </div>

        {cancelSuccess && (
          <div className="success-banner" role="status">
            <span className="success-banner-icon" aria-hidden="true">✓</span>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", color: "#14532d", marginBottom: "2px" }}>
                ยกเลิกคิวรับบริการเรียบร้อยแล้ว
              </strong>
              <span style={{ fontSize: "0.9rem", color: "#166534", lineHeight: 1.4 }}>
                หากต้องการรับบริการใหม่ สามารถกดปุ่ม &quot;จองคิวรับบริการวันนี้&quot; ด้านล่างได้ทุกเมื่อ
              </span>
            </div>
          </div>
        )}

        <div className="status-card no-queue-card">
          <div className="no-queue-icon" aria-hidden="true">🎟️</div>
          <h2>ยังไม่มีคิวรับบริการในขณะนี้</h2>
          <p className="instruction">
            หากต้องการเข้ารับการตรวจหรือคัดกรองอาการวันนี้<br className="desktop-break" />
            สามารถกดลงทะเบียนเพื่อรับบัตรคิวได้ทันที
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

        {/* Link to Full Hospital Queue Display Board */}
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

  // Case 3: Guest / Not logged in (Main Landing)
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
                <strong>เข้าสู่ระบบด้วยเลขบัตรประชาชน / ThaID</strong>
                <small>ค้นหาคิวเดิม ตรวจสอบประวัติการรักษา และรายการนัดหมาย</small>
              </div>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

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
