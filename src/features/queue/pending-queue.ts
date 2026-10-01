import type { QueueData, Visit } from "@/shared/api/types";

const activeStatuses = new Set([
  "WAITING_VITALS", "WAITING_CONFIRMATION", "WAITING_QUEUE", "WAITING", "CALLED",
  "MONITORING", "OBSERVATION_MONITORING", "REASSESSMENT_REQUIRED",
  "EMERGENCY_TRANSFER", "OPD_DONE", "FOLLOWUP",
]);

export const queueClosureMessage = "ขั้นตอนห้องยาและการเงินครบแล้ว แต่คิวยังไม่ปิด กรุณาติดต่อเจ้าหน้าที่เพื่อปิดคิว";

export function isPendingVisit(visit: Pick<Visit, "status">): boolean {
  return activeStatuses.has(visit.status || "");
}

export function getPendingQueueMessage(queue: Pick<QueueData, "patient_journey">): string {
  const billing = queue.patient_journey?.steps.find((step) => step.key === "billing");
  if (billing?.state === "current" && billing.detail === "รอชำระเงิน") {
    return "คุณยังไม่ชำระเงินสำหรับคิวนี้ กรุณาชำระเงินที่จุดการเงินก่อนจองคิวใหม่";
  }
  if (billing?.state === "current" && billing.detail === "รอสรุปค่าใช้จ่าย") {
    return "คิวนี้อยู่ระหว่างสรุปค่าใช้จ่าย กรุณาติดต่อจุดการเงิน ยังไม่สามารถจองคิวใหม่ได้";
  }
  return "คุณมีคิวรับบริการที่ยังไม่เสร็จสิ้น กรุณาดำเนินการคิวเดิมให้ครบก่อนจองคิวใหม่ หากดำเนินการครบแล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อปิดคิว";
}

export function needsQueueClosure(queue: QueueAttentionSource | null | undefined): boolean {
  if (!queue?.queue_number || !activeStatuses.has(queue.status || "")) return false;
  const steps = queue.patient_journey?.steps || [];
  const finished = (key: string) => steps.some((step) => step.key === key && ["done", "skipped"].includes(step.state));
  return finished("billing") && finished("pharmacy");
}

export function hasUnpaidBill(queue: Pick<QueueData, "patient_journey">): boolean {
  const billing = queue.patient_journey?.steps.find((step) => step.key === "billing");
  return billing?.state === "current" && billing.detail === "รอชำระเงิน";
}

export type QueueAttentionSource = {
  queue_number?: string | null;
  status?: string | null;
  patient_journey?: QueueData["patient_journey"];
};

export function getQueueAttention(queue: QueueAttentionSource | null | undefined): string[] {
  if (!queue?.queue_number || ["DISCHARGED", "CANCELLED"].includes(queue.status || "")) return [];
  const steps = queue.patient_journey?.steps || [];
  const pharmacy = steps.find((step) => step.key === "pharmacy");
  const billing = steps.find((step) => step.key === "billing");
  const reasons: string[] = [];

  if (queue.status === "CALLED") reasons.push("ถึงคิวตรวจแล้ว กรุณาเข้าห้องตรวจ");
  if (pharmacy?.state === "current") reasons.push("ยังไม่ได้รับยาตามคิว กรุณาติดต่อห้องยา");
  if (billing?.state === "current" && billing.detail === "รอชำระเงิน") {
    reasons.push("ยังไม่ได้ชำระเงิน กรุณาติดต่อจุดการเงิน");
  }
  if (needsQueueClosure(queue)) reasons.push(queueClosureMessage);
  return reasons;
}
