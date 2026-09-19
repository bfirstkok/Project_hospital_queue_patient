"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Catches render/lifecycle crashes in any view so the patient sees a recovery
 * screen instead of a blank page. Reloading re-runs the auth gate from scratch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error || "");
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled UI error:", error);
  }

  handleGoHome = () => {
    try {
      localStorage.removeItem("patient_app_current_view");
      sessionStorage.removeItem("patient_session_unlocked");
    } catch {
      // Ignore
    }
    window.location.href = "/patient";
  };

  handleReload = () => {
    try {
      localStorage.removeItem("patient_app_current_view");
    } catch {
      // Ignore
    }
    if (window.location.pathname === "/" || !window.location.pathname.startsWith("/patient")) {
      window.location.href = "/patient";
    } else {
      window.location.reload();
    }
  };

  handleGoBack = () => {
    try {
      localStorage.removeItem("patient_app_current_view");
    } catch {
      // Ignore
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/patient";
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="page-shell" role="alert" style={{ textAlign: "center", paddingTop: "48px" }}>
        <div className="auth-card" style={{ maxWidth: "440px", margin: "0 auto" }}>
          <div className="auth-mark" aria-hidden="true" style={{ background: "var(--danger-bg, #fee2e2)", color: "var(--danger, #dc2626)" }}>!</div>
          <h1>ระบบขัดข้องชั่วคราว</h1>
          <p className="auth-description">
            เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณากลับสู่หน้าหลักหรือลองใหม่อีกครั้ง
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
            <button className="primary-button" type="button" onClick={this.handleGoHome}>
              <span>กลับสู่หน้าหลัก (เข้าสู่ระบบ)</span>
              <i aria-hidden="true">🏠</i>
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="secondary-button"
                type="button"
                style={{ flex: 1 }}
                onClick={this.handleGoBack}
              >
                <span>ย้อนกลับ</span>
                <i aria-hidden="true">←</i>
              </button>
              <button
                className="secondary-button"
                type="button"
                style={{ flex: 1 }}
                onClick={this.handleReload}
              >
                <span>โหลดหน้าใหม่</span>
                <i aria-hidden="true">↻</i>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
