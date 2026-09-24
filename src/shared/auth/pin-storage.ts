// คีย์สำหรับบันทึกข้อมูลความปลอดภัยของ PIN ใน Web Storage (localStorage / sessionStorage)
export const PIN_STORAGE_KEY = "hospital_patient_security_pin";
export const PIN_ENABLED_KEY = "hospital_patient_pin_enabled";
export const PIN_ATTEMPTS_KEY = "hospital_patient_pin_attempts";
export const PIN_LOCKOUT_UNTIL_KEY = "hospital_patient_pin_lockout_until";
export const PIN_LOCKOUT_LEVEL_KEY = "hospital_patient_pin_lockout_level";
export const PAIRED_PATIENT_KEY = "hospital_patient_paired_info";

// จำนวนครั้งสูงสุดที่อนุญาตให้กรอก PIN ผิด ก่อนจะถูกระงับการใช้งานชั่วคราว (Lockout)
export const MAX_FAILED_ATTEMPTS = 3;

/**
 * ระดับขั้นของระยะเวลาล็อกบัญชีเมื่อกรอกผิดเกินกำหนด (Lockout Escalation Tiers):
 * - ครั้งแรกที่ผิดครบ 3 ครั้ง: ระงับ 60 วินาที (1 นาที)
 * - ครั้งที่สอง: ระงับ 300 วินาที (5 นาที)
 * - ครั้งที่สามขึ้นไป: ระงับ 1800 วินาที (30 นาที)
 * การออกจากระบบหรือล้างข้อมูลไม่ได้ช่วยรีเซ็ตเวลาล็อก (ต้องรอเวลาหมดหรือกรอกถูกเท่านั้น)
 */
export const LOCKOUT_TIERS_SECONDS = [60, 300, 1800];

/**
 * คำนวณระยะเวลาการถูกระงับใช้งาน (วินาที) ตามระดับขั้นความผิด (Lockout Tier)
 *
 * @param {number} level - ระดับขั้นการล็อก (0 = 60วิ, 1 = 300วิ, 2 = 1800วิ)
 * @returns {number} ระยะเวลาที่ต้องรอในหน่วยวินาที
 */
function lockoutSecondsForLevel(level: number): number {
  return LOCKOUT_TIERS_SECONDS[Math.min(Math.max(level, 0), LOCKOUT_TIERS_SECONDS.length - 1)];
}

// ค่า Salt สำหรับใช้ประกอบการเข้ารหัสแฮช PIN ป้องกันการโจมตีแบบ Rainbow Table
const SALT = "hospital_patient_pin_salt_v1:";

/**
 * เข้ารหัสแฮชรหัส PIN 6 หลัก ด้วยอัลกอริทึม SHA-256 ร่วมกับการเติม Salt
 * ป้องกันไม่ให้มีการบันทึก PIN ในรูปแบบข้อความธรรมดา (Plaintext) ในเครื่องฝั่งไคลเอนต์
 *
 * @param {string} pin - รหัส PIN 6 หลักที่ผู้ใช้กรอก
 * @returns {string} ข้อความแฮชฐาน 16 (Hexadecimal) ความยาว 64 ตัวอักษร
 */
