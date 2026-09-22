import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";

export const metadata: Metadata = {
  title: "ลงทะเบียนผู้ป่วย | OPD Queue",
  description: "ลงทะเบียนและติดตามสถานะคิวผู้ป่วย OPD",
};

/**
 * RootLayout: Primary layout component for the application (Next.js App Router).
 *
 * Responsibilities:
 * 1. Defines basic HTML structure (`<html lang="th">`, `<body>`).
 * 2. Wraps application tree with `ErrorBoundary` to gracefully catch rendering crashes.
 * 3. Displays `OfflineBanner` when network connectivity is lost.
 * 4. Injects client runtime configuration (`runtime-config.js`) before interactive phase.
 * 5. Loads Google Identity Services (GSI) script for Google Sign-In.
 *
 * @param children - Child page/component nodes rendered inside this layout.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
        <OfflineBanner />
        <Script src="/patient/runtime-config.js" strategy="beforeInteractive" />
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
