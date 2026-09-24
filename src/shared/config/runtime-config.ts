// ประกาศ Interface เพิ่มเติมใน Window Object ของเบราว์เซอร์ เพื่อรองรับตัวแปร Environment และ Google Identity Services
declare global {
  interface Window {
    PATIENT_APP_ENV?: {
      API_BASE_URL?: string;             // Base URL ของ Backend API
      STATUS_REFRESH_MS?: number | string; // ความถี่ในการดึงข้อมูลสถานะคิว (Polling Interval หน่วย ms)
      GOOGLE_CLIENT_ID?: string;          // Google OAuth Client ID สำหรับระบบ Login ด้วย Google
    };
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          prompt?: (notification?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

// โครงสร้างข้อมูลคอนฟิกระบบขณะรันไทม์ (Runtime Configuration)
export interface RuntimeConfig {
  apiBaseUrl: string;       // URL หลักสำหรับติดต่อ Backend API
  statusRefreshMs: number;  // ระยะเวลาหน่วงในการดึงข้อมูลคิวอัตโนมัติ (หน่วยมิลลิวินาที)
  googleClientId: string;   // รหัส Client ID สำหรับ Google Sign-In
}

/**
 * ดึงค่าการตั้งค่าระบบ (Configuration) ขณะที่โปรแกรมกำลังทำงาน (Runtime)
 *
 * ประโยชน์สำหรับการทดสอบ/นำเสนอวิทยานิพนธ์:
 * 1. รองรับการรันแบบ 12-Factor App โดยอ่านค่าคอนฟิกจาก `window.PATIENT_APP_ENV` (ฉีดผ่าน runtime-config.js ตอน deploy)
 * 2. หากไม่ได้ระบุ URL จะใช้ Origin เดียวกันกับเว็บเบราว์เซอร์ (Same-origin API)
 * 3. กำหนดรอบเวลาอัปเดตสถานะคิว (Polling) อัตโนมัติ โดยมีค่าตั้งต้นที่ 10,000 มิลลิวินาที (10 วินาที)
 * 4. รองรับการดึง Client ID สำหรับล็อกอินด้วย Google จาก Environment Variables
 *
 * @returns {RuntimeConfig} ออบเจกต์ที่มี apiBaseUrl, statusRefreshMs และ googleClientId
 */
export function getRuntimeConfig(): RuntimeConfig {
  const runtime = typeof window === "undefined" ? undefined : window.PATIENT_APP_ENV;
  const sameOriginApiBaseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const envClientId = typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "" : "";
  return {
    apiBaseUrl: String(runtime?.API_BASE_URL || sameOriginApiBaseUrl).trim().replace(/\/$/, ""),
    statusRefreshMs: Number(runtime?.STATUS_REFRESH_MS) || 10000,
    googleClientId: String(runtime?.GOOGLE_CLIENT_ID || envClientId).trim(),
  };
}
