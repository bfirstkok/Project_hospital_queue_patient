"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AppNavbar, type NavView } from "./AppNavbar";

export type FontSize = "normal" | "large" | "xlarge";

interface SiteShellProps {
  currentView: string;
  onSelectView: (view: NavView) => void;
  hasSavedAccount: boolean;
  hasActiveQueue?: boolean;
  queueNumber?: string | null;
  hideNav?: boolean;
  children: ReactNode;
}

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

export function SiteShell({
  currentView,
  onSelectView,
  hasSavedAccount,
  hasActiveQueue,
  queueNumber,
  hideNav = false,
  children,
}: SiteShellProps) {
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  return (
    <div className="portal-container">
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (hasSavedAccount) {
                onSelectView("status");
              }
            }}
            aria-label="หน้าหลักโรงพยาบาล"
          >
            <span className="brand-mark" aria-hidden="true">✚</span>
            <span><strong>OPD Queue</strong><small>ระบบบริการผู้ป่วยนอก</small></span>
          </Link>

          {/* Desktop Top Menu (Shown when logged in) */}
          {!hideNav && hasSavedAccount && (
            <div className="header-desktop-nav">
              <AppNavbar
                currentView={currentView}
                onSelectView={onSelectView}
                hasActiveQueue={hasActiveQueue}
                queueNumber={queueNumber}
                hasToken={hasSavedAccount}
              />
            </div>
          )}
        </div>
      </header>

      <main className={`main-content ${hideNav || !hasSavedAccount ? "no-bottom-pad" : ""}`}>{children}</main>

      {/* Mobile Bottom Navigation Bar (Shown when logged in) */}
      {!hideNav && hasSavedAccount && (
        <div className="mobile-bottom-nav">
          <AppNavbar
            currentView={currentView}
            onSelectView={onSelectView}
            hasActiveQueue={hasActiveQueue}
            queueNumber={queueNumber}
            hasToken={hasSavedAccount}
          />
        </div>
      )}

      <footer className="site-footer">
        <p>ระบบจัดการคิวผู้ป่วย OPD โรงพยาบาล · บริการเพื่อประชาชน</p>
      </footer>
    </div>
  );
}
