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

const CANCELLED_QUEUE_KEY = "opd_cancelled_queue_number";

export function useQueuePolling({ enabled, token, initialQueue, onUnauthorized }: UseQueuePollingOptions) {
  const [queue, setQueue] = useState<Partial<QueueData> | null>(() => {
    if (typeof window !== "undefined") {
      const cancelled = sessionStorage.getItem(CANCELLED_QUEUE_KEY);
      if (cancelled && initialQueue?.queue_number === cancelled) return null;
    }
    return initialQueue || null;
  });
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
      const cancelled = typeof window !== "undefined" ? sessionStorage.getItem(CANCELLED_QUEUE_KEY) : null;
      if (cancelled && data?.queue_number === cancelled) {
        setQueue(null);
      } else {
        if (cancelled && data?.queue_number && data.queue_number !== cancelled) {
          sessionStorage.removeItem(CANCELLED_QUEUE_KEY);
        }
        setQueue(data);
      }
      setError("");
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : new ApiError(reason instanceof Error ? reason.message : "ไม่สามารถอัปเดตสถานะได้");
      if (apiError.status === 401) onUnauthorizedRef.current();
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

  const clearActiveQueue = useCallback((queueNumber?: string) => {
    if (queueNumber && typeof window !== "undefined") {
      sessionStorage.setItem(CANCELLED_QUEUE_KEY, queueNumber);
    }
    setQueue(null);
  }, []);

  return { queue, error, loading, initialLoading, refresh, clearActiveQueue };
}
