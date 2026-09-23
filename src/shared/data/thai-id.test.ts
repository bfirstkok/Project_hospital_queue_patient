import { describe, expect, it } from "vitest";
import { isValidThaiNationalId, formatMaskedNationalId } from "./thai-id";

describe("isValidThaiNationalId", () => {
  it("accepts IDs with a correct check digit (ignoring dashes/spaces)", () => {
    expect(isValidThaiNationalId("1101700230708")).toBe(true);
    expect(isValidThaiNationalId("1-1017-00230-70-8")).toBe(true);
    expect(isValidThaiNationalId("3100600445635")).toBe(true);
  });

  it("rejects wrong length, non-digits, repeated digits, and bad check digit", () => {
    expect(isValidThaiNationalId("123456789012")).toBe(false);
    expect(isValidThaiNationalId("11017002307081")).toBe(false);
    expect(isValidThaiNationalId("1111111111111")).toBe(false);
    expect(isValidThaiNationalId("1101700230704")).toBe(false);
    expect(isValidThaiNationalId("")).toBe(false);
  });
});

describe("formatMaskedNationalId", () => {
  it("masks the middle digits of a 13-digit Thai National ID", () => {
    expect(formatMaskedNationalId("1234567890123")).toBe("1-xxxx-xxxx0-12-3");
    expect(formatMaskedNationalId("1-2345-67890-12-3")).toBe("1-xxxx-xxxx0-12-3");
    expect(formatMaskedNationalId("")).toBe("-");
    expect(formatMaskedNationalId(null)).toBe("-");
  });
});
