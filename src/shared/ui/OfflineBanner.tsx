"use client";

import { useEffect, useState } from "react";

/**
 * คอมโพเนนต์แถบแจ้งเตือนสถานะการเชื่อมต่อเครือข่ายออฟไลน์/ออนไลน์ (`OfflineBanner`)
 *
 * การทำงานและการตรวจจับ (สำคัญสำหรับโครงงานระบบเรียลไทม์):
 * 1. ดักฟัง Event `online` และ `offline` จาก Web API ของเบราว์เซอร์
 * 2. เมื่ออินเทอร์เน็ตหลุด (offline): แสดงแถบสีส้มเตือนว่าการดึงข้อมูลคิวถูกหยุดชั่วคราว เพื่อไม่ให้เกิดข้อผิดพลาดในการดึงข้อมูล
 * 3. เมื่อสัญญาณอินเทอร์เน็ตกลับมา (online): แสดงแถบสีเขียวแจ้งว่ากลับมาเชื่อมต่อแล้ว พร้อมตั้งเวลาซ่อนอัตโนมัติใน 3.5 วินาที
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // ฟังก์ชันทำงานเมื่อเน็ตกลับมาต่อติด
    const handleOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    // ฟังก์ชันทำงานเมื่อเน็ตหลุด
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

  // กรณีสัญญาณเพิ่งเชื่อมต่อกลับมาสำเร็จ
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

  // กรณีไม่มีสัญญาณอินเทอร์เน็ต
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
