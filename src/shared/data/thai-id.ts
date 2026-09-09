/**
 * Thai national ID validation, including the mod-11 check digit.
 * See https://en.wikipedia.org/wiki/National_identification_number#Thailand
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
