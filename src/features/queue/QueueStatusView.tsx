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
}: QueueStatusViewProps) {
  const { queue, error, loading, initialLoading, refresh } = useQueuePolling({
    enabled: Boolean(token),
    token,
    initialQueue,
    onUnauthorized,
  });
  const { enabled: soundEnabled, toggleNotification } = useQueueNotification(queue);

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

        <div className="status-card no-queue-card">
          <div className="no-queue-icon" aria-hidden="true">🎟️</div>
          <h2>ยังไม่มีคิวรับบริการในขณะนี้</h2>
          <p className="instruction">หากต้องการเข้ารับการตรวจหรือคัดกรองอาการวันนี้ สามารถกดลงทะเบียนเพื่อรับบัตรคิวได้ทันที</p>

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
