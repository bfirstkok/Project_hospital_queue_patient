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

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      ⚠️ ไม่มีการเชื่อมต่ออินเทอร์เน็ต ระบบจะหยุดอัปเดตคิวชั่วคราวจนกว่าจะเชื่อมต่อได้อีกครั้ง
    </div>
  );
}
