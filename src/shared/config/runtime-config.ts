declare global {
  interface Window {
    PATIENT_APP_ENV?: {
      API_BASE_URL?: string;
      STATUS_REFRESH_MS?: number | string;
      GOOGLE_CLIENT_ID?: string;
    };
  }
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  statusRefreshMs: number;
  googleClientId: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  const runtime = typeof window === "undefined" ? undefined : window.PATIENT_APP_ENV;
  const sameOriginApiBaseUrl = typeof window === "undefined" ? "" : window.location.origin;
  return {
    apiBaseUrl: String(runtime?.API_BASE_URL || sameOriginApiBaseUrl).trim().replace(/\/$/, ""),
    statusRefreshMs: Number(runtime?.STATUS_REFRESH_MS) || 10000,
    googleClientId: String(runtime?.GOOGLE_CLIENT_ID || "").trim(),
  };
}
