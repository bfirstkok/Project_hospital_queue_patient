import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueueNotification } from "./useQueueNotification";
import type { QueueData } from "@/shared/api/types";

describe("useQueueNotification", () => {
  const vibrate = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vibrate.mockClear();
    vi.stubGlobal("navigator", { vibrate });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("does not announce a distant queue just because its label says waiting to be called", () => {
    const { result } = renderHook(() => useQueueNotification({ queue_number: "Q-7", status: "WAITING_QUEUE", status_label: "รอเรียกคิว", queue_position: 8 }));
    expect(result.current.alertActive).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it.each(["OPD_DONE", "DISCHARGED", "CANCELLED"])("does not alert for %s even if a stale position remains", (status) => {
    const { result } = renderHook(() => useQueueNotification({ queue_number: "Q-7", status, queue_position: 1 }));
    expect(result.current.alertActive).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("announces near and called queues once per state without relying on label wording", () => {
    const queue: Partial<QueueData> = { queue_number: "Q-7", status: "WAITING_QUEUE", queue_position: 3 };
    const { result, rerender } = renderHook(({ value }) => useQueueNotification(value), { initialProps: { value: queue } });
    expect(result.current.alertActive).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    rerender({ value: { ...queue, updated_at: "2026-10-03T00:00:00Z" } });
    expect(vibrate).toHaveBeenCalledTimes(1);
    rerender({ value: { ...queue, status: "CALLED", queue_position: null, status_label: "พบแพทย์" } });
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("clears the alert when the queue disappears", () => {
    const { result, rerender } = renderHook(({ queue }: { queue: Partial<QueueData> | null }) => useQueueNotification(queue), { initialProps: { queue: { queue_number: "Q-7", queue_position: 2 } as Partial<QueueData> | null } });
    expect(result.current.alertActive).toBe(true);
    rerender({ queue: null });
    expect(result.current.alertActive).toBe(false);
  });

  it("clears the alert when notifications are disabled", () => {
    const { result } = renderHook(() => useQueueNotification({ queue_number: "Q-7", queue_position: 2 }));
    act(() => result.current.toggleNotification());
    expect(result.current.enabled).toBe(false);
    expect(result.current.alertActive).toBe(false);
  });
});
