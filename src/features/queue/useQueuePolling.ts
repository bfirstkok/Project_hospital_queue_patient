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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch resolves asynchronously.
    void refresh();
    const timer = window.setInterval(() => void refresh(true), getRuntimeConfig().statusRefreshMs);
    return () => window.clearInterval(timer);
  }, [enabled, token, refresh]);

  return { queue, error, loading, initialLoading, refresh };
}
