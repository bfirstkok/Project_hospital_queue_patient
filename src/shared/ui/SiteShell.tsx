"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AppNavbar, type NavView } from "./AppNavbar";

// ขนาดตัวอักษรสำหรับผู้สูงอายุและการเข้าถึง (Accessibility Font Size)
export type FontSize = "normal" | "large" | "xlarge";

interface SiteShellProps {
  currentView: string;                          // มุมมองปัจจุบัน
  onSelectView: (view: NavView) => void;        // สลับแท็บ
  onHome?: () => void;                          // กลับหน้าแรก
  hasSavedAccount: boolean;                     // ตรวจสอบว่าผู้ใช้มีบัญชีที่บันทึกไว้ในเครื่องหรือไม่
  hasActiveQueue?: boolean;                     // มีคิวที่กำลังรอตรวจหรือไม่
  queueNumber?: string | null;                  // หมายเลขคิวปัจจุบัน
  hideNav?: boolean;                            // สั่งซ่อนแถบเมนูนำทาง (เช่น หน้าล็อกอิน)
  children: ReactNode;                          // เนื้อหา UI ภายในหน้าเว็บ
}

/**
 * ดึงค่าขนาดตัวอักษร (Font Size Preference) ที่ผู้ใช้เคยตั้งค่าไว้จาก localStorage
 *
 * @returns {FontSize} "normal" | "large" | "xlarge" (ค่าเริ่มต้นคือ "normal")
 */
function getInitialFontSize(): FontSize {
  if (typeof window === "undefined") return "normal";
  try {
    const saved = localStorage.getItem("app_font_size") as FontSize | null;
    if (saved && (saved === "normal" || saved === "large" || saved === "xlarge")) {
      return saved;
    }
  } catch {
    // ข้ามกรณีมีข้อผิดพลาดเรื่อง storage
  }
  return "normal";
}

/**
 * คอมโพเนนต์โครงสร้างหลักของหน้าเว็บ (`SiteShell`)
 *
 * หน้าที่การทำงาน (Layout Architecture):
 * 1. แสดงผลส่วนหัว (Header) พร้อมโลโก้และชื่อระบบโรงพยาบาล
 * 2. จัดวางแถบเมนูนำทาง (`AppNavbar`): แสดงด้านบนสำหรับ Desktop และด้านล่างสำหรับ Mobile
 * 3. จัดการขนาดตัวอักษรเพื่อผู้สูงอายุ (Elderly-Friendly UI) ผ่าน attribute `data-font-size` บนแท็ก `<html>`
 * 4. ควบคุมพื้นที่ระยะห่างขอบล่าง (Padding) ไม่ให้เมนูมือถือบังเนื้อหา และแสดงส่วนท้าย (Footer)
 */
export function SiteShell({
  currentView,
  onSelectView,
  onHome,
  hasSavedAccount,
  hasActiveQueue,
  queueNumber,
  hideNav = false,
  children,
}: SiteShellProps) {
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);

  // อัปเดต attribute บน <html> เมื่อขนาดตัวอักษรเปลี่ยน ทำให้ CSS ปรับขนาดทั่วทั้งเว็บ
  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* ส่วนหัวของเว็บไซต์ (Header) */}
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="brand"
            href="/patient"
            onClick={(e) => {
              e.preventDefault();
              if (onHome) {
                onHome();
              } else if (hasSavedAccount) {
                onSelectView("status");
              }
            }}
            aria-label="หน้าหลักโรงพยาบาล"
          >
            <span className="brand-mark" aria-hidden="true">✚</span>
            <span><strong>OPD Queue</strong><small>ระบบบริการผู้ป่วยนอก</small></span>
          </Link>

          {/* เมนูด้านบนสำหรับหน้าจอคอมพิวเตอร์ Desktop (แสดงเมื่อเข้าสู่ระบบแล้ว) */}
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

      {/* เนื้อหาหลักของแต่ละหน้า (Main Content) */}
      <main
        className={`flex-1 pb-[84px] min-[769px]:pb-[32px] ${hideNav || !hasSavedAccount ? "!pb-[24px]" : ""}`}
      >
        {children}
      </main>

      {/* แถบเมนูด้านล่างสำหรับหน้าจอมือถือ Mobile (แสดงเมื่อเข้าสู่ระบบแล้ว) */}
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

      {/* ส่วนท้ายของเว็บไซต์ (Footer) */}
      <footer className="border-t border-[var(--line)] px-[16px] pt-[24px] pb-[96px] text-center text-[0.9rem] text-muted min-[769px]:pb-[32px]">
        <p>ระบบจัดการคิวผู้ป่วย OPD โรงพยาบาล · บริการเพื่อประชาชน</p>
      </footer>
    </div>
  );
}
