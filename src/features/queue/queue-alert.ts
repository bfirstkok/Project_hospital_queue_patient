import type { QueueData } from "@/shared/api/types";

export function isQueueNearOrCalled(queue: Partial<QueueData> | null | undefined): boolean {
  if (!queue) return false;
  if (queue.status === "CALLED") return true;
  if (queue.status && queue.status !== "WAITING" && queue.status !== "WAITING_QUEUE") return false;

  const position = queue.queue_position;
  if (typeof position === "number" && position > 0 && position <= 3) return true;

  // Older API responses may provide only a label; "รอเรียก" is still waiting.
  return !queue.status && /กำลังเรียก|กรุณาเข้าห้องตรวจ|ถึงคิวของคุณ/.test(queue.status_label || "");
}
