"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/lifecycle crashes in any view so the patient sees a recovery
 * screen instead of a blank page. Reloading re-runs the auth gate from scratch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled UI error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="page-shell" role="alert" style={{ textAlign: "center", paddingTop: "48px" }}>
        <div className="auth-card">
          <div className="auth-mark" aria-hidden="true">!</div>
          <h1>ระบบขัดข้องชั่วคราว</h1>
          <p className="auth-description">
            เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหา โปรดติดต่อเจ้าหน้าที่ประชาสัมพันธ์
          </p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>
            <span>โหลดหน้าใหม่</span>
            <i aria-hidden="true">↻</i>
          </button>
        </div>
      </section>
    );
  }
}
