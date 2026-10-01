import { describe, expect, it } from "vitest";
import { getPendingQueueMessage, getQueueAttention, hasUnpaidBill, isPendingVisit, needsQueueClosure } from "./pending-queue";

describe("pending queues", () => {
  it("keeps an old post-exam queue pending until discharge", () => {
    expect(isPendingVisit({ status: "OPD_DONE" })).toBe(true);
    expect(isPendingVisit({ status: "DISCHARGED" })).toBe(false);
    expect(isPendingVisit({ status: "CANCELLED" })).toBe(false);
    expect(isPendingVisit({})).toBe(false);
  });

  it("distinguishes an unpaid bill from a bill still being prepared", () => {
    const journey = (detail: string) => ({ steps: [{ key: "billing", label: "การเงิน", state: "current" as const, detail }] });
    expect(getPendingQueueMessage({ patient_journey: journey("รอชำระเงิน") })).toContain("กรุณาชำระเงิน");
    expect(hasUnpaidBill({ patient_journey: journey("รอชำระเงิน") })).toBe(true);
    expect(hasUnpaidBill({ patient_journey: journey("รอสรุปค่าใช้จ่าย") })).toBe(false);
    expect(hasUnpaidBill({ patient_journey: { steps: [{ key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว" }] } })).toBe(false);
    expect(getPendingQueueMessage({ patient_journey: journey("รอสรุปค่าใช้จ่าย") })).not.toContain("กรุณาชำระเงิน");
    expect(getPendingQueueMessage({})).toContain("ยังไม่เสร็จสิ้น");
  });

  it("shows the next action when a patient is called, waiting for medicine, or unpaid", () => {
    const journey = (detail: string) => ({ steps: [{ key: "billing", label: "การเงิน", state: "current" as const, detail }] });
    expect(getQueueAttention({ queue_number: "A012", status: "CALLED" })).toContain("ถึงคิวตรวจแล้ว กรุณาเข้าห้องตรวจ");
    expect(getQueueAttention({ queue_number: "A012", patient_journey: { steps: [{ key: "pharmacy", label: "ห้องยา", state: "current", detail: "รอรับยา" }] } })).toContain("ยังไม่ได้รับยาตามคิว กรุณาติดต่อห้องยา");
    expect(getQueueAttention({ queue_number: "A012", patient_journey: journey("รอชำระเงิน") })).toContain("ยังไม่ได้ชำระเงิน กรุณาติดต่อจุดการเงิน");
    expect(getQueueAttention({ status: "CALLED" })).toEqual([]);
  });

  it("warns that a paid and dispensed visit is still waiting for staff to close it", () => {
    const queue = { queue_number: "A012", status: "OPD_DONE", patient_journey: { steps: [
      { key: "billing", label: "การเงิน", state: "done" as const, detail: "ชำระแล้ว" },
      { key: "pharmacy", label: "ห้องยา", state: "done" as const, detail: "จ่ายยาแล้ว" },
      { key: "complete", label: "ออกจากโรงพยาบาล", state: "current" as const, detail: "รอปิด Visit" },
    ] } };
    expect(getQueueAttention(queue)).toContain("ขั้นตอนห้องยาและการเงินครบแล้ว แต่คิวยังไม่ปิด กรุณาติดต่อเจ้าหน้าที่เพื่อปิดคิว");
    expect(getQueueAttention({ ...queue, status: "DISCHARGED" })).toEqual([]);
    expect(getQueueAttention({ ...queue, status: "CANCELLED" })).toEqual([]);
    expect(needsQueueClosure({ ...queue, patient_journey: { steps: queue.patient_journey.steps.map((step) => ({ ...step, state: "done" })) } })).toBe(true);
  });
});
