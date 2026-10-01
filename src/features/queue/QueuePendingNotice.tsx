import { useEffect, useRef, useState } from "react";
import { getPendingQueueMessage, getQueueAttention, hasUnpaidBill, needsQueueClosure, queueClosureMessage, type QueueAttentionSource } from "./pending-queue";

export function QueuePendingNotice({ queue, registeredAt }: { queue: QueueAttentionSource; registeredAt?: string | null }) {
  const reasons = getQueueAttention(queue);
  const unpaid = !["DISCHARGED", "CANCELLED"].includes(queue.status || "") && hasUnpaidBill(queue);
  const unclosed = needsQueueClosure(queue);
  const alertKey = `${queue.queue_number}-${unpaid ? "unpaid" : unclosed ? "unclosed" : "none"}`;
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousAlert = useRef("");
  const title = unpaid ? "แจ้งเตือนค้างชำระเงิน" : unclosed ? "แจ้งเตือนคิวยังไม่ปิด" : "คิวที่กำลังรับบริการ";
  const validDate = registeredAt && !Number.isNaN(Date.parse(registeredAt)) ? registeredAt : null;
  const dateText = validDate ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(new Date(validDate)) : null;

  useEffect(() => {
    if (previousAlert.current !== alertKey) {
      previousAlert.current = alertKey;
      setOpen(unpaid || unclosed);
    }
  }, [alertKey, unpaid, unclosed]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <div className="queue-pending-notice">
      {reasons.length > 0 && <div className="queue-attention" role="status">{reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}
      <button className="secondary-button" type="button" onClick={() => setOpen(true)}>
        ดูคิวที่กำลังรับบริการ {queue.queue_number}{dateText && ` · ${dateText}`}
      </button>
      <dialog ref={dialogRef} className="queue-pending-dialog" aria-labelledby="queuePendingTitle" onCancel={() => setOpen(false)}>
        <h2 id="queuePendingTitle">{title}</h2>
        <p>คิว {queue.queue_number}{validDate && <> · รับบริการวันที่ <time dateTime={validDate}>{dateText}</time></>}</p>
        <p>{unclosed ? queueClosureMessage : getPendingQueueMessage(queue)}</p>
        <button className="primary-button" type="button" autoFocus onClick={() => setOpen(false)}>รับทราบและดูคิวเดิม</button>
      </dialog>
    </div>
  );
}
