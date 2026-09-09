import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";

export const metadata: Metadata = {
  title: "ลงทะเบียนผู้ป่วย | OPD Queue",
  description: "ลงทะเบียนและติดตามสถานะคิวผู้ป่วย OPD",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
        <OfflineBanner />
        <Script src="/patient/runtime-config.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
