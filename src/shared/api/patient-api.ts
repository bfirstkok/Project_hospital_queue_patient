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
 * Custom error class for API failures.
 * Captures HTTP status code and field-level validation errors (e.g. invalid format, duplicate ID).
 */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly errors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Type guard checking if an arbitrary response matches the expected `ApiEnvelope` structure (containing `ok` field).
 *
 * @param {unknown} value - Raw response data.
 * @returns {boolean} True if value is an ApiEnvelope.
 */
function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return value !== null && typeof value === "object" && "ok" in value;
}

/**
 * Parses and validates server responses.
 *
 * Responsibilities:
 * 1. Ensures response Content-Type contains `application/json`.
 * 2. Parses JSON payload.
 * 3. Validates HTTP response status and envelope `ok` flag.
 * 4. Extracts error messages and field errors, throwing an `ApiError` if unsuccessful.
 *
 * @param {Response} response - Fetch API Response object.
 * @returns {Promise<T>} Parsed response data.
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
 * Core HTTP client for dispatching requests to the backend server.
 *
 * Responsibilities:
 * 1. Reads base URL from runtime configuration.
 * 2. Appends `Authorization: Bearer <token>` header when token is supplied.
 * 3. Executes fetch call and forwards result to `parseResponse`.
 *
 * @param {string} path - Target endpoint path (e.g. "/api/patient/login/").
 * @param {RequestInit} init - Standard fetch options (method, headers, body, etc.).
 * @param {string} [token] - Optional access token.
 * @returns {Promise<T>} Typed API response.
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
 * Patient API client containing all patient-facing endpoints.
 */
export const patientApi = {
  /**
   * Registers a new patient and creates an initial OPD queue ticket.
   * Endpoint: POST /api/patient/register/
   */
  register: (payload: RegistrationPayload) => request<RegistrationResult>("/api/patient/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Authenticates with Thai National ID (or username) and password.
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
   * Authenticates using a Google OAuth credential token (Social Login).
   * Endpoint: POST /api/patient/auth/google/
   */
  loginWithGoogle: (credential: string) => request<GoogleAuthResult>("/api/patient/auth/google/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  }),

  /**
   * Requests a password reset OTP sent via SMS or email.
   * Endpoint: POST /api/patient/password/reset/request/
   */
  requestPasswordReset: (payload: PasswordResetRequestPayload) => request<PasswordResetRequestResult>("/api/patient/password/reset/request/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Verifies 6-digit password reset OTP and receives a reset token.
   * Endpoint: POST /api/patient/password/reset/verify-otp/
   */
  verifyPasswordResetOtp: (payload: PasswordResetVerifyPayload) => request<PasswordResetVerifyResult>("/api/patient/password/reset/verify-otp/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Confirms password reset using verified reset token and sets new password.
   * Endpoint: POST /api/patient/password/reset/confirm/
   */
  confirmPasswordReset: (payload: PasswordResetConfirmPayload) => request<PasswordResetConfirmResult>("/api/patient/password/reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Sets up a new 6-digit security PIN on the backend server.
   * Endpoint: POST /api/patient/pin/setup/
   */
  setupPin: (pin: string, token: string) => request<PinSetupResult>("/api/patient/pin/setup/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  }, token),

  /**
   * Authenticates with National ID and 6-digit PIN.
   * Endpoint: POST /api/patient/pin/verify/
   */
  loginWithPin: (nationalId: string, pin: string) => request<PinVerifyResult>("/api/patient/pin/verify/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ national_id: nationalId.trim(), pin }),
  }),

  /**
   * Changes existing PIN to a new PIN.
   * Endpoint: POST /api/patient/pin/change/
   */
  changePin: (currentPin: string, newPin: string, token: string) => request<PinSetupResult>("/api/patient/pin/change/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  }, token),

  /**
   * Requests a PIN reset OTP sent via registered channels.
   * Endpoint: POST /api/patient/pin/reset/request/
   */
  requestPinReset: (payload: PinResetRequestPayload) => request<ApiEnvelope>("/api/patient/pin/reset/request/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Confirms PIN reset using OTP and saves new PIN.
   * Endpoint: POST /api/patient/pin/reset/confirm/
   */
  confirmPinReset: (payload: PinResetConfirmPayload) => request<PinVerifyResult>("/api/patient/pin/reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),

  /**
   * Fetches current queue status for patient (ticket number, wait estimate, station).
   * Endpoint: GET /api/patient/queue/
   */
  queue: (token: string) => request<QueueData>("/api/patient/queue/", { cache: "no-store" }, token),

  /**
   * Updates patient profile details and emergency contacts.
   * Endpoint: PATCH /api/patient/me/
   */
  updateProfile: (payload: ProfileUpdatePayload, token: string) => request<AccountData>("/api/patient/me/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, token),

  /**
   * Cancels active OPD queue ticket.
   * Endpoint: POST /api/patient/queue/cancel/
   */
  cancelQueue: (token: string) => request<ApiEnvelope>("/api/patient/queue/cancel/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, token),

  /**
   * Fetches patient account profile, appointments, and medical visit history.
   * Endpoint: GET /api/patient/me/
   */
  account: (token: string) => request<AccountData>("/api/patient/me/", { cache: "no-store" }, token),
};
