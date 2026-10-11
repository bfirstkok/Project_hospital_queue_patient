import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.useRealTimers());

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

  it("includes recorded dates when stations cross midnight in Bangkok even on one UTC date", () => {
    render(createElement(QueueHistory, {
      journey: { steps: [
        { key: "registration", label: "ลงทะเบียน", state: "done", detail: "", timestamp: "2026-10-01T16:50:00Z" },
        { key: "pharmacy", label: "ห้องยา", state: "done", detail: "จ่ายยาแล้ว", timestamp: "2026-10-01T17:10:40Z" },
      ] },
    }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("01/10/2569 · 23:50:00 น.");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("ห้องยา · จ่ายยาแล้ว: 02/10/2569 · 00:10:40 น.");
    const entries = within(screen.getByRole("list", { name: "ประวัติคิว" })).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("01/10/2569 · 23:50:00 น.");
    expect(entries[1]).toHaveTextContent("02/10/2569 · 00:10:40 น.");
    expect(entries[1].querySelector("time")).toHaveAttribute("datetime", "2026-10-01T17:10:40.000Z");
  });

  it("keeps same-Bangkok-day times compact even when timestamps cross UTC midnight", () => {
    render(createElement(QueueHistory, {
      journey: { steps: [
        { key: "registration", label: "ลงทะเบียน", state: "done", detail: "", timestamp: "2026-10-01T23:00:00Z" },
        { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว", timestamp: "2026-10-02T01:30:00Z" },
      ] },
    }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("06:00:00 น.");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · ชำระแล้ว: 08:30:00 น.");
    expect(document.querySelector(".queue-history")).not.toHaveTextContent("02/10/2569");
  });

  it("uses the recorded registration fallback to distinguish a later-day station", () => {
    render(createElement(QueueHistory, {
      registeredAt: "2026-10-01T11:00:00Z",
      journey: { steps: [
        { key: "registration", label: "ลงทะเบียน", state: "done", detail: "", timestamp: null },
        { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว", timestamp: "2026-10-02T11:30:00Z" },
      ] },
    }));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("01/10/2569 · 18:00:00 น.");
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("02/10/2569 · 18:30:00 น.");
  });

  it("keeps reached stations without timestamps visible and does not borrow another station time", () => {
    render(createElement(QueueHistory, {
      journey: { steps: [
        journey.steps[0],
        { key: "vitals", label: "วัดสัญญาณชีพ", state: "done", detail: "บันทึกแล้ว", timestamp: null },
        { key: "doctor", label: "ห้องตรวจ", state: "current", detail: "กำลังตรวจ" },
      ] },
    }));
    const entries = within(screen.getByRole("list", { name: "ประวัติคิว" })).getAllByRole("listitem");
    expect(entries).toHaveLength(3);
    expect(entries[1]).toHaveTextContent("วัดสัญญาณชีพ · บันทึกแล้ว");
    expect(entries[2]).toHaveTextContent("ห้องตรวจ · กำลังตรวจ");
    expect(within(entries[1]).getByText("ยังไม่มีข้อมูลเวลา")).toBeInTheDocument();
    expect(within(entries[2]).getByText("ยังไม่มีข้อมูลเวลา")).toBeInTheDocument();
    expect(entries[1].querySelector("time")).toBeNull();
    expect(entries[2].querySelector("time")).toBeNull();
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("ห้องตรวจ · กำลังตรวจ: ยังไม่มีข้อมูลเวลา");
  });

  it("replaces missing station time only when the backend supplies its recorded timestamp", () => {
    const missingJourney: PatientJourney = { steps: [journey.steps[0], { ...journey.steps[1], timestamp: null }] };
    const { rerender } = render(createElement(QueueHistory, { journey: missingJourney }));
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · ชำระแล้ว: ยังไม่มีข้อมูลเวลา");
    rerender(createElement(QueueHistory, { journey: { steps: [journey.steps[0], journey.steps[1]] } }));
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · ชำระแล้ว: 18:30:00 น.");
  });

  it("never turns the browser clock or a refresh into a station timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T05:45:12Z"));
    const missingJourney: PatientJourney = { steps: [
      journey.steps[0],
      { key: "billing", label: "การเงิน", state: "current", detail: "รอชำระ", timestamp: null },
    ] };
    const { rerender } = render(createElement(QueueHistory, { journey: missingJourney }));
    const historyBeforeRefresh = document.querySelector(".queue-history")?.textContent;
    vi.setSystemTime(new Date("2026-10-11T08:15:59Z"));
    rerender(createElement(QueueHistory, { journey: { ...missingJourney } }));
    expect(document.querySelector(".queue-history")?.textContent).toBe(historyBeforeRefresh);
    expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · รอชำระ: ยังไม่มีข้อมูลเวลา");
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("18:00:00 น.");
  });
});
