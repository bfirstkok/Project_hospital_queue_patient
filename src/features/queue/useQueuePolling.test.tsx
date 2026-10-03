import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueuePolling } from "./useQueuePolling";

const queueResponse = (queueNumber = "Q-7") => new Response(JSON.stringify({
  ok: true, queue_number: queueNumber, status_label: "รอเรียก", instruction: "กรุณารอ", queue_position: 2, room: "1", updated_at: "2026-08-12T10:00:00Z",
}), { headers: { "content-type": "application/json" } });

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useQueuePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com", STATUS_REFRESH_MS: 10000 };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => queueResponse()));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.PATIENT_APP_ENV;
  });

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

  it("shares an unfinished request between polling and manual refreshes", async () => {
    const pending = deferredResponse();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useQueuePolling({ enabled: true, token: "token", onUnauthorized: vi.fn() }));
    let manualRefresh!: Promise<void>;
    act(() => { manualRefresh = result.current.refresh(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.resolve(queueResponse());
      await manualRefresh;
    });
    expect(result.current.queue?.queue_number).toBe("Q-7");
    expect(result.current.loading).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not restore a cancelled queue when an older poll completes", async () => {
    const pending = deferredResponse();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useQueuePolling({ enabled: true, token: "token", initialQueue: { queue_number: "Q-7" }, onUnauthorized: vi.fn() }));
    act(() => result.current.clearActiveQueue());
    await act(async () => { pending.resolve(queueResponse()); });
    expect(result.current.queue).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("discards a previous patient's response after the token changes", async () => {
    const pending = deferredResponse();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(queueResponse("Q-NEW"));
    const { result, rerender } = renderHook(({ token }) => useQueuePolling({ enabled: true, token, onUnauthorized: vi.fn() }), { initialProps: { token: "old-token" } });
    rerender({ token: "new-token" });
    await act(async () => {});
    expect(result.current.queue?.queue_number).toBe("Q-NEW");
    await act(async () => { pending.resolve(queueResponse("Q-OLD")); });
    expect(result.current.queue?.queue_number).toBe("Q-NEW");
  });

  it("does not expire the new session when an old request returns 401", async () => {
    const pending = deferredResponse();
    const onUnauthorized = vi.fn();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const { rerender } = renderHook(({ token }) => useQueuePolling({ enabled: true, token, onUnauthorized }), { initialProps: { token: "old-token" } });
    rerender({ token: "new-token" });
    await act(async () => {
      pending.resolve(new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "content-type": "application/json" } }));
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("aborts pending network work on unmount", () => {
    vi.mocked(fetch).mockReturnValueOnce(deferredResponse().promise);
    const { unmount } = renderHook(() => useQueuePolling({ enabled: true, token: "token", onUnauthorized: vi.fn() }));
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("clears patient data and ignores pending results when disabled", async () => {
    const pending = deferredResponse();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(({ enabled }) => useQueuePolling({ enabled, token: "token", initialQueue: { queue_number: "Q-7" }, onUnauthorized: vi.fn() }), { initialProps: { enabled: true } });
    rerender({ enabled: false });
    await act(async () => {
      pending.resolve(queueResponse());
      await result.current.refresh();
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(result.current.queue).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("continues polling after a network failure and clears its error on recovery", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useQueuePolling({ enabled: true, token: "token", onUnauthorized: vi.fn() }));
    await act(async () => {});
    expect(result.current.error).toBe("offline");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(result.current.error).toBe("");
    expect(result.current.queue?.queue_number).toBe("Q-7");
  });
});
