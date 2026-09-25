import { getRuntimeConfig } from "@/shared/config/runtime-config";
import type {
  AccountData,
  ApiEnvelope,
  FieldErrors,
  GoogleAuthResult,
  LoginCredentials,
  LoginResult,
  PasswordResetConfirmPayload,
  PasswordResetConfirmResult,
  PasswordResetRequestPayload,
  PasswordResetRequestResult,
  PasswordResetVerifyPayload,
  PasswordResetVerifyResult,
  PinResetConfirmPayload,
  PinResetRequestPayload,
  PinResetVerifyPayload,
  PinResetVerifyResult,
  PinSetupResult,
  PinVerifyResult,
  ProfileUpdatePayload,
  QueueData,
  RegistrationPayload,
  RegistrationResult,
} from "./types";

const INVALID_RESPONSE = "เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาตรวจสอบ API URL";
const DEFAULT_ERROR = "ไม่สามารถดำเนินการได้";

/**
 * คลาสข้อผิดพลาดเฉพาะของ API (Custom Error Class)
 * ใช้ดักจับรหัสสถานะ HTTP (status code) และรายละเอียดข้อผิดพลาดรายฟิลด์ (เช่น ฟอร์แมตผิด หรือ ข้อมูลซ้ำ)
 */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly errors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Type Guard ตรวจสอบว่า Response ที่ตอบกลับมามีโครงสร้างเป็นไปตาม `ApiEnvelope` (มีฟิลด์ `ok`) หรือไม่
 *
 * @param {unknown} value - ข้อมูลดิบที่ตอบกลับมาจาก Server
 * @returns {boolean} เป็น true หากมีโครงสร้างตรงตาม ApiEnvelope
 */
function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return value !== null && typeof value === "object" && "ok" in value;
}

/**
 * ฟังก์ชันแปลงและตรวจสอบความถูกต้องของ Response จาก Server
 *
 * หน้าที่การทำงาน:
 * 1. ตรวจสอบว่า Content-Type เป็น `application/json` หรือไม่
 * 2. แปลงข้อมูล JSON เป็น Object
 * 3. ตรวจสอบรหัสสถานะ HTTP และแฟล็ก `ok` ใน Response Envelope
 * 4. หากพบข้อผิดพลาด จะดึงข้อความแจ้งเตือนหรือข้อผิดพลาดรายฟิลด์ แล้วโยน (throw) `ApiError`
 *
 * @param {Response} response - ออบเจ็กต์ Response จาก Fetch API
 * @returns {Promise<T>} ข้อมูล Response ที่แปลงชนิดข้อมูลเรียบร้อยแล้ว
 */
async function parseResponse<T>(response: Response): Promise<T> {
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new ApiError(INVALID_RESPONSE, response.status);
  }
  const result: unknown = await response.json();
  if (!isApiEnvelope(result) || !response.ok || !result.ok) {
    const message = isApiEnvelope(result) ? result.error || DEFAULT_ERROR : INVALID_RESPONSE;
    throw new ApiError(message, response.status, isApiEnvelope(result) ? result.errors : undefined);
  }
  return result as T;
}

/**
 * ฟังก์ชันแกนกลางสำหรับยิงคำขอ HTTP (Fetch API) ไปยัง Backend Server
 *
 * หน้าที่การทำงาน:
 * 1. ดึง base URL จากการตั้งค่าระบบ (Runtime Configuration)
 * 2. แนบ Header `Authorization: Bearer <token>` อัตโนมัติหากมีการส่ง Token เข้ามา
 * 3. ส่งคำขอ fetch และส่งผลลัพธ์ไปประมวลผลต่อที่ `parseResponse`
 *
 * @param {string} path - เส้นทาง Endpoint ปลายทาง (เช่น "/api/patient/login/")
 * @param {RequestInit} init - ตัวเลือกเพิ่มเติมของคำขอ (Method, Headers, Body เป็นต้น)
 * @param {string} [token] - Access Token ยืนยันตัวตน (ถ้ามี)
 * @returns {Promise<T>} ข้อมูลที่ตอบกลับมาจาก API ตามชนิดข้อมูล T
 */
async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const { apiBaseUrl } = getRuntimeConfig();
  if (!apiBaseUrl) throw new ApiError("ยังไม่ได้ตั้งค่า URL ของเว็บหลัก");
  if (token === "") throw new ApiError("กรุณาเข้าสู่ระบบก่อน");

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

/**
 * รวมบริการ API ทั้งหมดสำหรับฝั่งผู้ป่วย (Patient API Service)
 * แต่ละฟังก์ชันจะเชื่อมโยงกับ Endpoint บน Backend
 */
