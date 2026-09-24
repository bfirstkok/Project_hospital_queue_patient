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

// รายชื่อมุมมองหน้าจอทั้งหมดในระบบ Single Page Application (SPA State Machine)
type View =
  | "login"          // หน้าเข้าสู่ระบบด้วยรหัสผ่าน / Google
  | "pin_unlock"     // หน้าปลดล็อกด้วยรหัส PIN 6 หลัก
  | "pin_setup"      // หน้าตั้งค่ารหัส PIN 6 หลักครั้งแรก
  | "pin_change"     // หน้าเปลี่ยนรหัส PIN
  | "pin_reset"      // หน้ารีเซ็ตรหัส PIN ด้วย OTP
  | "status"         // หน้าแสดงบัตรคิวและสถานะคิวสด
  | "registration"   // หน้าลงทะเบียนและจองคิวตรวจ OPD
  | "account"        // หน้าประวัติผู้ป่วยและผลตรวจ
  | "settings";      // หน้าตั้งค่าระบบ ขนาดตัวอักษร และความปลอดภัย

/**
 * ดึงค่าขนาดตัวอักษรเริ่มต้นที่ผู้ใช้เคยตั้งค่าไว้จาก localStorage
 */
function getInitialFontSize(): FontSize {
  if (typeof window === "undefined") return "normal";
  try {
    const saved = localStorage.getItem("app_font_size") as FontSize | null;
    if (saved && (saved === "normal" || saved === "large" || saved === "xlarge")) {
      return saved;
    }
  } catch {
    // ข้ามข้อผิดพลาด storage
  }
  return "normal";
}

const VIEW_STORAGE_KEY = "patient_app_current_view";

