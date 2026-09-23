export const PIN_STORAGE_KEY = "hospital_patient_security_pin";
export const PIN_ENABLED_KEY = "hospital_patient_pin_enabled";
export const PIN_ATTEMPTS_KEY = "hospital_patient_pin_attempts";
export const PIN_LOCKOUT_UNTIL_KEY = "hospital_patient_pin_lockout_until";
export const PIN_LOCKOUT_LEVEL_KEY = "hospital_patient_pin_lockout_level";
export const PAIRED_PATIENT_KEY = "hospital_patient_paired_info";

export const MAX_FAILED_ATTEMPTS = 3;
/**
 * Each run of MAX_FAILED_ATTEMPTS wrong PINs triggers the next tier: 1 min, then
 * 5 min, then 30 min (last tier repeats). The escalation level survives clearPin
 * (re-logging in with the national ID does NOT reset a lockout); only a correct
 * PIN entry clears it.
 *
 * Note: this is a client-side deterrent only — the real gate is the server-side
 * PIN store described in docs/BACKEND_HANDOFF.md §3 (pin/verify).
 */
export const LOCKOUT_TIERS_SECONDS = [60, 300, 1800];

/**
 * Calculates lockout duration in seconds based on escalation level.
 *
 * @param {number} level - Lockout escalation tier (0 = 60s, 1 = 300s, 2 = 1800s).
 * @returns {number} Wait time in seconds.
 */
function lockoutSecondsForLevel(level: number): number {
  return LOCKOUT_TIERS_SECONDS[Math.min(Math.max(level, 0), LOCKOUT_TIERS_SECONDS.length - 1)];
}

const SALT = "hospital_patient_pin_salt_v1:";

/**
 * Hashes a 6-digit PIN using salted SHA-256 algorithm.
 * Prevents storing plaintext PINs in client-side storage.
 *
 * @param {string} pin - 6-digit PIN entered by user.
 * @returns {string} 64-character hexadecimal SHA-256 hash.
 */
