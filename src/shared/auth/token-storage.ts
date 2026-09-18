export const TOKEN_STORAGE_KEY = "hospital_patient_access_token";

let inMemoryToken: string | null = null;

export function readToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;
  // Read from session storage or legacy local fallback
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

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
