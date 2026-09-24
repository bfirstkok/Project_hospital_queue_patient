// คีย์สำหรับจัดเก็บ Access Token (JWT) ของผู้ป่วยใน Web Storage
export const TOKEN_STORAGE_KEY = "hospital_patient_access_token";

// ตัวแปรเก็บ Token ในหน่วยความจำชั่วคราว (In-Memory Cache) เพื่อให้เข้าถึงได้รวดเร็ว
let inMemoryToken: string | null = null;

/**
 * อ่านค่า Access Token สำหรับใช้ยืนยันตัวตนกับ Backend API
 *
 * ลำดับการทำงาน:
 * 1. ตรวจสอบในตัวแปร In-Memory (`inMemoryToken`) ก่อนเป็นอันดับแรก
 * 2. หากทำงานบนเบราว์เซอร์ จะอ่านจาก `sessionStorage` (และสำรองอ่านจาก `localStorage` สำหรับระบบเดิม)
 *
 * @returns {string | null} ข้อความ Token หรือ null หากยังไม่ได้เข้าสู่ระบบ
 */
export function readToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * บันทึก Access Token เมื่อผู้ป่วยเข้าสู่ระบบสำเร็จ
 *
 * การรักษาความปลอดภัยตามหลัก PDPA & Security Best Practices:
 * 1. บันทึกลงตัวแปร `inMemoryToken` เพื่อใช้งานในหน่วยความจำ
 * 2. บันทึกลง `sessionStorage` เพื่อให้ Token ถูกล้างทิ้งอัตโนมัติเมื่อปิดแท็บเบราว์เซอร์
 * 3. ล้าง Token ออกจาก `localStorage` เพื่อป้องกันการฝังตัวถาวรในฮาร์ดดิสก์
 *
 * @param {string} token - Access Token ที่ได้รับจากการล็อกอินหรือลงทะเบียน
 */
export function saveToken(token: string): void {
  inMemoryToken = token;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ป้องกันกรณีเบราว์เซอร์ปิดกั้น Storage
  }
}

/**
 * ล้างข้อมูล Access Token เมื่อผู้ใช้ออกจากระบบ (Logout) หรือ Session หมดอายุ
 *
 * ขั้นตอนการทำงาน:
 * 1. รีเซ็ตตัวแปร `inMemoryToken` ให้เป็น null
 * 2. ลบ Token ออกจากทั้ง `sessionStorage` และ `localStorage`
 */
export function clearToken(): void {
  inMemoryToken = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ป้องกันกรณีเบราว์เซอร์ปิดกั้น Storage
  }
}
