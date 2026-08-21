import { useState } from "react";

interface PdpaConsentGateProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function PdpaConsentGate({ onAccept, onDecline }: PdpaConsentGateProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="pdpa-container" role="region" aria-label="หนังสือยินยอมข้อมูลส่วนบุคคล">
      <div className="pdpa-card">
        <div className="pdpa-header">
          <div className="pdpa-icon-wrapper" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="pdpa-title-group">
            <span className="pdpa-badge">พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</span>
            <h2>หนังสือยินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล (PDPA)</h2>
            <p className="pdpa-subtitle">สำหรับระบบบริการผู้ป่วยนอกและการจัดคิวอัตโนมัติ (OPD Smart Hospital)</p>
          </div>
        </div>

        <div className="pdpa-body">
          <div className="pdpa-terms-box" tabIndex={0} aria-label="ข้อกำหนดและเงื่อนไข PDPA">
            <div className="pdpa-section">
              <h3>1. วัตถุประสงค์ในการเก็บรวบรวมและใช้ข้อมูล</h3>
              <p>
                โรงพยาบาลจำเป็นต้องเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลของท่าน เพื่อวัตถุประสงค์ดังต่อไปนี้:
              </p>
              <ul>
                <li>การตรวจสอบตัวตน ขึ้นทะเบียนผู้ป่วยใหม่ และออกหมายเลขประจำตัวผู้ป่วย (HN)</li>
                <li>การคัดกรองอาการ ประเมินระดับความเร่งด่วนทางการแพทย์ และจัดคิวเข้ารับการตรวจรักษา</li>
                <li>การจัดทำประวัติเวชระเบียน และสนับสนุนการวินิจฉัยและรักษาของแพทย์และพยาบาล</li>
                <li>การติดต่อแจ้งเตือนสถานะคิวตรวจ และติดต่อผู้ติดต่อฉุกเฉินในกรณีจำเป็นเร่งด่วน</li>
              </ul>
            </div>

            <div className="pdpa-section">
              <h3>2. ประเภทข้อมูลส่วนบุคคลและข้อมูลสุขภาพที่จัดเก็บ</h3>
              <ul>
                <li><strong>ข้อมูลระบุตัวตน:</strong> ชื่อ-นามสกุล, เลขประจำตัวประชาชน 13 หลัก, เพศ, วันเดือนปีเกิด และอายุ</li>
                <li><strong>ข้อมูลการติดต่อ:</strong> เบอร์โทรศัพท์, ที่อยู่ปัจจุบัน และข้อมูลผู้ติดต่อฉุกเฉิน (ชื่อ, ความสัมพันธ์, เบอร์โทรศัพท์)</li>
                <li><strong>ข้อมูลสุขภาพและเวชระเบียน:</strong> อาการสำคัญที่มารับบริการ, โรคประจำตัว, ประวัติการแพ้ยา/อาหาร, ยาที่ใช้ประจำ, ส่วนสูง, น้ำหนัก และสัญญาณชีพ</li>
              </ul>
            </div>

            <div className="pdpa-section">
              <h3>3. การรักษาความมั่นคงปลอดภัยและความลับของข้อมูล</h3>
              <p>
                โรงพยาบาลมีมาตรการรักษาความมั่นคงปลอดภัยของข้อมูลสารสนเทศตามมาตรฐานสากล ข้อมูลสุขภาพของท่านจะถูกเก็บเป็นความลับทางการแพทย์ โดยหน้าจอแสดงคิวสาธารณะจะไม่เปิดเผยชื่อ-นามสกุล หรือรายละเอียดอาการของผู้ป่วย
              </p>
            </div>

            <div className="pdpa-section">
              <h3>4. สิทธิของเจ้าของข้อมูลส่วนบุคคล</h3>
              <p>
                ท่านมีสิทธิในการขอเข้าถึง ขอรับสำเนา ขอแก้ไขข้อมูลให้ถูกต้อง ขอระงับการใช้ หรือเพิกถอนความยินยอมตามที่ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 กำหนด โดยสามารถติดต่อเจ้าหน้าที่เวชระเบียนของโรงพยาบาลได้ในวันและเวลาทำการ
              </p>
            </div>
          </div>

          <label className="pdpa-consent-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label="ยินยอมเงื่อนไข PDPA"
            />
            <span>
              ข้าพเจ้าได้อ่านและเข้าใจข้อกำหนดนโยบายความเป็นส่วนตัวข้างต้นโดยตลอด และ<strong>ยินยอมให้โรงพยาบาลเก็บรวบรวม ใช้ และประมวลผลข้อมูลส่วนบุคคลและข้อมูลสุขภาพ</strong> เพื่อการลงทะเบียนและรับบริการทางการแพทย์
            </span>
          </label>
        </div>

        <div className="pdpa-footer">
          <button
            type="button"
            className="secondary-button pdpa-decline-btn"
            onClick={onDecline}
          >
            ไม่ยินยอม / ย้อนกลับ
          </button>
          <button
            type="button"
            className="primary-button pdpa-accept-btn"
            disabled={!agreed}
            onClick={onAccept}
          >
            <span>ยินยอมและดำเนินการต่อ</span>
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </div>
    </div>
  );
}
