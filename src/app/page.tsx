"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountView } from "@/features/account/AccountView";
import { LoginView } from "@/features/auth/LoginView";
import { ThaidConnectView } from "@/features/auth/ThaidConnectView";
import { PinAuthView } from "@/features/auth/PinAuthView";
import { QueueStatusView } from "@/features/queue/QueueStatusView";
import { RegistrationView } from "@/features/registration/RegistrationView";
import { SettingsView } from "@/features/settings/SettingsView";
import { clearToken, readToken, saveToken } from "@/shared/auth/token-storage";
import { isPinEnabled, clearPin } from "@/shared/auth/pin-storage";
import type { RegistrationResult } from "@/shared/api/types";
import { SiteShell, type FontSize } from "@/shared/ui/SiteShell";
import type { NavView } from "@/shared/ui/AppNavbar";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

type View =
  | "login"
  | "thaid_connect"
  | "pin_unlock"
  | "pin_setup"
  | "pin_change"
  | "pin_reset"
  | "status"
  | "registration"
  | "account"
  | "settings";

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

const VIEW_STORAGE_KEY = "patient_app_current_view";

export default function Page() {
  const [view, setView] = useState<View>("login");
  const [token, setToken] = useState("");
  const [initialQueue, setInitialQueue] = useState<Partial<RegistrationResult> | null>(null);
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const savedToken = readToken() || "";
    setToken(savedToken);

    let savedView: View | null = null;
    try {
      savedView = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    } catch {
      // Ignore
    }

    if (savedToken) {
      if (isPinEnabled()) {
        setView("pin_unlock");
      } else if (
        savedView &&
        (savedView === "status" || savedView === "registration" || savedView === "account" || savedView === "settings")
      ) {
        setView(savedView);
      } else {
        setView("status");
      }
    } else {
      if (savedView === "registration") {
        setView("registration");
      } else {
        setView("login");
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!token && view !== "login" && view !== "thaid_connect" && view !== "registration") {
      setView("login");
      return;
    }
    document.body.dataset.view = `${view}View`;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "status" || view === "registration" || view === "account" || view === "settings" || view === "login") {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {
        // Ignore
      }
    }
  }, [view, token]);

  const authenticate = useCallback((accessToken: string) => {
    saveToken(accessToken);
    setToken(accessToken);
  }, []);

  const expireSession = useCallback(() => {
    clearToken();
    setToken("");
    setInitialQueue(null);
    try {
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setView("login");
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken("");
    setInitialQueue(null);
    try {
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setView("login");
  }, []);

  const handleForgotPin = useCallback(() => {
    clearToken();
    clearPin();
    setToken("");
    setInitialQueue(null);
    try {
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setView("login");
  }, []);

  function handleSelectNav(navView: NavView) {
    if (!token && navView !== "registration") {
      setView("login");
      return;
    }
    setView(navView);
  }

  function registrationSuccess(accessToken: string, result: RegistrationResult) {
    authenticate(accessToken);
    setInitialQueue(result);
    setView("status");
  }

  function loginSuccess(accessToken: string) {
    authenticate(accessToken);
    setInitialQueue(null);
    setView("status");
  }

  function changeFontSize(size: FontSize) {
    setFontSize(size);
    try {
      localStorage.setItem("app_font_size", size);
      document.documentElement.dataset.fontSize = size;
    } catch {
      // Ignore
    }
  }

  const activeQueueNumber = initialQueue?.queue_number || null;
  const hasSavedAccount = Boolean(token);
  const hasActiveQueue = Boolean(activeQueueNumber || hasSavedAccount);

  const isAuthGateView =
    !hasSavedAccount ||
    view === "login" ||
    view === "thaid_connect" ||
    view === "pin_unlock" ||
    view === "pin_setup" ||
    view === "pin_change" ||
    view === "pin_reset";

  if (!initialized) {
    return (
      <LoadingScreen
        title="กำลังโหลด"
        subtitle="กำลังตรวจสอบสถานะความปลอดภัยและการเข้าสู่ระบบ"
        fullScreen
      />
    );
  }

  return (
    <SiteShell
      currentView={view}
      onSelectView={handleSelectNav}
      hasSavedAccount={hasSavedAccount}
      hasActiveQueue={hasActiveQueue}
      queueNumber={activeQueueNumber}
      hideNav={isAuthGateView}
    >
      {/* 1. Login Gate */}
      {view === "login" && (
        <LoginView
          onRegister={() => setView("registration")}
          onThaidConnect={() => setView("thaid_connect")}
          onSuccess={loginSuccess}
        />
      )}

      {/* 2. ThaID Gateway Simulation */}
      {view === "thaid_connect" && (
        <ThaidConnectView
          onSuccess={loginSuccess}
          onCancel={() => setView("login")}
        />
      )}

      {/* 3. PIN Security Views */}
      {view === "pin_unlock" && (
        <PinAuthView
          mode="unlock"
          onSuccess={() => setView("status")}
          onForgotPin={handleForgotPin}
        />
      )}

      {view === "pin_setup" && (
        <PinAuthView
          mode="setup"
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
        />
      )}

      {view === "pin_change" && (
        <PinAuthView
          mode="change"
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
        />
      )}

      {view === "pin_reset" && (
        <PinAuthView
          mode="reset"
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
        />
      )}

      {/* 4. Main Portal Views */}
      {view === "status" && (
        <QueueStatusView
          token={token}
          initialQueue={initialQueue}
          onBookQueue={() => setView("registration")}
          onLogin={() => setView("login")}
          onAccount={() => setView("account")}
          onUnauthorized={expireSession}
        />
      )}

      {view === "registration" && (
        <RegistrationView
          token={token}
          hasToken={hasSavedAccount}
          onLogin={() => setView("login")}
          onCancel={() => setView(hasSavedAccount ? "status" : "login")}
          onSuccess={registrationSuccess}
          onUnauthorized={expireSession}
        />
      )}

      {view === "account" && (
        <AccountView
          token={token}
          onQueue={() => setView("status")}
          onLogout={logout}
          onUnauthorized={expireSession}
        />
      )}

      {view === "settings" && (
        <SettingsView
          fontSize={fontSize}
          onChangeFontSize={changeFontSize}
          hasToken={hasSavedAccount}
          onLogout={logout}
          onLogin={() => setView("login")}
          onSetupPin={() => setView("pin_setup")}
          onChangePin={() => setView("pin_change")}
          onResetPin={() => setView("pin_reset")}
        />
      )}
    </SiteShell>
  );
}
