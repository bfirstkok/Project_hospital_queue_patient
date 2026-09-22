import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, patientApi } from "@/shared/api/patient-api";
import type { QueueData } from "@/shared/api/types";
import { getRuntimeConfig } from "@/shared/config/runtime-config";

interface UseQueuePollingOptions {
  enabled: boolean;
  token: string;
  initialQueue?: Partial<QueueData> | null;
  onUnauthorized: () => void;
}

/**
 * Custom hook for periodic background polling of patient queue status.
 *
 * Responsibilities:
 * 1. Fetches queue data immediately upon initialization.
 * 2. Establishes a timer-based polling cycle via `setInterval` using `statusRefreshMs` from runtime config.
 * 3. Performs silent background refreshes to prevent UI flickering.
 * 4. Detects HTTP 401 Unauthorized errors and invokes `onUnauthorized` callback for re-authentication.
 * 5. Handles HTTP 404 cleanly by clearing active queue state.
 *
 * @param {UseQueuePollingOptions} options - Polling configuration options.
 * @returns Object containing `{ queue, error, loading, initialLoading, refresh, clearActiveQueue }`.
 */
export function useQueuePolling({ enabled, token, initialQueue, onUnauthorized }: UseQueuePollingOptions) {
  const [queue, setQueue] = useState<Partial<QueueData> | null>(initialQueue || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(enabled && token && !initialQueue));
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const refresh = useCallback(async (silent = false) => {
    if (!token) {
      setInitialLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await patientApi.queue(token);
      setQueue(data);
      setError("");
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถอัปเดตสถานะได้");
      if (apiError.status === 401) onUnauthorizedRef.current();
      else if (apiError.status === 404) {
        setQueue(null);
        setError("");
      }
      else setError(apiError.message);
    } finally {
      if (!silent) setLoading(false);
      setInitialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!enabled || !token) {
      setInitialLoading(false);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(true), getRuntimeConfig().statusRefreshMs);
    return () => window.clearInterval(timer);
  }, [enabled, token, refresh]);

  const clearActiveQueue = useCallback(() => {
    setQueue(null);
  }, []);

  return { queue, error, loading, initialLoading, refresh, clearActiveQueue };
}