/**
 * คอมโพเนนต์หน้าหลักของแอปพลิเคชัน (`Page`) - ทำหน้าที่เป็น Central State Controller & Router
 * (หัวใจหลักของสถาปัตยกรรม Frontend SPA ที่ต้องอธิบายในเล่มวิทยานิพนธ์และการสอบ)
 *
 * บทบาทหน้าที่หลัก:
 * 1. ควบคุมการสลับหน้าจอ (State-based Navigation Routing) โดยไม่ต้องโหลดหน้าเว็บใหม่
 * 2. วงจรความปลอดภัยแบบ 2 ชั้น (Two-Step Verification): เข้าสู่ระบบ -> ยืนยันรหัส PIN 6 หลัก
 * 3. บริหารจัดการวงจรชีวิตของเซสชัน (Token Lifecycle, ปลดล็อก Session, จัดการกรณี Token หมดอายุ 401, และการออกจากระบบ)
 * 4. ซิงค์สถานะคิวสดกับ Badge บนแถบเมนูนำทาง (`AppNavbar`)
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

  // ตรวจสอบสถานะการเข้าสู่ระบบและเซสชันเมื่อเปิดแอปพลิเคชันขึ้นมาครั้งแรก
  useEffect(() => {
    let isUnlocked = false;
    try {
      isUnlocked = sessionStorage.getItem("patient_session_unlocked") === "true";
    } catch {
      // ข้ามข้อผิดพลาด storage
    }

    const savedToken = readToken() || "";
    let savedView: View | null = null;
    try {
      savedView = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    } catch {
      // ข้ามข้อผิดพลาด storage
    }

    // หากมี Token และเซสชันปลดล็อกเรียบร้อยแล้ว ให้เปิดหน้าที่เคยเข้าไว้
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
      // หากยังไม่ได้ปลดล็อกเซสชัน ให้เริ่มต้นที่หน้าเข้าสู่ระบบเสมอ
      setView("login");
    }
    setInitialized(true);
  }, []);

  // ซิงค์มุมมองปัจจุบันกับ Body Dataset และจัดเก็บหน้าจอล่าสุดไว้ใน Storage
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
        // ข้ามข้อผิดพลาด storage
      }
    }
  }, [view, token, pendingAuth]);

  /**
   * ยืนยันการเข้าสู่ระบบสำเร็จ: บันทึก Token ลงหน่วยความจำ และตั้งค่าแฟล็กปลดล็อกเซสชันใน sessionStorage
   */
  const authenticate = useCallback((accessToken: string) => {
    saveToken(accessToken);
    setToken(accessToken);
    try {
      sessionStorage.setItem("patient_session_unlocked", "true");
    } catch {
      // ข้ามข้อผิดพลาด storage
    }
  }, []);

  /**
   * ซิงค์สถานะว่ามีคิวตรวจที่ยังดำเนินอยู่หรือไม่ เพื่อเปิด/ปิดการแจ้งเตือนและปุ่มจองคิว
   */
  const handleQueueStateChange = useCallback((active: boolean) => {
    setQueueActive(active);
    if (!active) setInitialQueue(null);
  }, []);

  /**
   * ล้างข้อมูลเซสชันและนำผู้ป่วยกลับสู่หน้าเข้าสู่ระบบ
   *
   * @param {boolean} clearPinData - หากเป็น true จะล้างรหัส PIN และข้อมูลผู้ป่วยที่จับคู่ไว้ด้วย (เช่น กรณีสลับบัญชี)
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
        // ข้ามข้อผิดพลาด storage
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

  // ล้างเซสชันเมื่อออกจากระบบ หรือเมื่อ Token หมดอายุ (HTTP 401 Unauthorized)
  const resetSession = useCallback(() => resetToLogin(false), [resetToLogin]);
  const expireSession = resetSession;
  const logout = resetSession;

  // จัดการเมื่อผู้ป่วยลืมรหัส PIN: ล้างข้อมูล PIN เดิม แล้วนำทางไปยืนยันตัวตนใหม่
  const handleForgotPin = useCallback(() => resetToLogin(true), [resetToLogin]);
  const handleSwitchAccount = handleForgotPin;

  const activeQueueNumber = initialQueue?.queue_number || null;
  const hasSavedAccount = Boolean(token);
  const hasActiveQueue = Boolean(activeQueueNumber || queueActive);

  /**
   * สลับหน้าจอเมื่อผู้ใช้คลิกเลือกแท็บบนแถบนำทาง (`AppNavbar`)
   */
  function handleSelectNav(navView: NavView) {
    if (!token && navView !== "registration") {
      setView("login");
      return;
    }
    // หากมีคิวตรวจอยู่แล้ว จะไม่อนุญาตให้เปิดหน้าจองคิวซ้ำ แต่จะพาไปดูคิวสดแทน
    if (navView === "registration" && hasActiveQueue) {
      setView("status");
      return;
    }
    setView(navView);
  }

  /**
   * จัดการเมื่อผู้ใช้กดโลโก้หน้าหลัก: หากเข้าสู่ระบบแล้วจะไปหน้าคิว หากยังไม่เข้าสู่ระบบจะไปหน้าแรก
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
   * ดึงข้อมูลโปรไฟล์ผู้ป่วยจากเซิร์ฟเวอร์มาบันทึกไว้ใน sessionStorage เพื่อนำชื่อมาแสดงทักทายในหน้า PIN
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
        console.warn("Could not cache paired patient profile:", reason);
      });
  }

  /**
   * ผู้สมัครใหม่ต้องตั้ง PIN เสมอ ไม่ขึ้นกับ PIN เก่าที่อาจค้างอยู่บนอุปกรณ์นี้
   */
  function registrationSuccess(accessToken: string, result: RegistrationResult, nationalId: string) {
    setGoogleOnboarding(null);
    setPendingAuth({ token: accessToken, nationalId });
    setInitialQueue(result);
    setQueueActive(true);
    fetchAndSavePairedProfile(accessToken);

    setPinSetupReturnView("status");
    setView("pin_setup");
  }

  /**
   * จัดการเมื่อเข้าสู่ระบบด้วยรหัสผ่านหรือ Google สำเร็จ:
   * นำทางไปยังหน้าปลดล็อก PIN หรือหน้าตั้งรหัส PIN ใหม่
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
   * ทำงานเมื่อผ่านการยืนยันรหัส PIN 6 หลักถูกต้อง:
   * ยืนยันเซสชันด้วย Token และนำทางไปยังหน้าปลายทาง เช่น หน้าสถานะคิว
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
   * ซิงค์รหัส PIN 6 หลักที่ตั้งใหม่ไปยัง Backend API
   */
  async function persistPin(pin: string) {
    const activeTok = pendingAuth?.token || token;
    if (activeTok) {
      try {
        await patientApi.setupPin(pin, activeTok);
      } catch (reason) {
        console.warn("Could not sync PIN to backend:", reason);
      }
    }
  }

  /**
   * ปรับเปลี่ยนขนาดตัวอักษรของทั้งระบบ และบันทึกลงใน localStorage
   */
  function changeFontSize(size: FontSize) {
    setFontSize(size);
    try {
      localStorage.setItem("app_font_size", size);
      document.documentElement.dataset.fontSize = size;
    } catch {
      // ข้ามข้อผิดพลาด storage
    }
  }

  // ดึงเลขบัตรประชาชนสำหรับใช้ระบุตัวตนในทุกหน้าจอ PIN
  const pinNationalId = pendingAuth?.nationalId || readPairedPatient()?.nationalId || undefined;

  // ตรวจสอบว่าหน้าจอปัจจุบันเป็นหน้าจอด่านความปลอดภัย (Authentication Gate) หรือไม่ เพื่อสั่งซ่อน Navbar
  const isAuthGateView =
    !hasSavedAccount ||
    Boolean(pendingAuth) ||
    view === "login" ||
    view === "pin_unlock" ||
    view === "pin_setup" ||
    view === "pin_change" ||
    view === "pin_reset";

  // กรณีระบบกำลังโหลดค่าเริ่มต้น
  if (!initialized) {
    return (
      <LoadingScreen
        title="กำลังโหลด"
        subtitle="กำลังตรวจสอบสถานะความปลอดภัยและการเข้าสู่ระบบ"
        fullScreen
      />
    );
  }

  // ฮุคสำหรับทดสอบระบบ Error Boundary (พิมพ์ URL ?simulate_crash=true เพื่อจำลองกรณีแอปขัดข้อง)
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
      {/* 1. หน้าต่างเข้าสู่ระบบ (Login Gate) */}
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

      {/* 2. หน้าจอยืนยันความปลอดภัยด้วย PIN 6 หลัก */}
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

      {/* หน้าจอตั้งรหัส PIN ใหม่ครั้งแรก */}
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

      {/* หน้าจอเปลี่ยนรหัส PIN */}
      {view === "pin_change" && (
        <PinAuthView
          mode="change"
          nationalId={pinNationalId}
          onSuccess={() => setView("settings")}
          onCancel={() => setView("settings")}
          onPinConfigured={persistPin}
        />
      )}

      {/* หน้าจอกู้คืนรหัส PIN ผ่าน OTP */}
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

      {/* 3. หน้าจอหลักของพอร์ทัลผู้ป่วย */}
      {/* หน้าจอสถานะบัตรคิวสด */}
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

      {/* หน้าจอลงทะเบียนผู้ป่วยและจองคิว */}
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

      {/* หน้าจอบัญชีผู้ป่วย ประวัติการรักษา และนัดหมาย */}
      {view === "account" && (
        <AccountView
          token={token}
          onQueue={() => setView("status")}
          onLogout={logout}
          onUnauthorized={expireSession}
        />
      )}

      {/* หน้าจอตั้งค่าระบบ ขนาดตัวอักษร และความปลอดภัย */}
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
