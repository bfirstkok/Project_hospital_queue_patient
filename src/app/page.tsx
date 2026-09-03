"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountView } from "@/features/account/AccountView";
import { LoginView } from "@/features/auth/LoginView";
import { PinAuthView } from "@/features/auth/PinAuthView";
import { QueueStatusView } from "@/features/queue/QueueStatusView";
import { RegistrationView } from "@/features/registration/RegistrationView";
import { SettingsView } from "@/features/settings/SettingsView";
import { clearToken, readToken, saveToken } from "@/shared/auth/token-storage";
import {
  clearPairedPatient,
  clearPin,
  hasPin,
  isPinEnabled,
  savePairedPatient,
} from "@/shared/auth/pin-storage";
import { patientApi } from "@/shared/api/patient-api";
import type { RegistrationResult } from "@/shared/api/types";
import { SiteShell, type FontSize } from "@/shared/ui/SiteShell";
import type { NavView } from "@/shared/ui/AppNavbar";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

type View =
  | "login"
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
  const [pinSetupReturnView, setPinSetupReturnView] = useState<View>("status");
  const [token, setToken] = useState("");
  const [pendingAuth, setPendingAuth] = useState<{ token: string; nationalId?: string } | null>(null);
  const [initialQueue, setInitialQueue] = useState<Partial<RegistrationResult> | null>(null);
  const [queueActive, setQueueActive] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isUnlocked = false;
    try {
      isUnlocked = sessionStorage.getItem("patient_session_unlocked") === "true";
    } catch {
      // Ignore
    }

    const savedToken = readToken() || "";
    let savedView: View | null = null;
    try {
      savedView = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    } catch {
      // Ignore
    }

    if (savedToken && isUnlocked) {
      setToken(savedToken);
      if (
        savedView &&
        (savedView === "status" || savedView === "registration" || savedView === "account" || savedView === "settings")
      ) {
        setView(savedView);
      } else {
        setView("status");
      }
    } else {
      // Starting on website -> always choose login method first
      setView("login");
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (
      !token &&
      !pendingAuth &&
      view !== "login" &&
      view !== "registration" &&
      view !== "pin_unlock" &&
      view !== "pin_setup" &&
      view !== "pin_reset"
    ) {
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
  }, [view, token, pendingAuth]);

  const authenticate = useCallback((accessToken: string) => {
    saveToken(accessToken);
    setToken(accessToken);
    try {
      sessionStorage.setItem("patient_session_unlocked", "true");
    } catch {
      // Ignore
    }
  }, []);

  const handleQueueStateChange = useCallback((active: boolean) => {
    setQueueActive(active);
    if (!active) setInitialQueue(null);
  }, []);

  const expireSession = useCallback(() => {
    clearToken();
    try {
      sessionStorage.removeItem("patient_session_unlocked");
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setToken("");
    setPendingAuth(null);
    setInitialQueue(null);
    setQueueActive(false);
    setView("login");
  }, []);

  const logout = useCallback(() => {
    clearToken();
    try {
      sessionStorage.removeItem("patient_session_unlocked");
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setToken("");
    setPendingAuth(null);
    setInitialQueue(null);
    setQueueActive(false);
    setView("login");
  }, []);

  const handleForgotPin = useCallback(() => {
    clearToken();
    clearPin(pendingAuth?.nationalId);
    clearPairedPatient();
    try {
      sessionStorage.removeItem("patient_session_unlocked");
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setToken("");
    setPendingAuth(null);
    setInitialQueue(null);
    setQueueActive(false);
    setView("login");
  }, [pendingAuth]);

  const handleSwitchAccount = useCallback(() => {
    clearToken();
    clearPin(pendingAuth?.nationalId);
    clearPairedPatient();
    try {
      sessionStorage.removeItem("patient_session_unlocked");
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setToken("");
    setPendingAuth(null);
    setInitialQueue(null);
    setQueueActive(false);
    setView("login");
  }, [pendingAuth]);

  const activeQueueNumber = initialQueue?.queue_number || null;
  const hasSavedAccount = Boolean(token);
  const hasActiveQueue = Boolean(activeQueueNumber || queueActive);

  function handleSelectNav(navView: NavView) {
    if (!token && navView !== "registration") {
      setView("login");
      return;
    }
    if (navView === "registration" && hasActiveQueue) {
      setView("status");
      return;
    }
    setView(navView);
  }

  function fetchAndSavePairedProfile(accessToken: string) {
    patientApi
      .account(accessToken)
      .then((account) => {
        if (account.profile) {
          const natId = account.profile.national_id || "";
          const masked =
            natId.length === 13
              ? `${natId[0]}-xxxx-xxxx${natId.slice(9, 11)}-${natId[12]}`
              : undefined;
          savePairedPatient({
            name: `${account.profile.first_name} ${account.profile.last_name}`.trim(),
            nationalId: natId,
            maskedId: masked,
          });
        }
      })
      .catch(() => {
        // Fallback gracefully if backend is offline
      });
  }

  function registrationSuccess(accessToken: string, result: RegistrationResult) {
    setPendingAuth({ token: accessToken });
    setInitialQueue(result);
    setQueueActive(true);
    fetchAndSavePairedProfile(accessToken);

    if (!hasPin()) {
      setPinSetupReturnView("status");
      setView("pin_setup");
    } else {
      setView("pin_unlock");
    }
  }

  function loginSuccess(accessToken: string, nationalId?: string) {
    setPendingAuth({ token: accessToken, nationalId });
    setInitialQueue(null);
    setQueueActive(false);
    fetchAndSavePairedProfile(accessToken);

    const userHasPin = hasPin(nationalId);
    if (userHasPin) {
      setView("pin_unlock");
    } else {
      setPinSetupReturnView("status");
      setView("pin_setup");
    }
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

  const isAuthGateView =
    !hasSavedAccount ||
    Boolean(pendingAuth) ||
    view === "login" ||
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
          onSuccess={loginSuccess}
          onUnlockWithPin={undefined}
        />
      )}

      {/* 2. PIN Security Views */}
      {view === "pin_unlock" && (
        <PinAuthView
          mode="unlock"
          nationalId={pendingAuth?.nationalId}
          onSuccess={() => {
            const finalToken = pendingAuth?.token || token || readToken() || "";
            if (finalToken) {
              authenticate(finalToken);
            }
            setPendingAuth(null);
            setView("status");
          }}
          onForgotPin={handleForgotPin}
          onSwitchAccount={handleSwitchAccount}
          onCancel={() => {
            setPendingAuth(null);
            setView("login");
          }}
        />
      )}

      {view === "pin_setup" && (
        <PinAuthView
          mode="setup"
          nationalId={pendingAuth?.nationalId}
          isMandatory={Boolean(pendingAuth)}
          onSuccess={() => {
            const finalToken = pendingAuth?.token || token || readToken() || "";
            if (finalToken) {
              authenticate(finalToken);
            }
            setPendingAuth(null);
            setView(pinSetupReturnView);
          }}
          onCancel={() => {
            setPendingAuth(null);
            setView(hasSavedAccount && !pendingAuth ? pinSetupReturnView : "login");
          }}
          onPinConfigured={async (pin) => {
            const activeTok = pendingAuth?.token || token;
            if (activeTok) {
              try {
                await patientApi.setupPin(pin, activeTok);
              } catch {
                // Graceful fallback
              }
            }
          }}
        />
      )}

      {view === "pin_change" && (
        <PinAuthView
          mode="change"
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
          onPinConfigured={async (pin) => {
            if (token) {
              try {
                await patientApi.setupPin(pin, token);
              } catch {
                // Graceful fallback
              }
            }
          }}
        />
      )}

      {view === "pin_reset" && (
        <PinAuthView
          mode="reset"
          nationalId={pendingAuth?.nationalId}
          onSuccess={() => {
            const finalToken = pendingAuth?.token || token || readToken() || "";
            if (finalToken) {
              authenticate(finalToken);
            }
            setPendingAuth(null);
            setView(hasSavedAccount && !pendingAuth ? "settings" : "status");
          }}
          onCancel={() => {
            setPendingAuth(null);
            setView(hasSavedAccount && !pendingAuth ? "settings" : "login");
          }}
          onPinConfigured={async (pin) => {
            const activeTok = pendingAuth?.token || token;
            if (activeTok) {
              try {
                await patientApi.setupPin(pin, activeTok);
              } catch {
                // Graceful fallback
              }
            }
          }}
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
          onQueueStateChange={handleQueueStateChange}
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
          onSetupPin={() => {
            setPinSetupReturnView("settings");
            setView("pin_setup");
          }}
          onChangePin={() => setView("pin_change")}
          onResetPin={() => setView("pin_reset")}
        />
      )}
    </SiteShell>
  );
}
