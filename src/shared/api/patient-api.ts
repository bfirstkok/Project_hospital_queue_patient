import { getRuntimeConfig } from "@/shared/config/runtime-config";
import type { AccountData, ApiEnvelope, FieldErrors, LoginResult, QueueData, RegistrationPayload, RegistrationResult } from "./types";

const INVALID_RESPONSE = "เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาตรวจสอบ API URL";
const DEFAULT_ERROR = "ไม่สามารถดำเนินการได้";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly errors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return value !== null && typeof value === "object" && "ok" in value;
}

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

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const { apiBaseUrl } = getRuntimeConfig();
  if (!apiBaseUrl) throw new ApiError("ยังไม่ได้ตั้งค่า URL ของเว็บหลัก");
  if (token === "") throw new ApiError("กรุณาเข้าสู่ระบบก่อน");

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

export const patientApi = {
  register: (payload: RegistrationPayload) => request<RegistrationResult>("/api/patient/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
  login: (nationalId: string) => request<LoginResult>("/api/patient/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ national_id: nationalId.trim() }),
  }),
  queue: (token: string) => request<QueueData>("/api/patient/queue/", { cache: "no-store" }, token),
  cancelQueue: (token: string) => request<ApiEnvelope>("/api/patient/queue/cancel/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, token),
  account: (token: string) => request<AccountData>("/api/patient/me/", { cache: "no-store" }, token),
};
