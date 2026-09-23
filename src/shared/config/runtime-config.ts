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
          prompt?: (notification?: (notification: unknown) => void) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
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

/**
 * Retrieves the application's runtime configuration.
 *
 * Responsibilities:
 * 1. Checks if running in browser or SSR environment.
 * 2. Reads `API_BASE_URL` from `window.PATIENT_APP_ENV` (injected via runtime-config.js); falls back to current origin.
 * 3. Reads queue status refresh polling interval (`statusRefreshMs`), defaulting to 10,000 ms (10 seconds).
 * 4. Reads Google OAuth Client ID for Google Sign-In.
 *
 * @returns {RuntimeConfig} Object containing `apiBaseUrl`, `statusRefreshMs`, and `googleClientId`.
 */
export function getRuntimeConfig(): RuntimeConfig {
  const runtime = typeof window === "undefined" ? undefined : window.PATIENT_APP_ENV;
  const sameOriginApiBaseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const envClientId = typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "" : "";
  return {
    apiBaseUrl: String(runtime?.API_BASE_URL || sameOriginApiBaseUrl).trim().replace(/\/$/, ""),
    statusRefreshMs: Number(runtime?.STATUS_REFRESH_MS) || 10000,
    googleClientId: String(runtime?.GOOGLE_CLIENT_ID || envClientId).trim(),
  };
}
