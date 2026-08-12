import type { ReactNode } from "react";
import Link from "next/link";

interface SiteShellProps {
  hasSavedAccount: boolean;
  onOpenAccount: () => void;
  children: ReactNode;
}

export function SiteShell({ hasSavedAccount, onOpenAccount, children }: SiteShellProps) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="หน้าลงทะเบียน">
            <span className="brand-mark" aria-hidden="true">✚</span>
            <span><strong>OPD Queue</strong><small>ระบบลงทะเบียนผู้ป่วย</small></span>
          </Link>
          {hasSavedAccount && <button className="text-button" type="button" onClick={onOpenAccount}>บัญชีของฉัน</button>}
        </div>
      </header>
      <main>{children}</main>
      <footer>ระบบจัดการคิวผู้ป่วย OPD · ข้อมูลในระบบใช้เพื่อโครงงานการศึกษา</footer>
    </>
  );
}
