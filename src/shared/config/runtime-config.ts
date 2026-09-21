declare global {
  interface Window {
    PATIENT_APP_ENV?: {
      API_BASE_URL?: string;
      STATUS_REFRESH_MS?: number | string;
      GOOGLE_CLIENT_ID?: string;
    };
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
        };
      };
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
  const envClientId = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "" : "";
  return {
    apiBaseUrl: String(runtime?.API_BASE_URL || sameOriginApiBaseUrl).trim().replace(/\/$/, ""),
    statusRefreshMs: Number(runtime?.STATUS_REFRESH_MS) || 10000,
    googleClientId: String(runtime?.GOOGLE_CLIENT_ID || envClientId).trim(),
  };
}