export function hashPin(pin: string): string {
  // ฟังก์ชันหมุนบิตไปทางขวา (Bitwise Right Rotate) ในอัลกอริทึม SHA-256
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

  // คำนวณค่าคงที่เริ่มต้นจากจำนวนเฉพาะ (Initial hash values & constants)
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

  // ทำ Padding ข้อมูลตามมาตรฐาน SHA-256
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii.length; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  // วนลูปประมวลผลบล็อกละ 512 บิต (Main SHA-256 computation loop)
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

  // แปลงผลลัพธ์เป็นรหัสเลขฐาน 16 (Hex String)
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * สร้างชื่อคีย์ Storage สำหรับ PIN โดยผูกเข้ากับเลขประจำตัวประชาชนของผู้ป่วย (Scoped Key)
 *
 * @param {string} [nationalId] - เลขประจำตัวประชาชน 13 หลัก
 * @returns {string} ชื่อคีย์สำหรับเรียกอ่านหรือบันทึก
 */
export function getPinKey(nationalId?: string): string {
  if (nationalId && nationalId.trim()) {
    return `hospital_patient_pin_${nationalId.trim()}`;
  }
  return PIN_STORAGE_KEY;
}

/**
 * อ่านค่ารหัส PIN ที่ผ่านการแฮชแล้วจาก Storage ของเบราว์เซอร์
 *
 * @param {string} [nationalId] - เลขประจำตัวประชาชนของผู้ป่วย
 * @returns {string | null} ค่าแฮชของ PIN หรือ null หากยังไม่ได้ตั้งค่า
 */
export function readPin(nationalId?: string): string | null {
  if (typeof window === "undefined") return null;
  if (nationalId && nationalId.trim()) {
    return window.localStorage.getItem(getPinKey(nationalId));
  }
  return window.localStorage.getItem(PIN_STORAGE_KEY);
}

/**
 * บันทึกรหัส PIN ใหม่ของผู้ป่วย (จะทำการเข้ารหัสแฮชก่อนบันทึกลง LocalStorage เสมอ)
 * พร้อมเปิดใช้งานระบบ PIN และล้างสถานะล็อกชั่วคราว
 *
 * @param {string} pin - รหัสตัวเลข 6 หลัก
 * @param {string} [nationalId] - เลขประจำตัวประชาชนของผู้ป่วย
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
 * ตรวจสอบว่าผู้ป่วยคนนี้มีการตั้งรหัส PIN ไว้ในระบบแล้วหรือไม่
 *
 * @param {string} [nationalId] - เลขประจำตัวประชาชน
 * @returns {boolean} true หากมี PIN อยู่ในระบบ
 */
export function hasPin(nationalId?: string): boolean {
  return Boolean(readPin(nationalId));
}

/**
 * ตรวจสอบว่าระบบเปิดใช้งานการล็อกอินด้วย PIN และผู้ใช้มีรหัส PIN อยู่แล้วหรือไม่
 *
 * @returns {boolean} true หากเปิดใช้งาน PIN และมีรหัสบันทึกอยู่
 */
export function isPinEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const enabled = window.localStorage.getItem(PIN_ENABLED_KEY);
  return enabled === "true" && hasPin();
}

/**
 * สลับสถานะเปิดหรือปิดการใช้งานรหัส PIN
 *
 * @param {boolean} enabled - true เพื่อเปิดใช้งาน, false เพื่อปิด
 */
export function setPinEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIN_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * ดึงจำนวนครั้งสะสมที่ผู้ใช้กรอก PIN ผิดในรอบปัจจุบัน
 *
 * @returns {number} จำนวนครั้งที่กรอกผิด
 */
