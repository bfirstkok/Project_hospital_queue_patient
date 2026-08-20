"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

interface SiteShellProps {
  hasSavedAccount: boolean;
  onOpenAccount: () => void;
  children: ReactNode;
}

type FontSize = "normal" | "large" | "xlarge";

function getInitialFontSize(): FontSize {
  if (typeof window === "undefined") return "normal";
  try {
    const saved = localStorage.getItem("app_font_size") as FontSize | null;
    if (saved && (saved === "normal" || saved === "large" || saved === "xlarge")) {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "normal";
}

export function SiteShell({ hasSavedAccount, onOpenAccount, children }: SiteShellProps) {
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  function changeFontSize(size: FontSize) {
    setFontSize(size);
    try {
      localStorage.setItem("app_font_size", size);
    } catch {
      // Ignore
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="หน้าลงทะเบียน">
            <span className="brand-mark" aria-hidden="true">✚</span>
            <span><strong>OPD Queue</strong><small>ระบบลงทะเบียนผู้ป่วย</small></span>
          </Link>
          
          <div className="header-actions">
            <div className="font-scaler" role="group" aria-label="ปรับขนาดตัวอักษร">
              <span className="font-scaler-label" aria-hidden="true">ขนาดตัวอักษร:</span>
              <button
                type="button"
                className={`font-btn ${fontSize === "normal" ? "active" : ""}`}
                onClick={() => changeFontSize("normal")}
                aria-label="ตัวอักษรขนาดปกติ"
                title="ขนาดปกติ (ก)"
              >
                ก
              </button>
              <button
                type="button"
                className={`font-btn large ${fontSize === "large" ? "active" : ""}`}
                onClick={() => changeFontSize("large")}
                aria-label="ตัวอักษรขนาดใหญ่"
                title="ขนาดใหญ่ (ก+)"
              >
                ก+
              </button>
              <button
                type="button"
                className={`font-btn xlarge ${fontSize === "xlarge" ? "active" : ""}`}
                onClick={() => changeFontSize("xlarge")}
                aria-label="ตัวอักษรขนาดใหญ่พิเศษ"
                title="ขนาดใหญ่พิเศษ (ก++)"
              >
                ก++
              </button>
            </div>

            {hasSavedAccount && <button className="text-button" type="button" onClick={onOpenAccount}>บัญชีของฉัน</button>}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer>ระบบจัดการคิวผู้ป่วย OPD · ข้อมูลในระบบใช้เพื่อโครงงานการศึกษา</footer>
    </>
  );
}

