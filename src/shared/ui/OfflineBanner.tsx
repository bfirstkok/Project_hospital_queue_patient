"use client";

import { useEffect, useState } from "react";

/**
 * App-wide banner shown whenever the browser reports no network connection, so
 * the patient knows queue updates are paused rather than assuming the queue moved.
 * Sits above the mobile bottom nav (see .offline-banner in globals.css).
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
