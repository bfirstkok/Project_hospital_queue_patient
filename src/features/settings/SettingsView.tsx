import { useState, useEffect } from "react";
import type { FontSize } from "@/shared/ui/SiteShell";
import { hasPin, isPinEnabled, setPinEnabled } from "@/shared/auth/pin-storage";

interface SettingsViewProps {
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
  hasToken: boolean;
  onLogout: () => void;
  onLogin?: () => void;
  onChangePin: () => void;
  onSetupPin: () => void;
  onResetPin: () => void;
}

export function SettingsView({
  fontSize,
  onChangeFontSize,
  hasToken,
  onLogout,
  onLogin,
  onChangePin,
  onSetupPin,
  onResetPin,
}: SettingsViewProps) {
  const [pinConfigured, setPinConfigured] = useState<boolean>(false);
  const [pinActive, setPinActive] = useState<boolean>(false);

  useEffect(() => {
    setPinConfigured(hasPin());
    setPinActive(isPinEnabled());
  }, []);

  function handleTogglePin(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    if (checked && !pinConfigured) {
      onSetupPin();
      return;
    }
    setPinEnabled(checked);
    setPinActive(checked);
  }

  return (
    <section id="settingsView" className="page-shell settings-view">
      <div className="intro">
        <span className="eyebrow">การตั้งค่าระบบ & ความปลอดภัย</span>
        <h1>ตั้งค่า</h1>
        <p>จัดการความปลอดภัยรหัส PIN ขนาดตัวอักษร และข้อมูลการช่วยเหลือฉุกเฉิน</p>
      </div>

      {/* Block 1: ความปลอดภัยและรหัส PIN */}
      <section className="account-card settings-card" aria-labelledby="securitySettingTitle">
        <div className="card-heading">
          <div>
            <span className="section-number">1</span>
            <h2 id="securitySettingTitle">ความปลอดภัย & รหัส PIN 6 หลัก</h2>
          </div>
        </div>
        <p className="settings-desc">
          ปกป้องข้อมูลสุขภาพและบัตรประจำตัวผู้ป่วยด้วยรหัส PIN เมื่อเปิดเข้าใช้งานแอปพลิเคชัน
        </p>

        <div className="setting-row-item">
          <div className="setting-row-text">
            <strong>ระบบล็อคแอปด้วยรหัส PIN</strong>
            <small>{pinConfigured ? (pinActive ? "เปิดใช้งานรหัส PIN แล้ว" : "ปิดการล็อคชั่วคราว") : "ยังไม่ได้ตั้งรหัส PIN"}</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={pinActive}
              onChange={handleTogglePin}
              aria-label="เปิด/ปิดการล็อคด้วย PIN"
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="pin-action-buttons-group">
          {pinConfigured ? (
            <>
              <button
                type="button"
                className="secondary-button pin-manage-btn"
                onClick={onChangePin}
              >
                🔑 เปลี่ยนรหัส PIN ใหม่
              </button>
              <button
                type="button"
                className="secondary-button pin-manage-btn"
                onClick={onResetPin}
              >
                📱 รีเซ็ตรหัส PIN ผ่านเบอร์โทร (OTP)
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button pin-manage-btn"
              onClick={onSetupPin}
            >
              🔒 ตั้งรหัส PIN 6 หลักตอนนี้
            </button>
          )}
        </div>
      </section>

      {/* Block 2: ขนาดตัวอักษร (Accessibility) */}
      <section className="account-card settings-card" aria-labelledby="fontSettingTitle">
        <div className="card-heading">
          <div>
            <span className="section-number">2</span>
            <h2 id="fontSettingTitle">ขนาดตัวอักษร (Accessibility)</h2>
          </div>
        </div>
        <p className="settings-desc">
          เลือกขนาดตัวหนังสือที่เหมาะสมกับการอ่าน รองรับการใช้งานของผู้สูงอายุและทุกช่วงวัย
        </p>

        <div className="font-setting-options" role="group" aria-label="ขนาดตัวอักษร">
          <button
            type="button"
            className={`font-setting-card ${fontSize === "normal" ? "active" : ""}`}
            onClick={() => onChangeFontSize("normal")}
          >
            <span className="font-preview-char font-normal-sample">ก</span>
            <span className="font-setting-name">ขนาดปกติ</span>
            <span className="font-setting-sub">มาตรฐาน (16px)</span>
          </button>

          <button
            type="button"
            className={`font-setting-card ${fontSize === "large" ? "active" : ""}`}
            onClick={() => onChangeFontSize("large")}
          >
            <span className="font-preview-char font-large-sample">ก+</span>
            <span className="font-setting-name">ขนาดใหญ่</span>
            <span className="font-setting-sub">อ่านสบายตา (18px)</span>
          </button>

          <button
            type="button"
            className={`font-setting-card ${fontSize === "xlarge" ? "active" : ""}`}
            onClick={() => onChangeFontSize("xlarge")}
          >
            <span className="font-preview-char font-xlarge-sample">ก++</span>
            <span className="font-setting-name">ขนาดใหญ่พิเศษ</span>
            <span className="font-setting-sub">ตัวใหญ่ชัดเจน (20px)</span>
          </button>
        </div>
      </section>

      {/* Block 3: เบอร์โทรฉุกเฉินและติดต่อโรงพยาบาล */}
      <section className="account-card settings-card" aria-labelledby="emergencyTitle">
        <div className="card-heading">
          <div>
            <span className="section-number">3</span>
            <h2 id="emergencyTitle">เบอร์โทรฉุกเฉิน & ติดต่อโรงพยาบาล</h2>
          </div>
        </div>
        <div className="emergency-hotline-list">
          <a href="tel:1669" className="hotline-card emergency-call-card">
            <div className="hotline-icon">🚨</div>
            <div>
              <strong>1669 · สายด่วนกู้ชีพฉุกเฉิน</strong>
              <p>บริการการแพทย์ฉุกเฉินทั่วประเทศ ฟรี 24 ชั่วโมง</p>
            </div>
            <span className="call-btn-tag">โทรออก</span>
          </a>

          <div className="hotline-card">
            <div className="hotline-icon">🏥</div>
            <div>
              <strong>ห้องฉุกเฉินและอุบัติเหตุ (ER)</strong>
              <p>เปิดบริการตลอด 24 ชั่วโมง ณ อาคารผู้ป่วยอุบัติเหตุ</p>
            </div>
          </div>

          <div className="hotline-card">
            <div className="hotline-icon">ℹ️</div>
            <div>
              <strong>จุดประชาสัมพันธ์และคัดกรอง OPD</strong>
              <p>ให้บริการ จันทร์ - ศุกร์ เวลา 07:30 – 16:30 น.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Block 4: นโยบายความเป็นส่วนตัวและเวอร์ชัน */}
      <section className="account-card settings-card" aria-labelledby="policyTitle">
        <div className="card-heading">
          <div>
            <span className="section-number">4</span>
            <h2 id="policyTitle">นโยบายความเป็นส่วนตัว & ข้อมูลระบบ</h2>
          </div>
        </div>
        <p className="settings-desc">
          ระบบ OPD Queue ได้รับการคุ้มครองตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) ข้อมูลสุขภาพและประวัติการรักษาจะเข้าถึงได้เฉพาะเจ้าของข้อมูลเท่านั้น
        </p>
        <div className="app-version-tag">
          <span>OPD Patient Portal v2.0</span>
          <span>•</span>
          <span>Security PIN & ThaID Enabled</span>
        </div>
      </section>

      {/* Block 5: การจัดการเซสชันและบัญชี */}
      <section className="account-card settings-card" aria-labelledby="accountManageTitle">
        <div className="card-heading">
          <div>
            <span className="section-number">5</span>
            <h2 id="accountManageTitle">สถานะบัญชีและการใช้งาน</h2>
          </div>
        </div>
        {hasToken ? (
          <div className="account-session-box">
            <div>
              <strong>เข้าสู่ระบบอยู่ขณะนี้</strong>
              <p>บันทึกเซสชันอย่างปลอดภัยในอุปกรณ์นี้</p>
            </div>
            <button className="danger-button" type="button" onClick={onLogout}>
              ออกจากระบบในเครื่องนี้
            </button>
          </div>
        ) : (
          <div className="account-session-box">
            <div>
              <strong>ยังไม่ได้เข้าสู่ระบบ</strong>
              <p>เข้าสู่ระบบเพื่อใช้งานระบบเต็มรูปแบบ</p>
            </div>
            <button className="primary-button" type="button" onClick={onLogin}>
              เข้าสู่ระบบด้วยเลขบัตรประชาชน
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
