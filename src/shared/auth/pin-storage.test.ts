import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPairedPatient,
  clearPin,
  getFailedAttempts,
  getLockoutRemainingSeconds,
  getRemainingAttempts,
  hasPin,
  isLockedOut,
  isPinEnabled,
  MAX_FAILED_ATTEMPTS,
  readPairedPatient,
  resetLockout,
  savePairedPatient,
  savePin,
  setPinEnabled,
  verifyPin,
} from "./pin-storage";

describe("pin-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hashes and verifies PIN successfully", () => {
    expect(hasPin()).toBe(false);
    expect(isPinEnabled()).toBe(false);

    savePin("123456");
    expect(hasPin()).toBe(true);
    expect(isPinEnabled()).toBe(true);

    // Stored pin is hashed, not plain text
    const stored = window.localStorage.getItem("hospital_patient_security_pin");
    expect(stored).not.toBe("123456");
    expect(stored?.length).toBe(64); // SHA-256 hex length

    expect(verifyPin("123456")).toBe(true);
    expect(verifyPin("654321")).toBe(false);
  });

  it("handles enabling and disabling PIN", () => {
    savePin("123456");
    expect(isPinEnabled()).toBe(true);

    setPinEnabled(false);
    expect(isPinEnabled()).toBe(false);

    setPinEnabled(true);
    expect(isPinEnabled()).toBe(true);
  });

  it("tracks failed attempts and locks out after MAX_FAILED_ATTEMPTS", () => {
    savePin("123456");
    expect(getFailedAttempts()).toBe(0);
    expect(getRemainingAttempts()).toBe(MAX_FAILED_ATTEMPTS);
    expect(isLockedOut()).toBe(false);

    // 1st wrong attempt
    expect(verifyPin("000000")).toBe(false);
    expect(getFailedAttempts()).toBe(1);
    expect(getRemainingAttempts()).toBe(MAX_FAILED_ATTEMPTS - 1);
    expect(isLockedOut()).toBe(false);

    // 2nd wrong attempt
    expect(verifyPin("000001")).toBe(false);
    expect(getFailedAttempts()).toBe(2);
    expect(getRemainingAttempts()).toBe(MAX_FAILED_ATTEMPTS - 2);
    expect(isLockedOut()).toBe(false);

    // 3rd wrong attempt -> lockout!
    expect(verifyPin("000002")).toBe(false);
    expect(getFailedAttempts()).toBe(3);
    expect(getRemainingAttempts()).toBe(0);
    expect(isLockedOut()).toBe(true);
    expect(getLockoutRemainingSeconds()).toBeGreaterThan(0);

    // Even with correct PIN, verification fails during lockout
    expect(verifyPin("123456")).toBe(false);

    // Resetting lockout restores access
    resetLockout();
    expect(isLockedOut()).toBe(false);
    expect(getFailedAttempts()).toBe(0);
    expect(verifyPin("123456")).toBe(true);
  });

  it("clears PIN and lockout state", () => {
    savePin("123456");
    verifyPin("000000");
    expect(getFailedAttempts()).toBe(1);

    clearPin();
    expect(hasPin()).toBe(false);
    expect(isPinEnabled()).toBe(false);
    expect(getFailedAttempts()).toBe(0);
    expect(isLockedOut()).toBe(false);
  });

  it("saves and reads paired patient information", () => {
    expect(readPairedPatient()).toBeNull();

    savePairedPatient({
      name: "สมชาย ใจดี",
      nationalId: "1234567890123",
      maskedId: "1-xxxx-xxxx4-56-7",
    });

    const paired = readPairedPatient();
    expect(paired).not.toBeNull();
    expect(paired?.name).toBe("สมชาย ใจดี");
    expect(paired?.nationalId).toBe("1234567890123");
    expect(paired?.maskedId).toBe("1-xxxx-xxxx4-56-7");

    clearPairedPatient();
    expect(readPairedPatient()).toBeNull();
  });

  it("handles patient-specific PIN storage and verification", () => {
    const natId1 = "1111111111111";
    const natId2 = "2222222222222";

    expect(hasPin(natId1)).toBe(false);
    expect(hasPin(natId2)).toBe(false);

    savePin("123456", natId1);
    expect(hasPin(natId1)).toBe(true);
    expect(verifyPin("123456", natId1)).toBe(true);
    expect(verifyPin("654321", natId1)).toBe(false);

    // natId2 can have a different PIN
    savePin("654321", natId2);
    expect(hasPin(natId2)).toBe(true);
    expect(verifyPin("654321", natId2)).toBe(true);
    expect(verifyPin("123456", natId2)).toBe(false);

    clearPin(natId1);
    expect(hasPin(natId1)).toBe(false);
    expect(hasPin(natId2)).toBe(true);
  });
});
