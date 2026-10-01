import type { PatientJourney } from "@/shared/api/types";

interface QueueHistoryProps {
  journey?: PatientJourney | null;
  registeredAt?: string | null;
  statusLabel?: string;
}

function recordedTime(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function QueueTime({ date }: { date: Date | null }) {
  return date
    ? <time dateTime={date.toISOString()}>{timeFormat.format(date)} น.</time>
    : <span>ยังไม่มีข้อมูลเวลา</span>;
}

export function QueueHistory({ journey, registeredAt, statusLabel }: QueueHistoryProps) {
  const startedAt = recordedTime(journey?.steps?.find((step) => step.key === "registration")?.timestamp)
    || recordedTime(registeredAt);
  const history = (journey?.steps || [])
    .filter((step) => ["done", "current", "cancelled"].includes(step.state))
    .flatMap((step) => {
      const date = recordedTime(step.timestamp);
      return date ? [{
        key: step.key,
        label: step.key === "registration" || !step.detail ? step.label : `${step.label} · ${step.detail}`,
        date,
      }] : [];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = history.at(-1);

  return (
    <div className="queue-history">
      <div className="queue-timestamps">
        <p><strong>เริ่มรับคิว:</strong> <QueueTime date={startedAt} /></p>
        <p><strong>สถานะคิวจุดล่าสุด:</strong> {latest?.label || statusLabel || "รอข้อมูลสถานะ"}: <QueueTime date={latest?.date || null} /></p>
      </div>
      {history.length > 0 && (
        <details className="queue-history-details">
          <summary>ประวัติคิว</summary>
          <ol aria-label="ประวัติคิว">
            {history.map((entry) => (
              <li key={entry.key}><span>{entry.label}</span><QueueTime date={entry.date} /></li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
