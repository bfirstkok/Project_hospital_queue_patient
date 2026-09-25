import type { PatientJourney } from "@/shared/api/types";

export const queueProgressSteps = [
  { key: "registration", label: "จองคิว" },
  { key: "vitals", label: "ตรวจร่างกาย" },
  { key: "queue", label: "รอห้องตรวจ" },
  { key: "doctor", label: "เข้าตรวจ" },
  { key: "billing", label: "ชำระเงิน" },
  { key: "pharmacy", label: "จ่ายยา" },
  { key: "complete", label: "เสร็จสิ้น" },
] as const;

export type QueueProgressState = "done" | "current" | "pending" | "skipped" | "cancelled" | "unknown";

export interface QueueProgressStep {
  key: string;
  label: string;
  state: QueueProgressState;
  detail?: string;
}

export interface QueueProgressModel {
  steps: QueueProgressStep[];
  completed: boolean;
  progressIndex: number;
  heading: string;
  caption: string;
  needsDownstreamStatus: boolean;
  downstreamStatus: string;
}

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

export function getQueueProgressModel(status?: string | null, journey?: PatientJourney | null): QueueProgressModel {
  const backendSteps = new Map(journey?.steps?.map((step) => [step.key, step]));
  const fallbackStep = currentClinicalStep(status || undefined);
  const afterExam = status === "OPD_DONE" || status === "DISCHARGED";
  const steps = queueProgressSteps.map<QueueProgressStep>(({ key, label }, index) => {
    const backendStep = backendSteps.get(key);
    let state: QueueProgressState;

    if (backendStep) state = backendStep.state;
    else if (index < 4) {
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
  const progressIndex = firstUnfinishedIndex < 0
    ? steps.length - 1
    : steps[firstUnfinishedIndex].state === "current" ? firstUnfinishedIndex : Math.max(0, firstUnfinishedIndex - 1);
  const currentLabel = currentIndex >= 0 ? steps[currentIndex].label : "";
  const needsDownstreamStatus = steps[3].state === "done"
    || steps.slice(4, 6).some((step) => step.state === "current" || step.state === "done");
  let heading = currentLabel ? `ตอนนี้: ${currentLabel}` : "ตรวจเสร็จแล้ว · รอสถานะขั้นตอนถัดไป";
  let caption = currentLabel
    ? `ขั้นตอนที่ ${currentIndex + 1} จาก ${queueProgressSteps.length} · กำลังดำเนินการ`
    : "รอข้อมูลการเงินและห้องยาจากโรงพยาบาล";

  if (journey?.current_label) heading = `ตอนนี้: ${journey.current_label}`;
  if (journey?.current_detail) caption = journey.current_detail;
  if (completed) heading = "เสร็จสิ้นการรับบริการ";
  if (completed && !journey?.current_detail) caption = "ดำเนินการเสร็จแล้ว";

  const downstreamStatus = journey
    ? steps.slice(4, 6)
      .map((step) => `${step.label}: ${step.detail || (step.state === "skipped" ? "ไม่ต้องดำเนินการ" : "รอข้อมูล")}`)
      .join(" · ")
    : completed
      ? "สถานะชำระเงินและจ่ายยา: โรงพยาบาลยังไม่ส่งรายละเอียดแยก"
      : "สถานะชำระเงินและจ่ายยา: รอข้อมูลจากโรงพยาบาล";

  return {
    steps,
    completed,
    progressIndex,
    heading,
    caption,
    needsDownstreamStatus,
    downstreamStatus,
  };
}
