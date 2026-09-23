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
  readPairedPatient,
  savePairedPatient,
} from "@/shared/auth/pin-storage";
import { patientApi } from "@/shared/api/patient-api";
import type { PatientProfile, RegistrationResult } from "@/shared/api/types";
import { SiteShell, type FontSize } from "@/shared/ui/SiteShell";
import type { NavView } from "@/shared/ui/AppNavbar";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { formatMaskedNationalId } from "@/shared/data/thai-id";

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

/**
 * Reads initial font size preference from local storage.
 */
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

/**
 * Main Single Page Application (SPA) orchestrator and state controller.
 *
 * Responsibilities:
 * 1. Controls application view routing (state-based navigation).
 * 2. Manages authentication lifecycle: access token, unlocked session flag, 401 expiration, and logout.
 * 3. Enforces 2-step security verification flow (Credentials -> 6-Digit PIN).
 * 4. Synchronizes live queue status with `AppNavbar` badges.
 */
export default function Page() {
  const [view, setView] = useState<View>("login");
  const [pinSetupReturnView, setPinSetupReturnView] = useState<View>("status");
  const [token, setToken] = useState("");
  const [pendingAuth, setPendingAuth] = useState<{ token: string; nationalId?: string } | null>(null);
  const [googleOnboarding, setGoogleOnboarding] = useState<{ tempToken: string; suggestedProfile: PatientProfile } | null>(null);
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

  /**
   * Completes authentication: stores the access token in memory and sets the unlocked session flag.
   */
  const authenticate = useCallback((accessToken: string) => {
    saveToken(accessToken);
    setToken(accessToken);
    try {
      sessionStorage.setItem("patient_session_unlocked", "true");
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Synchronizes live queue active state to control badges and enable/disable booking actions.
   */
  const handleQueueStateChange = useCallback((active: boolean) => {
    setQueueActive(active);
    if (!active) setInitialQueue(null);
  }, []);

  /**
   * Clears state and redirects the patient back to the login view.
   *
   * @param {boolean} clearPinData - If true, clears PIN and paired patient cache as well (e.g. account switching).
   */
  const resetToLogin = useCallback(
    (clearPinData: boolean) => {
      clearToken();
      if (clearPinData) {
        clearPin(pendingAuth?.nationalId);
        clearPairedPatient();
      }
      try {
        sessionStorage.removeItem("patient_session_unlocked");
        localStorage.removeItem(VIEW_STORAGE_KEY);
      } catch {
        // Ignore
      }
      setToken("");
      setPendingAuth(null);
      setGoogleOnboarding(null);
      setInitialQueue(null);
      setQueueActive(false);
      setView("login");
    },
    [pendingAuth],
  );

  /** Clears the session after logout or an expired/unauthorized request. */
  const resetSession = useCallback(() => resetToLogin(false), [resetToLogin]);
  const expireSession = resetSession;

  const logout = resetSession;

  /**
   * Handles forgotten PIN scenario (clears existing PIN data and redirects to login).
   */
  const handleForgotPin = useCallback(() => resetToLogin(true), [resetToLogin]);

  const handleSwitchAccount = handleForgotPin;

  const activeQueueNumber = initialQueue?.queue_number || null;
  const hasSavedAccount = Boolean(token);
  const hasActiveQueue = Boolean(activeQueueNumber || queueActive);

  /**
   * Switches view when the user selects a tab in the navigation bar (`AppNavbar`).
   */
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

  /**
   * Returns patient to home view (status view when authenticated, or login view when guest).
   */
  const handleHomeClick = useCallback(() => {
    if (hasSavedAccount) {
      setView("status");
    } else {
      setGoogleOnboarding(null);
      setPendingAuth(null);
      setView("login");
    }
  }, [hasSavedAccount]);

  /**
   * Fetches patient profile from API and caches it in sessionStorage to show greeting name on PIN screen.
   */
  function fetchAndSavePairedProfile(accessToken: string) {
    patientApi
      .account(accessToken)
      .then((account) => {
        if (account.profile) {
          const natId = account.profile.national_id || "";
          const masked =
            natId.length === 13
              ? formatMaskedNationalId(natId)
              : undefined;
          savePairedPatient({
            name: `${account.profile.first_name} ${account.profile.last_name}`.trim(),
            nationalId: natId,
            maskedId: masked,
            phone: account.profile.phone || undefined,
            email: account.profile.email || undefined,
          });
        }
      })
      .catch((reason) => {
        // Non-fatal: PIN greeting just won't show a name. Surface for debugging.
        console.warn("Could not cache paired patient profile:", reason);
      });
  }

  /**
   * Handles successful registration and queue booking.
   * Checks if PIN exists; if not, navigates to PIN setup (`pin_setup`).
   */
  function registrationSuccess(accessToken: string, result: RegistrationResult) {
    setGoogleOnboarding(null);
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

  /**
   * Handles successful login via credentials or Google OAuth.
   * Navigates to PIN unlock or PIN setup view.
   */
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

  /**
   * Handles completion of PIN authentication (successful unlock).
   * Authenticates session with token and navigates to target view (e.g., 'status').
   */
  function finishPinFlow(nextView: View) {
    const finalToken = pendingAuth?.token || token || readToken() || "";
    if (finalToken) {
      authenticate(finalToken);
    }
    setPendingAuth(null);
    setView(nextView);
  }

  /**
   * Synchronizes newly configured 6-digit security PIN to backend server.
   */
  async function persistPin(pin: string) {
    const activeTok = pendingAuth?.token || token;
    if (activeTok) {
      try {
        await patientApi.setupPin(pin, activeTok);
      } catch (reason) {
        // ponytail: local PIN stays usable offline; once the backend PIN is
        // authoritative this should hard-fail and roll back the local PIN.
        console.warn("Could not sync PIN to backend:", reason);
      }
    }
  }

  /**
   * Changes application font size and persists preference to localStorage.
   */
  function changeFontSize(size: FontSize) {
    setFontSize(size);
    try {
      localStorage.setItem("app_font_size", size);
      document.documentElement.dataset.fontSize = size;
    } catch {
      // Ignore
    }
  }

  // Same identity for every PIN view — whether entered from the unlock gate
  // (pendingAuth set) or from Settings after login (pendingAuth null).
  const pinNationalId = pendingAuth?.nationalId || readPairedPatient()?.nationalId || undefined;

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

  // Test hook: Allows testers to verify Error Boundary recovery UI by visiting ?simulate_crash=true
  if (typeof window !== "undefined" && window.location.search.includes("simulate_crash=true")) {
    throw new Error("Simulated Test Crash for Error Boundary Verification");
  }

  return (
    <SiteShell
      currentView={view}
      onSelectView={handleSelectNav}
      onHome={handleHomeClick}
      hasSavedAccount={hasSavedAccount}
      hasActiveQueue={hasActiveQueue}
      queueNumber={activeQueueNumber}
      hideNav={isAuthGateView}
    >
      {/* 1. Login Gate */}
      {view === "login" && (
        <LoginView
          onRegister={() => {
            setGoogleOnboarding(null);
            setView("registration");
          }}
          onSuccess={loginSuccess}
          onGoogleRegister={(tempToken, suggestedProfile) => {
            setGoogleOnboarding({
              tempToken,
              suggestedProfile: {
                first_name: suggestedProfile?.first_name || "",
                last_name: suggestedProfile?.last_name || "",
                email: suggestedProfile?.email || null,
              },
            });
            setView("registration");
          }}
        />
      )}

      {/* 2. PIN Security Views */}
      {view === "pin_unlock" && (
        <PinAuthView
          mode="unlock"
          nationalId={pinNationalId}
          onSuccess={() => finishPinFlow("status")}
          onForgotPin={handleForgotPin}
          onSwitchAccount={handleSwitchAccount}
          onPinConfigured={persistPin}
          onCancel={() => {
            setPendingAuth(null);
            setView("login");
          }}
        />
      )}

      {view === "pin_setup" && (
        <PinAuthView
          mode="setup"
          nationalId={pinNationalId}
          isMandatory={Boolean(pendingAuth)}
          onSuccess={() => finishPinFlow(pinSetupReturnView)}
          onCancel={() => {
            setPendingAuth(null);
            setView(hasSavedAccount && !pendingAuth ? pinSetupReturnView : "login");
          }}
          onPinConfigured={persistPin}
        />
      )}

      {view === "pin_change" && (
        <PinAuthView
          mode="change"
          nationalId={pinNationalId}
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
          onPinConfigured={persistPin}
        />
      )}

      {view === "pin_reset" && (
        <PinAuthView
          mode="reset"
          nationalId={pinNationalId}
          onSuccess={() => finishPinFlow(hasSavedAccount && !pendingAuth ? "settings" : "status")}
          onForgotPin={handleForgotPin}
          onSwitchAccount={handleSwitchAccount}
          onCancel={() => {
            setPendingAuth(null);
            setView(hasSavedAccount && !pendingAuth ? "settings" : "login");
          }}
          onPinConfigured={persistPin}
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
          googleTempToken={googleOnboarding?.tempToken}
          initialProfile={googleOnboarding?.suggestedProfile}
          onLogin={() => {
            setGoogleOnboarding(null);
            setView("login");
          }}
          onCancel={() => {
            setGoogleOnboarding(null);
            setView(hasSavedAccount ? "status" : "login");
          }}
          onSuccess={registrationSuccess}
          onUnauthorized={expireSession}
          onDuplicateQueue={(existingToken, natId) => loginSuccess(existingToken, natId || undefined)}
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