export const patientApi = {
  /**
   * ลงทะเบียนผู้ป่วยใหม่และออกบัตรคิวตรวจผู้ป่วยนอก (OPD) เริ่มต้น
   * Endpoint: POST /api/patient/register/
   */
  register: (payload: RegistrationPayload) => request<RegistrationResult>("/api/patient/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * เข้าสู่ระบบด้วยเลขประจำตัวประชาชน (หรือ Username) และรหัสผ่าน
   * Endpoint: POST /api/patient/login/
   */
  login: (identifierOrCredentials: string | LoginCredentials, password?: string) => {
    let bodyPayload: Record<string, unknown>;
    if (typeof identifierOrCredentials === "string") {
      const trimmed = identifierOrCredentials.trim();
      bodyPayload = password
        ? { identifier: trimmed, national_id: trimmed, password }
        : { national_id: trimmed };
    } else {
      const id = identifierOrCredentials.identifier.trim();
      bodyPayload = {
        identifier: id,
        national_id: id,
        ...(identifierOrCredentials.password ? { password: identifierOrCredentials.password } : {}),
      };
    }
    return request<LoginResult>("/api/patient/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
  },

  /**
   * ส่ง Google Identity ID token ให้ Backend ตรวจสอบก่อนเข้าสู่ระบบ
   * Endpoint: POST /api/patient/auth/google/
   */
  loginWithGoogle: (credential: string) => request<GoogleAuthResult>("/api/patient/auth/google/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  }),

  /**
   * ส่ง Google OAuth access token จาก popup ให้ Backend ตรวจสอบกับ Google
   * Endpoint: POST /api/patient/auth/google/
   */
  loginWithGoogleAccessToken: (accessToken: string) => request<GoogleAuthResult>("/api/patient/auth/google/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  }),

  /**
   * ส่งคำขอรับรหัส OTP สำหรับรีเซ็ตรหัสผ่านทางอีเมล
   * Endpoint: POST /api/patient/password/reset/request/
   */
  requestPasswordReset: (payload: PasswordResetRequestPayload) => request<PasswordResetRequestResult>("/api/patient/password/reset/request/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * ตรวจสอบความถูกต้องของรหัส OTP 6 หลัก เพื่อรับ Reset Token ไปตั้งรหัสผ่านใหม่
   * Endpoint: POST /api/patient/password/reset/verify-otp/
   */
  verifyPasswordResetOtp: (payload: PasswordResetVerifyPayload) => request<PasswordResetVerifyResult>("/api/patient/password/reset/verify-otp/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * ยืนยันการตั้งรหัสผ่านใหม่โดยใช้ Reset Token ที่ผ่านการยืนยัน OTP แล้ว
   * Endpoint: POST /api/patient/password/reset/confirm/
   */
  confirmPasswordReset: (payload: PasswordResetConfirmPayload) => request<PasswordResetConfirmResult>("/api/patient/password/reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * บันทึกรหัส PIN 6 หลักใหม่บนเซิร์ฟเวอร์ (สำหรับยืนยันตัวตนแบบรวดเร็ว)
   * Endpoint: POST /api/patient/pin/setup/
   */
  setupPin: (pin: string, token: string) => request<PinSetupResult>("/api/patient/pin/setup/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  }, token),

  /**
   * เข้าสู่ระบบด้วยเลขประจำตัวประชาชน และรหัส PIN 6 หลัก
   * Endpoint: POST /api/patient/pin/verify/
   */
  loginWithPin: (nationalId: string, pin: string) => request<PinVerifyResult>("/api/patient/pin/verify/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ national_id: nationalId.trim(), pin }),
  }),

  /**
   * เปลี่ยนรหัส PIN เดิมเป็นรหัส PIN ใหม่
   * Endpoint: POST /api/patient/pin/change/
   */
  changePin: (currentPin: string, newPin: string, token: string) => request<PinSetupResult>("/api/patient/pin/change/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  }, token),

  /**
   * ส่งคำขอรับรหัส OTP สำหรับรีเซ็ตรหัส PIN ที่ลืม
   * Endpoint: POST /api/patient/pin/reset/request/
   */
  requestPinReset: (payload: PinResetRequestPayload) => request<ApiEnvelope>("/api/patient/pin/reset/request/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * ตรวจ OTP สำหรับรีเซ็ต PIN และรับ reset token อายุสั้น
   * Endpoint: POST /api/patient/pin/reset/verify-otp/
   */
  verifyPinResetOtp: (payload: PinResetVerifyPayload) => request<PinResetVerifyResult>("/api/patient/pin/reset/verify-otp/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * ตั้งรหัส PIN ใหม่ด้วย reset token ที่ผ่านการตรวจ OTP แล้ว
   * Endpoint: POST /api/patient/pin/reset/confirm/
   */
  confirmPinReset: (payload: PinResetConfirmPayload) => request<PinVerifyResult>("/api/patient/pin/reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * ดึงข้อมูลสถานะคิวปัจจุบันของผู้ป่วย (หมายเลขคิว, ลำดับคิวที่รอ, ห้องตรวจ)
   * Endpoint: GET /api/patient/queue/
   */
  queue: (token: string) => request<QueueData>("/api/patient/queue/", { cache: "no-store" }, token),

  /**
   * อัปเดตข้อมูลประวัติส่วนตัวและผู้ติดต่อฉุกเฉินของผู้ป่วย
   * Endpoint: PATCH /api/patient/me/
   */
  updateProfile: (payload: ProfileUpdatePayload, token: string) => request<AccountData>("/api/patient/me/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, token),

  /**
   * ขอยกเลิกบัตรคิวตรวจปัจจุบันของผู้ป่วย
   * Endpoint: POST /api/patient/queue/cancel/
   */
  cancelQueue: (token: string) => request<ApiEnvelope>("/api/patient/queue/cancel/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, token),

  /**
   * ดึงข้อมูลบัญชีผู้ป่วยทั้งหมด (โปรไฟล์, คิวปัจจุบัน, ประวัติการรักษา, นัดหมาย)
   * Endpoint: GET /api/patient/me/
   */
  account: (token: string) => request<AccountData>("/api/patient/me/", { cache: "no-store" }, token),
};
