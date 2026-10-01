import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PatientJourney } from "@/shared/api/types";
import { QueueHistory } from "./QueueHistory";

const journey = {
  steps: [
    { key: "registration", label: "ลงทะเบียน", state: "done", detail: "ลงทะเบียนแล้ว", timestamp: "2026-10-01T11:00:00Z" },
    { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว", timestamp: "2026-10-01T11:30:00Z" },
    { key: "pharmacy", label: "ห้องยา", state: "done", detail: "จ่ายยาแล้ว", timestamp: "2026-10-01T11:20:40Z" },
    { key: "complete", label: "ออกจากโรงพยาบาล", state: "pending", detail: "รอปิด Visit", timestamp: null },
  ],
} satisfies PatientJourney;

describe("QueueHistory", () => {
  it("keeps the registration time and selects the latest recorded station by time", () => {
    const { rerender } = render(createElement(QueueHistory, { journey, statusLabel: "รอปิด Visit" }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("18:00:00 น.");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · ชำระแล้ว: 18:30:00 น.");
    const history = within(screen.getByRole("list", { name: "ประวัติคิว" })).getAllByRole("listitem");
    expect(history.map((item) => item.textContent)).toEqual([
      "ลงทะเบียน18:00:00 น.",
      "ห้องยา · จ่ายยาแล้ว18:20:40 น.",
      "การเงิน · ชำระแล้ว18:30:00 น.",
    ]);
    rerender(createElement(QueueHistory, { journey: { ...journey }, statusLabel: "รอปิด Visit" }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("18:00:00 น.");
  });

  it("updates the latest station when medicine is dispensed after payment", () => {
    render(createElement(QueueHistory, {
      journey: { steps: journey.steps.map((step) => step.key === "pharmacy" ? { ...step, timestamp: "2026-10-01T11:40:00Z" } : step) },
      statusLabel: "รอปิด Visit",
    }));
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("ห้องยา · จ่ายยาแล้ว: 18:40:00 น.");
  });

  it("shows missing timestamps honestly and excludes invalid, pending, or skipped records", () => {
    render(createElement(QueueHistory, {
      journey: { steps: journey.steps.map((step) => ({ ...step, timestamp: "invalid" })) },
      statusLabel: "รอรับยา",
    }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("ยังไม่มีข้อมูลเวลา");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("รอรับยา: ยังไม่มีข้อมูลเวลา");
    expect(screen.queryByRole("list", { name: "ประวัติคิว" })).not.toBeInTheDocument();
  });

  it("uses the visit registration timestamp when journey timestamps are unavailable", () => {
    render(createElement(QueueHistory, { registeredAt: "2026-10-01T11:00:00Z", statusLabel: "รอวัดสัญญาณชีพ" }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("18:00:00 น.");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("รอวัดสัญญาณชีพ: ยังไม่มีข้อมูลเวลา");
  });

  it("does not treat pending or skipped service stages as reached stations", () => {
    render(createElement(QueueHistory, {
      journey: { steps: journey.steps.map((step) => step.key === "registration" ? step : {
        ...step, state: step.key === "billing" ? "skipped" as const : "pending" as const, timestamp: "2026-10-01T15:00:00Z",
      }) },
    }));
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("ลงทะเบียน: 18:00:00 น.");
    expect(within(screen.getByRole("list", { name: "ประวัติคิว" })).getAllByRole("listitem")).toHaveLength(1);
  });
});
