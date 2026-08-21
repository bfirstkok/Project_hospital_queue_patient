import React from "react";

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  title = "กำลังโหลด",
  subtitle = "กรุณารอสักครู่ ระบบกำลังดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์",
  fullScreen = false,
}: LoadingScreenProps) {
  return (
    <div className={`app-loading-container ${fullScreen ? "full-screen" : ""}`} role="status" aria-live="polite">
      <div className="app-loading-card">
        <div className="pulse-loader-wrapper">
          <div className="pulse-ring pulse-ring-1" />
          <div className="pulse-ring pulse-ring-2" />
          <div className="pulse-icon-center">
            <svg
              className="hospital-cross-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        <div className="loading-spinner-ring" />

        <h2 className="loading-title">{title}</h2>
        {subtitle && <p className="loading-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
