export const TOKEN_STORAGE_KEY = "hospital_patient_access_token";

export function readToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function saveToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}