export function hashPin(pin: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const ascii = SALT + pin;
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = candidate * candidate; i < 312; i += candidate) {
        isComposite[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii.length; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? (w[i] ?? 0) | 0
            : ((w[i - 16] ?? 0) +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                (w[i - 7] ?? 0) +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates local storage key for PIN data scoped to patient's national ID.
 *
 * @param {string} [nationalId] - 13-digit Thai national ID.
 * @returns {string} Storage key string.
 */
export function getPinKey(nationalId?: string): string {
  if (nationalId && nationalId.trim()) {
    return `hospital_patient_pin_${nationalId.trim()}`;
  }
  return PIN_STORAGE_KEY;
}

/**
 * Reads stored PIN hash from browser storage.
 *
 * @param {string} [nationalId] - Patient national ID.
 * @returns {string | null} Stored PIN hash, or null if unconfigured.
 */
export function readPin(nationalId?: string): string | null {
  if (typeof window === "undefined") return null;
  if (nationalId && nationalId.trim()) {
    const patientPin = window.localStorage.getItem(getPinKey(nationalId));
    if (patientPin) return patientPin;
  }
  return window.localStorage.getItem(PIN_STORAGE_KEY);
}

/**
 * Stores a new hashed PIN for the patient.
 * Automatically enables PIN protection and clears current lockout state.
 *
 * @param {string} pin - 6-digit numeric PIN.
 * @param {string} [nationalId] - Associated patient national ID.
 */
export function savePin(pin: string, nationalId?: string): void {
  if (typeof window === "undefined") return;
  const hashed = hashPin(pin);
  if (nationalId && nationalId.trim()) {
    window.localStorage.setItem(getPinKey(nationalId), hashed);
  }
  window.localStorage.setItem(PIN_STORAGE_KEY, hashed);
  window.localStorage.setItem(PIN_ENABLED_KEY, "true");
  clearActiveLockout();
}

/**
 * Checks whether a PIN is configured for the given patient.
 *
 * @param {string} [nationalId] - Patient national ID.
 * @returns {boolean} True if PIN exists in storage.
 */
export function hasPin(nationalId?: string): boolean {
  return Boolean(readPin(nationalId));
}

/**
 * Checks whether PIN authentication is globally enabled and a PIN exists.
 *
 * @returns {boolean} True if enabled and PIN exists.
 */
export function isPinEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const enabled = window.localStorage.getItem(PIN_ENABLED_KEY);
  return enabled === "true" && hasPin();
}

/**
 * Toggles PIN authentication enabled flag.
 *
 * @param {boolean} enabled - True to enable, false to disable.
 */
export function setPinEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIN_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * Reads cumulative failed PIN attempts in the current lockout cycle.
 *
 * @returns {number} Count of failed attempts.
 */
export function getFailedAttempts(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(PIN_ATTEMPTS_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

/**
 * Calculates remaining allowed failed attempts before lockout triggers.
 *
 * @returns {number} Remaining attempts (0 to 3).
 */
export function getRemainingAttempts(): number {
  const attempts = getFailedAttempts();
  return Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
}

/**
 * Reads the current lockout escalation level for calculating penalty duration.
 *
 * @returns {number} Tier index (0-indexed).
 */
export function getLockoutLevel(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(PIN_LOCKOUT_LEVEL_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

/**
 * Gets duration in seconds for the next lockout penalty (1m -> 5m -> 30m).
 *
 * @returns {number} Penalty duration in seconds.
 */
export function getNextLockoutSeconds(): number {
  return lockoutSecondsForLevel(getLockoutLevel());
}

/**
 * Calculates remaining active lockout duration in seconds.
 * Automatically clears expired lockout timestamp while preserving escalation tier.
 *
 * @returns {number} Remaining seconds in lockout (0 if not locked out).
 */
export function getLockoutRemainingSeconds(): number {
  if (typeof window === "undefined") return 0;
  const lockoutUntil = window.localStorage.getItem(PIN_LOCKOUT_UNTIL_KEY);
  if (!lockoutUntil) return 0;
  const until = parseInt(lockoutUntil, 10);
  const now = Date.now();
  if (now >= until) {
    // Lockout window expired: reset the attempt counter but KEEP the escalation level.
    window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
    window.localStorage.setItem(PIN_ATTEMPTS_KEY, "0");
    return 0;
  }
  return Math.ceil((until - now) / 1000);
}

/**
 * Checks whether the user is currently locked out from entering a PIN.
 *
 * @returns {boolean} True if lockout is active.
 */
export function isLockedOut(): boolean {
  return getLockoutRemainingSeconds() > 0;
}

/**
 * Resets all lockout and failure counters upon successful PIN entry.
 */
export function resetLockout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_ATTEMPTS_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_LEVEL_KEY);
}

/**
 * Clears current cycle failure counters while preserving lockout escalation tier.
 */
export function clearActiveLockout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_ATTEMPTS_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
}

/**
 * Records a failed PIN attempt.
 * Triggers a timed lockout when threshold reaches `MAX_FAILED_ATTEMPTS` (3).
 */
export function recordFailedAttempt(): void {
  if (typeof window === "undefined") return;
  const current = getFailedAttempts() + 1;
  window.localStorage.setItem(PIN_ATTEMPTS_KEY, current.toString());
  if (current >= MAX_FAILED_ATTEMPTS) {
    const level = getLockoutLevel();
    const until = Date.now() + lockoutSecondsForLevel(level) * 1000;
    window.localStorage.setItem(PIN_LOCKOUT_UNTIL_KEY, until.toString());
    window.localStorage.setItem(PIN_LOCKOUT_LEVEL_KEY, String(level + 1));
  }
}

/**
 * Verifies entered PIN against stored salted hash.
 *
 * Flow:
 * 1. Checks lockout status; rejects immediately if locked out.
 * 2. Hashes input and compares with stored hash (or legacy plaintext).
 * 3. On success: calls `resetLockout()`, upgrades legacy plaintext if needed, returns true.
 * 4. On failure: calls `recordFailedAttempt()`, returns false.
 *
 * @param {string} enteredPin - PIN entered by patient.
 * @param {string} [nationalId] - Patient national ID.
 * @returns {boolean} True if PIN matches and user is not locked out.
 */
export function verifyPin(enteredPin: string, nationalId?: string): boolean {
  if (isLockedOut()) {
    return false;
  }

  const saved = readPin(nationalId);
  if (!saved) return false;

  const enteredHash = hashPin(enteredPin);
  // Match either hashed pin or legacy plain-text pin
  const isMatch = saved === enteredHash || saved === enteredPin;

  if (isMatch) {
    resetLockout();
    // Auto-migrate legacy plain text to hash if needed
    if (saved === enteredPin) {
      savePin(enteredPin, nationalId);
    }
    return true;
  } else {
    recordFailedAttempt();
    return false;
  }
}

/**
 * Removes PIN credentials from device storage.
 * Note: Does not reset lockout tier to prevent bypass via re-login.
 *
 * @param {string} [nationalId] - Patient national ID.
 */
export function clearPin(nationalId?: string): void {
  if (typeof window === "undefined") return;
  if (nationalId && nationalId.trim()) {
    window.localStorage.removeItem(getPinKey(nationalId));
  }
  window.localStorage.removeItem(PIN_STORAGE_KEY);
  window.localStorage.removeItem(PIN_ENABLED_KEY);
  // Intentionally NOT clearing the lockout: signing back in with the national ID
  // must not let a locked-out user skip the wait.
}

export const hasPinForPatient = hasPin;
export const savePinForPatient = savePin;
export const verifyPinForPatient = verifyPin;
export const clearPinForPatient = clearPin;

export interface PairedPatientInfo {
  name: string;
  nationalId: string;
  maskedId?: string;
  /** Registered contact channels, cached from /me so PIN recovery can target them without re-typing. */
  phone?: string;
  email?: string;
}

let inMemoryPairedPatient: PairedPatientInfo | null = null;

/**
 * Caches paired patient identity temporarily in sessionStorage.
 *
 * Prevents Personally Identifiable Information (PII) leakage by avoiding permanent disk storage.
 * Data remains active only during the browser session.
 *
 * @param {PairedPatientInfo} info - Patient profile info (name, nationalId, phone, email).
 */
export function savePairedPatient(info: PairedPatientInfo): void {
  inMemoryPairedPatient = info;
  if (typeof window === "undefined") return;
  try {
    // Security: Do not persist PII in permanent disk localStorage. Keep session-scoped.
    window.sessionStorage.setItem(PAIRED_PATIENT_KEY, JSON.stringify(info));
    window.localStorage.removeItem(PAIRED_PATIENT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Reads paired patient profile cached from device storage.
 *
 * @returns {PairedPatientInfo | null} Paired patient info, or null if none.
 */
export function readPairedPatient(): PairedPatientInfo | null {
  if (inMemoryPairedPatient) return inMemoryPairedPatient;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PAIRED_PATIENT_KEY) || window.localStorage.getItem(PAIRED_PATIENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PairedPatientInfo;
  } catch {
    return null;
  }
}

/**
 * Purges paired patient data from memory and sessionStorage.
 */
export function clearPairedPatient(): void {
  inMemoryPairedPatient = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PAIRED_PATIENT_KEY);
    window.localStorage.removeItem(PAIRED_PATIENT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Validates PIN complexity by rejecting trivial or easily guessable patterns:
 * - Repeated identical digits (000000, 111111, ..., 999999)
 * - Sequential ascending or descending digits (012345, 123456, ..., 654321, 543210)
 *
 * @param {string} pin - 6-digit PIN string.
 * @returns {boolean} True if PIN is considered weak or trivial.
 */
export function isWeakPin(pin: string): boolean {
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return true;
  }
  // Repeated digits (e.g. 000000, 111111, ..., 999999)
  if (/^(\d)\1{5}$/.test(pin)) {
    return true;
  }
  // Sequential numbers (ascending & descending)
  const sequentialPatterns = [
    "012345", "123456", "234567", "345678", "456789", "567890",
    "987654", "876543", "765432", "654321", "543210", "098765",
  ];
  return sequentialPatterns.includes(pin);
}
