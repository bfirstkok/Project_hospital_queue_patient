"use client";

import { useEffect, useState } from "react";

/**
 * Network offline warning banner component (`OfflineBanner`).
 *
 * Responsibilities:
 * Listens to browser `online` and `offline` network events.
 * Displays an amber alert banner informing the patient that queue polling is temporarily paused
 * until connectivity is restored.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setJustReconnected(false);
      setOffline(true);
    };

    setOffline(!navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!offline && !justReconnected) return null;

  if (justReconnected) {
    return (
      <aside className="offline-banner is-online" role="status" aria-live="polite">
        <div className="offline-banner-icon">
          <span>✓</span>
        </div>
        <div className="offline-banner-content">
          <strong className="offline-banner-title">เชื่อมต่ออินเทอร์เน็ตแล้ว</strong>
          <span className="offline-banner-desc">ระบบกลับมาทำงานและอัปเดตสถานะคิวตามปกติ</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="offline-banner" role="status" aria-live="assertive">
      <div className="offline-banner-icon">
        <span className="offline-pulse-dot" aria-hidden="true" />
        <span aria-hidden="true">📡</span>
      </div>
      <div className="offline-banner-content">
        <strong className="offline-banner-title">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</strong>
        <span className="offline-banner-desc">ระบบหยุดอัปเดตคิวชั่วคราว กำลังรอสัญญาณ...</span>
      </div>
    </aside>
  );
}
