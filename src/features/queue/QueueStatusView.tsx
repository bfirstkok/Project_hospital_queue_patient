import type { QueueData } from "@/shared/api/types";
import { useQueuePolling } from "./useQueuePolling";
import { useQueueNotification } from "./useQueueNotification";
import { generateQueueCardImage } from "./queue-card-canvas";

interface QueueStatusViewProps {
  token: string;
  initialQueue?: Partial<QueueData> | null;
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

export function QueueStatusView({ token, initialQueue, onAccount, onUnauthorized }: QueueStatusViewProps) {
  const { queue, error, loading, refresh } = useQueuePolling({ enabled: true, token, initialQueue, onUnauthorized });
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

  return (
    <section id="statusView" className="page-shell status-view">
      {isNearQueue && (
        <div className="near-queue-banner" role="alert">
          <span className="banner-icon" aria-hidden="true">🔔</span>
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
            <span aria-hidden="true">{soundEnabled ? "🔔 สั่น/เตือน: เปิด" : "🔕 สั่น/เตือน: ปิด"}</span>
          </button>
        </div>

        <div className="success-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">ลงทะเบียนเรียบร้อย</p>
        <h1>คิวของคุณ</h1>
        <div className="queue-number">{queue?.queue_number || "-"}</div>
        <div className="status-pill"><span /><strong>{queue?.status_label || "กำลังโหลดสถานะ"}</strong></div>
        
        <div className="wait-time-card">
          <span className="wait-icon" aria-hidden="true">⏱️</span>
          <div>
            <span className="wait-title">ประมาณการเวลารอตรวจ</span>
            <strong>{estimatedWaitText}</strong>
          </div>
        </div>

        <p className="instruction">{queue?.instruction || "กรุณารอสักครู่"}</p>
        <div className="queue-details three-col">
          <div>
            <span>ลำดับของคุณ</span>
            <strong>{Number.isInteger(queue?.queue_position) ? `อันดับ ${queue?.queue_position}` : "รอจัดลำดับ"}</strong>
          </div>
          <div>
            <span>คิวก่อนหน้าคุณ</span>
            <strong>
              {typeof queue?.queue_position === "number"
                ? queue.queue_position <= 1
                  ? "คิวถัดไป 🎯"
                  : `อีก ${queue.queue_position - 1} คิว`
                : "–"}
            </strong>
          </div>
          <div>
            <span>ห้องตรวจ</span>
            <strong>{queue?.room || "ยังไม่ระบุ"}</strong>
          </div>
        </div>

        <p className="last-updated" role={error ? "alert" : undefined}>{error || `อัปเดตล่าสุด ${updatedAt} น.`}</p>

        <div className="queue-action-buttons">
          <button className="primary-button" type="button" onClick={() => void refresh()} disabled={loading}>
            <span>อัปเดตสถานะ</span><i aria-hidden="true">{loading ? "↻" : "⟳"}</i>
          </button>
          <button className="action-button-image" type="button" onClick={handleSaveImage} disabled={!queue}>
            <span aria-hidden="true">🖼️</span> บันทึกบัตรคิวเป็นรูปภาพ
          </button>
          <button className="secondary-button" type="button" onClick={onAccount}>ดูข้อมูลและประวัติของฉัน</button>
        </div>
      </div>

      <div className="notice-card">
        <strong>โปรดเก็บหน้านี้ไว้</strong>
        <p>สถานะจะอัปเดตอัตโนมัติทุก 10 วินาที พร้อมระบบสั่นเตือนเมื่อใกล้ถึงคิว</p>
      </div>
    </section>
  );
}

