"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountView } from "@/features/account/AccountView";
import { LoginView } from "@/features/auth/LoginView";
import { QueueStatusView } from "@/features/queue/QueueStatusView";
import { RegistrationView } from "@/features/registration/RegistrationView";
import { clearToken, readToken, saveToken } from "@/shared/auth/token-storage";
import type { RegistrationResult } from "@/shared/api/types";
import { SiteShell } from "@/shared/ui/SiteShell";

type View = "registration" | "login" | "status" | "account";

export default function Page() {
  const [view, setView] = useState<View>("registration");
  const [token, setToken] = useState("");
  const [initialQueue, setInitialQueue] = useState<Partial<RegistrationResult> | null>(null);
  const hasSavedAccount = Boolean(token);

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(readToken() || ""));
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.body.dataset.view = `${view}View`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const authenticate = useCallback((accessToken: string) => {
    saveToken(accessToken);
    setToken(accessToken);
  }, []);
  const expireSession = useCallback(() => {
    clearToken();
    setToken("");
    setInitialQueue(null);
    setView("login");
  }, []);
  const logout = useCallback(() => {
    clearToken();
    setToken("");
    setInitialQueue(null);
    setView("login");
  }, []);

  function registrationSuccess(accessToken: string, result: RegistrationResult) {
    authenticate(accessToken);
    setInitialQueue(result);
    setView("status");
  }
  function loginSuccess(accessToken: string) {
    authenticate(accessToken);
    setInitialQueue(null);
    setView("account");
  }

  return <SiteShell hasSavedAccount={hasSavedAccount} onOpenAccount={() => setView("account")}>
    {view === "registration" && <RegistrationView onLogin={() => setView("login")} onSuccess={registrationSuccess} />}
    {view === "login" && <LoginView onBack={() => setView("registration")} onSuccess={loginSuccess} />}
    {view === "status" && token && <QueueStatusView token={token} initialQueue={initialQueue} onAccount={() => setView("account")} onUnauthorized={expireSession} />}
    {view === "account" && token && <AccountView token={token} onQueue={() => setView("status")} onLogout={logout} onUnauthorized={expireSession} />}
  </SiteShell>;
}