export function getFailedAttempts(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(PIN_ATTEMPTS_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

/**
 * คำนวณจำนวนครั้งที่เหลือที่ผู้ใช้สามารถกรอก PIN ผิดได้ ก่อนที่จะถูกล็อกระบบ
 *
 * @returns {number} จำนวนครั้งที่เหลือ (0 ถึง 3)
 */
export function getRemainingAttempts(): number {
  const attempts = getFailedAttempts();
  return Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
}

/**
 * ดึงระดับขั้นความผิดปัจจุบัน (Lockout Escalation Level) เพื่อใช้คำนวณระยะเวลาลงโทษ
 *
 * @returns {number} ระดับขั้น (0, 1, 2, ...)
 */
export function getLockoutLevel(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(PIN_LOCKOUT_LEVEL_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

/**
 * ดึงระยะเวลาที่ต้องถูกระงับในรอบถัดไป (หน่วยวินาที: 1นาที -> 5นาที -> 30นาที)
 *
 * @returns {number} ระยะเวลาเป็นวินาที
 */
export function getNextLockoutSeconds(): number {
  return lockoutSecondsForLevel(getLockoutLevel());
}

/**
 * คำนวณเวลาที่เหลือของการถูกระงับใช้งานในปัจจุบัน (หน่วยวินาที)
 * หากหมดเวลาแล้ว จะล้างเวลาหมดอายุออกโดยอัตโนมัติ แต่ยังคงรักษาระดับขั้นการลงโทษไว้
 *
 * @returns {number} เวลาที่เหลือ (0 หากไม่ได้ถูกระงับ)
 */
export function getLockoutRemainingSeconds(): number {
  if (typeof window === "undefined") return 0;
  const lockoutUntil = window.localStorage.getItem(PIN_LOCKOUT_UNTIL_KEY);
  if (!lockoutUntil) return 0;
  const until = parseInt(lockoutUntil, 10);
  const now = Date.now();
  if (now >= until) {
    // เมื่อหมดเวลาการระงับ: รีเซ็ตจำนวนครั้งที่กรอกผิด แต่ยังคงระดับขั้นการลงโทษไว้
    window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
    window.localStorage.setItem(PIN_ATTEMPTS_KEY, "0");
    return 0;
  }
  return Math.ceil((until - now) / 1000);
}

/**
 * ตรวจสอบว่าขณะนี้ผู้ใช้กำลังติดสถานะถูกระงับการกรอก PIN (Lockout) อยู่หรือไม่
 *
 * @returns {boolean} true หากอยู่ในช่วงถูกระงับ
 */
export function isLockedOut(): boolean {
  return getLockoutRemainingSeconds() > 0;
}

/**
 * รีเซ็ตสถานะการระงับและจำนวนครั้งที่ผิดทั้งหมดเมื่อกรอก PIN สำเร็จถูกต้อง
 */
export function resetLockout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_ATTEMPTS_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_LEVEL_KEY);
}

/**
 * ล้างจำนวนครั้งที่กรอกผิดและเวลาล็อกในรอบปัจจุบัน แต่ยังคงระดับบทลงโทษไว้
 */
export function clearActiveLockout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_ATTEMPTS_KEY);
  window.localStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
}

/**
 * บันทึกการกรอก PIN ผิด 1 ครั้ง
 * หากครบกำหนด `MAX_FAILED_ATTEMPTS` (3 ครั้ง) จะเริ่มตั้งเวลาถูกระงับใช้งานตามระดับขั้น
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
 * ตรวจสอบความถูกต้องของรหัส PIN ที่ผู้ใช้กรอก เทียบกับรหัสแฮชที่บันทึกไว้
 *
 * ขั้นตอนการทำงาน:
 * 1. ตรวจสอบสถานะ Lockout: หากกำลังถูกระงับจะไม่อนุญาตและปฏิเสธทันที
 * 2. นำ PIN ที่กรอกไปเข้ารหัสแฮช แล้วเปรียบเทียบกับแฮชในระบบ
 * 3. หากถูกต้อง: ล้างสถานะ Lockout และส่งค่ากลับเป็น true
 * 4. หากไม่ถูกต้อง: บันทึกความผิดพลาด 1 ครั้ง (`recordFailedAttempt`) และส่งค่ากลับเป็น false
 *
 * @param {string} enteredPin - รหัส PIN ที่ผู้ป่วยกรอก
 * @param {string} [nationalId] - เลขประจำตัวประชาชนของผู้ป่วย
 * @returns {boolean} true หาก PIN ถูกต้องและไม่ติดสถานะระงับ
 */
