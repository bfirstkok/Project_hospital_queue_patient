/**
 * Validates a 13-digit Thai National ID using the official Modulo 11 checksum algorithm.
 *
 * Algorithm steps:
 * 1. Strips non-digit characters.
 * 2. Ensures length is exactly 13 digits.
 * 3. Rejects repeated identical digits (e.g., 0000000000000 or 1111111111111).
 * 4. Sums the first 12 digits multiplied by their descending weights (13 down to 2).
 * 5. Computes check digit: `(11 - (sum % 11)) % 10`.
 * 6. Compares computed check digit against the 13th digit.
 *
 * @param {string} input - National ID string to validate.
 * @returns {boolean} True if checksum is valid.
 */
export function isValidThaiNationalId(input: string): boolean {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length !== 13) return false;
  if (/^(\d)\1{12}$/.test(digits)) return false; // reject 0000000000000, 1111111111111, ...

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(digits[12]);
}
