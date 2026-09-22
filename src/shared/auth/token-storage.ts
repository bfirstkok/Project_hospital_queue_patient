export const TOKEN_STORAGE_KEY = "hospital_patient_access_token";

let inMemoryToken: string | null = null;

/**
 * Reads the cached access token for API authentication.
 *
 * Responsibilities:
 * 1. Checks in-memory cache (`inMemoryToken`) first.
 * 2. If running in a browser, reads from `sessionStorage` (with legacy `localStorage` fallback).
 *
 * @returns {string | null} Access token string, or null if unauthenticated.
 */
export function readToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;
  // Read from session storage or legacy local fallback
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Persists the access token after successful authentication.
 *
 * Responsibilities:
 * 1. Stores token in memory (`inMemoryToken`).
 * 2. Stores token in `sessionStorage` for enhanced security (automatically cleared on tab close).
 * 3. Removes any legacy token remnant from persistent `localStorage`.
 *
 * @param {string} token - Access token returned from authentication API.
 */
export function saveToken(token: string): void {
  inMemoryToken = token;
  if (typeof window === "undefined") return;
  try {
    // Cloud-first security: Store session-scoped only, clear persistent disk storage
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Clears the access token upon logout or session expiration.
 *
 * Responsibilities:
 * 1. Resets `inMemoryToken` to null.
 * 2. Purges token from both `sessionStorage` and `localStorage`.
 */
export function clearToken(): void {
  inMemoryToken = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
