import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";

// ข้อมูล Metadata ประจำเว็บ (SEO และหัวแท็บเบราว์เซอร์)
export const metadata: Metadata = {
  title: "ลงทะเบียนผู้ป่วย | OPD Queue",
  description: "ลงทะเบียนและติดตามสถานะคิวผู้ป่วย OPD",
};

/**
 * RootLayout: โครงสร้างเค้าโครงหลักของแอปพลิเคชัน (Next.js App Router)
 *
 * บทบาทหน้าที่ (Core Application Wrapper):
 * 1. กำหนดภาษาหลักของเอกสาร HTML เป็นภาษาไทย (`<html lang="th">`)
 * 2. ครอบคอมโพเนนต์ลูกด้วย `ErrorBoundary` เพื่อดักจับข้อผิดพลาดระดับ Runtime ป้องกันปัญหาจอขาว
 * 3. ฝัง `OfflineBanner` แจ้งเตือนเมื่อการเชื่อมต่ออินเทอร์เน็ตขาดหาย
 * 4. โหลดสคริปต์การตั้งค่ารันไทม์ (`/patient/runtime-config.js`) แบบ `beforeInteractive` เพื่อให้ระบบมีคอนฟิกก่อนโหลด UI
 * 5. โหลดไลบรารี Google Identity Services (GSI) สำหรับรองรับการล็อกอินผ่าน Google
 *
 * @param children - คอมโพเนนต์หน้าเว็บที่อยู่ภายใต้ Layout นี้
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
        <OfflineBanner />
        <Script src="/patient/runtime-config.js?v=20260924-google-config" strategy="beforeInteractive" />
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
