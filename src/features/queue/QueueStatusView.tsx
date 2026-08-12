import type { QueueData } from "@/shared/api/types";
import { useQueuePolling } from "./useQueuePolling";

interface QueueStatusViewProps {
  token: string;
  initialQueue?: Partial<QueueData> | null;
  onAccount: () => void;
  onUnauthorized: () => void;
}

export function QueueStatusView({ token, initialQueue, onAccount, onUnauthorized }: QueueStatusViewProps) {
  const { queue, error, loading, refresh } = useQueuePolling({ enabled: true, token, initialQueue, onUnauthorized });
  const updatedAt = queue?.updated_at ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(queue.updated_at)) : "กำลังอัปเดต...";

  return (
    <section id="statusView" className="page-shell status-view">
      <div className="status-card">
        <div className="success-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">ลงทะเบียนเรียบร้อย</p>
        <h1>คิวของคุณ</h1>
        <div className="queue-number">{queue?.queue_number || "-"}</div>
        <div className="status-pill"><span /><strong>{queue?.status_label || "กำลังโหลดสถานะ"}</strong></div>
        <p className="instruction">{queue?.instruction || "กรุณารอสักครู่"}</p>
        <div className="queue-details"><div><span>ลำดับคิว</span><strong>{Number.isInteger(queue?.queue_position) ? `อันดับ ${queue?.queue_position}` : "รอจัดลำดับ"}</strong></div><div><span>ห้องตรวจ</span><strong>{queue?.room || "ยังไม่ระบุ"}</strong></div></div>
        <p className="last-updated" role={error ? "alert" : undefined}>{error || `อัปเดตล่าสุด ${updatedAt} น.`}</p>
        <button className="primary-button" type="button" onClick={() => void refresh()} disabled={loading}><span>อัปเดตสถานะ</span><i aria-hidden="true">{loading ? "↻" : "⟳"}</i></button>
        <button className="secondary-button" type="button" onClick={onAccount}>ดูข้อมูลและประวัติของฉัน</button>
      </div>
      <div className="notice-card"><strong>โปรดเก็บหน้านี้ไว้</strong><p>สถานะจะอัปเดตอัตโนมัติทุก 10 วินาที และสามารถกลับมาเปิดจากอุปกรณ์เครื่องเดิมได้</p></div>
    </section>
  );
}
