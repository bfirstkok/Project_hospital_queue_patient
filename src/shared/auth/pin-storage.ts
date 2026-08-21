export const PIN_STORAGE_KEY = "hospital_patient_security_pin";
export const PIN_ENABLED_KEY = "hospital_patient_pin_enabled";

export function readPin(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PIN_STORAGE_KEY);
}

export function savePin(pin: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIN_STORAGE_KEY, pin);
  window.localStorage.setItem(PIN_ENABLED_KEY, "true");
}

export function hasPin(): boolean {
  return Boolean(readPin());
}

export function isPinEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const enabled = window.localStorage.getItem(PIN_ENABLED_KEY);
  return enabled === "true" && hasPin();
}

export function setPinEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIN_ENABLED_KEY, enabled ? "true" : "false");
}

export function verifyPin(enteredPin: string): boolean {
  const saved = readPin();
  if (!saved) return false;
  return saved === enteredPin;
}

export function clearPin(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_STORAGE_KEY);
  window.localStorage.removeItem(PIN_ENABLED_KEY);
}