export function verifyPin(enteredPin: string, nationalId?: string): boolean {
  if (isLockedOut()) {
    return false;
  }

  const saved = readPin(nationalId);
  if (!saved) return false;

  const enteredHash = hashPin(enteredPin);
  // ตรวจสอบทั้งกรณีแฮชหรือข้อมูลแบบเก่า (Backward compatibility)
  const isMatch = saved === enteredHash || saved === enteredPin;

  if (isMatch) {
    resetLockout();
    // หากเป็นข้อมูลแบบเก่าที่ยังไม่แฮช ให้อัปเกรดเป็นแฮชทันที
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
 * ลบรหัส PIN ออกจากหน่วยความจำของอุปกรณ์
 * ข้อสังเกต: จะไม่ล้างระดับการถูกระงับ (Lockout Level) เพื่อป้องกันผู้ใช้พยายามบายพาสด้วยการล้างเครื่องแล้วเข้าใหม่
 *
 * @param {string} [nationalId] - เลขประจำตัวประชาชนของผู้ป่วย
 */
export function clearPin(nationalId?: string): void {
  if (typeof window === "undefined") return;
  if (nationalId && nationalId.trim()) {
    window.localStorage.removeItem(getPinKey(nationalId));
  }
  window.localStorage.removeItem(PIN_STORAGE_KEY);
  window.localStorage.removeItem(PIN_ENABLED_KEY);
}

export const hasPinForPatient = hasPin;
export const savePinForPatient = savePin;
export const verifyPinForPatient = verifyPin;
export const clearPinForPatient = clearPin;

// โครงสร้างข้อมูลระบุตัวตนของผู้ป่วยที่ผูกกับอุปกรณ์นี้
export interface PairedPatientInfo {
  name: string;
  nationalId: string;
  maskedId?: string;
  // ช่องทางติดต่อของผู้ป่วย สำหรับใช้ส่งรหัส OTP กู้คืน PIN โดยไม่ต้องกรอกใหม่
  phone?: string;
  email?: string;
}

// ตัวแปรหน่วยความจำชั่วคราวขณะแอปทำงาน (In-Memory Cache)
let inMemoryPairedPatient: PairedPatientInfo | null = null;

/**
 * บันทึกข้อมูลระบุตัวตนของผู้ป่วยไว้ชั่วคราวใน sessionStorage
 * เพื่อความปลอดภัยและปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
 * โดยไม่บันทึกข้อมูลส่วนบุคคลที่ระบุตัวตนได้ (PII) ลงใน LocalStorage ถาวร
 *
 * @param {PairedPatientInfo} info - ข้อมูลผู้ป่วย (ชื่อ, เลขบัตร, เบอร์โทร, อีเมล)
 */
export function savePairedPatient(info: PairedPatientInfo): void {
  inMemoryPairedPatient = info;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PAIRED_PATIENT_KEY, JSON.stringify(info));
    window.localStorage.removeItem(PAIRED_PATIENT_KEY);
  } catch {
    // ป้องกันกรณีติดข้อจำกัดด้านความปลอดภัยของเบราว์เซอร์
  }
}

/**
 * อ่านข้อมูลผู้ป่วยที่บันทึกไว้ในเบราว์เซอร์
 *
 * @returns {PairedPatientInfo | null} ข้อมูลผู้ป่วย หรือ null หากไม่มี
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
 * ล้างข้อมูลผู้ป่วยที่ผูกไว้ทั้งหมดออกจากหน่วยความจำและ sessionStorage
 */
export function clearPairedPatient(): void {
  inMemoryPairedPatient = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PAIRED_PATIENT_KEY);
    window.localStorage.removeItem(PAIRED_PATIENT_KEY);
  } catch {
    // ป้องกันกรณีติดข้อจำกัดด้านความปลอดภัยของเบราว์เซอร์
  }
}

/**
 * ตรวจสอบความปลอดภัยของรหัส PIN โดยปฏิเสธรูปแบบตัวเลขที่คาดเดาได้ง่าย:
 * - ตัวเลขซ้ำกันทั้งหมด 6 หลัก (เช่น 000000, 111111, ..., 999999)
 * - ตัวเลขเรียงลำดับจากหน้าไปหลังหรือหลังมาหน้า (เช่น 123456, 654321)
 *
 * @param {string} pin - ข้อความรหัส PIN 6 หลัก
 * @returns {boolean} true ถ้ารหัส PIN อ่อนแอและเดาง่ายเกินไป (ไม่ปลอดภัย)
 */
export function isWeakPin(pin: string): boolean {
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return true;
  }
  // ดักจับกรณีเป็นเลขซ้ำตัวเดิม 6 ตัว
  if (/^(\d)\1{5}$/.test(pin)) {
    return true;
  }
  // ดักจับรูปแบบตัวเลขเรียงลำดับ
  const sequentialPatterns = [
    "012345", "123456", "234567", "345678", "456789", "567890",
    "987654", "876543", "765432", "654321", "543210", "098765",
  ];
  return sequentialPatterns.includes(pin);
}
