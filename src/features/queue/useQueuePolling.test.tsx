import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueuePolling } from "./useQueuePolling";

describe("useQueuePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com", STATUS_REFRESH_MS: 10000 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, queue_number: "Q-7", status_label: "รอเรียก", instruction: "กรุณารอ", queue_position: 2, room: "1", updated_at: "2026-08-12T10:00:00Z",
    }), { headers: { "content-type": "application/json" } })));
  });

  afterEach(() => vi.useRealTimers());

  it("fetches immediately, repeats at the configured 10-second interval, and cleans up", async () => {
    const { result, unmount } = renderHook(() => useQueuePolling({ enabled: true, token: "token", onUnauthorized: vi.fn() }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.queue?.queue_number).toBe("Q-7");
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
