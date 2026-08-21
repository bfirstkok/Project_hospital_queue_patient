import type { ReactNode } from "react";

export type NavView = "status" | "registration" | "account" | "settings";

interface AppNavbarProps {
  currentView: string;
  onSelectView: (view: NavView) => void;
  hasActiveQueue?: boolean;
  queueNumber?: string | null;
  hasToken: boolean;
}

export function AppNavbar({
  currentView,
  onSelectView,
  hasActiveQueue,
  queueNumber,
}: AppNavbarProps) {
  const items: Array<{
    id: NavView;
    label: string;
    icon: ReactNode;
    hasBadge?: boolean;
    badgeText?: string | null;
  }> = [
    {
      id: "status",
      label: "คิวของฉัน",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="12" y2="16" />
        </svg>
      ),
      hasBadge: Boolean(hasActiveQueue),
      badgeText: hasActiveQueue ? (queueNumber || "คิวสด") : null,
    },
    {
      id: "registration",
      label: "จองคิว",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      id: "account",
      label: "ข้อมูล & บัญชี",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "ตั้งค่า",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="app-nav-bar" aria-label="เมนูหลักของระบบ">
      <div className="nav-items-container">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="nav-icon-wrapper">
                {item.icon}
                {item.hasBadge && <span className="nav-dot-badge" aria-hidden="true" />}
              </div>
              <span className="nav-tab-label">{item.label}</span>
              {item.badgeText && (
                <span className="nav-pill-badge">{item.badgeText}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
