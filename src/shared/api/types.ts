// รูปแบบข้อผิดพลาดรายฟิลด์ (Field validation errors) ที่ส่งกลับมาจาก Backend
export type FieldErrors = Record<string, string[] | string>;

// โครงสร้างพื้นฐานของ Response จาก API ทุกตัว (มาตรฐาน API Response Envelope)
export interface ApiEnvelope {
  ok: boolean;               // สถานะความสำเร็จของคำขอ (true = สำเร็จ, false = ล้มเหลว)
  error?: string;            // ข้อความแจ้งเตือนข้อผิดพลาดทั่วไป
  errors?: FieldErrors;      // รายละเอียดข้อผิดพลาดแยกตามชื่อฟิลด์
  access_token?: string;     // JWT Token สำหรับยืนยันตัวตน (ถ้ามี)
}

// ข้อมูลที่ส่งไปยังระบบเมื่อผู้ป่วยกรอกแบบฟอร์มลงทะเบียนเข้ารับบริการใหม่
export interface RegistrationPayload {
  username?: string | null;           // บัญชีผู้ใช้ (ถ้ามี)
  password?: string | null;           // รหัสผ่าน (ถ้ามี)
  temp_token?: string | null;         // โทเค็นชั่วคราวจากการล็อกอินบุคคลภายนอก เช่น Google
  website: string | null;             // ฟิลด์ Honeypot สำหรับดักจับ Bot/Spam (ต้องเป็นค่าว่างเสมอ)
  first_name: string | null;          // ชื่อจริง
  last_name: string | null;           // นามสกุล
  national_id: string | null;         // เลขประจำตัวประชาชน 13 หลัก
  gender: string | null;              // เพศ
  age: number | null;                 // อายุ
  phone: string | null;               // เบอร์โทรศัพท์
  email: string | null;               // อีเมล
  blood_type: string | null;          // กรุ๊ปเลือด
  height_cm: number | null;           // ส่วนสูง (เซนติเมตร)
  weight_kg: number | null;           // น้ำหนัก (กิโลกรัม)
  chronic_diseases: string | null;    // โรคประจำตัว
  allergies: string | null;           // ประวัติการแพ้ยา/อาหาร
  medications: string | null;         // ยาที่กำลังรับประทานอยู่
  note: string | null;                // อาการเบื้องต้นหรือหมายเหตุเพิ่มเติม
  province: string | null;            // จังหวัด
  district: string | null;            // อำเภอ/เขต
  subdistrict: string | null;         // ตำบล/แขวง
  postal_code: string | null;         // รหัสไปรษณีย์
  emergency_name: string | null;      // ชื่อผู้ติดต่อฉุกเฉินหลัก
  emergency_relationship: string | null; // ความสัมพันธ์กับผู้ติดต่อฉุกเฉิน
  emergency_phone: string | null;     // เบอร์โทรผู้ติดต่อฉุกเฉิน
  consent: boolean;                   // การยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
}

// ข้อมูลสถานะคิวปัจจุบันของผู้ป่วย
export interface QueueData extends ApiEnvelope {
  queue_number: string;              // หมายเลขคิว (เช่น A001)
  status?: string;                   // รหัสสถานะคิว (เช่น waiting, in_consultation)
  status_label: string;              // ข้อความแสดงสถานะภาษาไทย (เช่น รอเรียกพบแพทย์)
  instruction: string;               // คำแนะนำสำหรับผู้ป่วย (เช่น กรุณารอที่หน้าห้องตรวจ 1)
  queue_position: number | null;     // ลำดับคิวที่เหลือก่อนถึงคิวของผู้ป่วย
  room: string | null;               // ห้องตรวจหรือจุดบริการที่ต้องไปติดต่อ
  updated_at: string;                // เวลาอัปเดตสถานะล่าสุด (ISO Date String)
}

// ข้อมูลประวัติส่วนตัวของผู้ป่วย (Patient Profile)
export interface PatientProfile {
  username?: string | null;
  first_name: string;
  last_name: string;
  national_id?: string | null;
  hn?: string | null;                // รหัสประจำตัวผู้ป่วยของโรงพยาบาล (Hospital Number)
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  age?: number | null;
  blood_type?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  address?: string | null;
  chronic_diseases?: string | null;
  allergies?: string | null;
  medications?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  emergency_contacts?: Array<{ id?: string; name: string; relationship?: string; phone: string }> | null;
}

// ข้อมูลสัญญาณชีพของผู้ป่วยจากการตรวจแต่ละครั้ง
export interface VisitVitals {
  sys_bp?: number | null;            // ความดันโลหิตตัวบน (Systolic Blood Pressure)
  dia_bp?: number | null;            // ความดันโลหิตตัวล่าง (Diastolic Blood Pressure)
  pr?: number | null;                // อัตราการเต้นของหัวใจ/ชีพจร (Pulse Rate)
  bt?: number | null;                // อุณหภูมิร่างกาย (Body Temperature)
  o2sat?: number | null;             // ความอิ่มตัวของออกซิเจนในเลือด (Oxygen Saturation)
}

// ข้อมูลประวัติการเข้ารับบริการรักษาพยาบาลย้อนหลังในแต่ละครั้ง
export interface Visit {
  queue_number: string;              // หมายเลขคิวที่เคยได้รับ
  status_label: string;              // สถานะการบริการ (เช่น ตรวจรักษาเสร็จสิ้น)
  registered_at: string;             // วันและเวลาที่ลงทะเบียนรับบริการ
  note?: string | null;              // หมายเหตุหรืออาการสำคัญที่มารับบริการ
  diagnosis?: string | null;         // การวินิจฉัยโรคจากแพทย์
  treatment?: string | null;         // แผนการรักษาหรือรายการยา
  vitals?: VisitVitals | null;       // บันทึกสัญญาณชีพ
}

// ข้อมูลใบนัดหมายแพทย์
export interface Appointment {
  status: string;                    // สถานะนัดหมาย (เช่น scheduled, completed)
  status_label?: string;             // ข้อความแสดงสถานะการนัดหมาย
  date: string;                      // วันที่นัดหมาย
  time?: string | null;              // เวลานัดหมาย
  note?: string | null;              // รายละเอียดและข้อปฏิบัติตัวก่อนมาตามนัด
}

// ข้อมูลรวมทั้งหมดในหน้าบัญชีและข้อมูลผู้ป่วย (Dashboard / Account View)
export interface AccountData extends ApiEnvelope {
  profile: PatientProfile;           // ข้อมูลประวัติส่วนตัว
  active_queue: QueueData | null;    // ข้อมูลคิวปัจจุบัน (ถ้ามีคิวที่ยังไม่เสร็จสิ้น)
  visits: Visit[];                   // ประวัติการเข้ารับการรักษาย้อนหลัง
  appointments: Appointment[];       // รายการนัดหมายแพทย์
}

// ข้อมูลสำหรับอัปเดตโปรไฟล์ผู้ป่วย (ส่งผ่านคำขอ PATCH /api/patient/me/)
export interface ProfileUpdatePayload {
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  blood_type?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  postal_code?: string | null;
  chronic_diseases?: string | null;
  allergies?: string | null;
  medications?: string | null;
  emergency_name?: string | null;
  emergency_relationship?: string | null;
  emergency_phone?: string | null;
  emergency_contacts?: Array<{ id?: string; name: string; relationship?: string; phone: string }> | null;
}

// ข้อมูลร้องขอรหัส OTP สำหรับรีเซ็ต PIN
export interface PinResetRequestPayload {
  national_id: string;               // เลขประจำตัวประชาชน
  channel: "phone" | "email";        // ช่องทางรับ OTP (เบอร์โทรศัพท์ หรือ อีเมล)
  target: string;                    // เบอร์โทรศัพท์หรืออีเมลปลายทาง
}

// ข้อมูลยืนยันการตั้งรหัส PIN ใหม่ด้วยรหัส OTP
export interface PinResetConfirmPayload {
  national_id: string;               // เลขประจำตัวประชาชน
  otp: string;                       // รหัส OTP 6 หลัก
  pin: string;                       // รหัส PIN 6 หลักตัวใหม่
}

// ข้อมูลผลลัพธ์การลงทะเบียนสำเร็จ (ได้รับคิวพร้อม Access Token)
export interface RegistrationResult extends QueueData {
  access_token: string;
}

// ข้อมูลผลลัพธ์การเข้าสู่ระบบสำเร็จ
export interface LoginResult extends ApiEnvelope {
  access_token: string;
}

// ข้อมูลผลลัพธ์การตั้งค่ารหัส PIN
export interface PinSetupResult extends ApiEnvelope {
  message?: string;
}

// ข้อมูลผลลัพธ์การยืนยันรหัส PIN ถูกต้อง
export interface PinVerifyResult extends ApiEnvelope {
  access_token: string;
}

// ข้อมูลสำหรับการเข้าสู่ระบบทั่วไป (เลขบัตรประชาชน/เบอร์โทร และ รหัสผ่าน)
export interface LoginCredentials {
  identifier: string;
  password?: string;
}

// Google Identity ID token ที่ส่งให้ Backend ตรวจสอบ
export interface GoogleAuthPayload {
  credential: string;
}

// ข้อมูลผลลัพธ์การตรวจสอบตัวตนผ่าน Google OAuth
export interface GoogleAuthResult extends ApiEnvelope {
  access_token?: string;             // โทเค็นเข้าใช้งาน (กรณีเป็นผู้ใช้เดิม)
  is_new_user?: boolean;             // แฟล็กบอกว่าเป็นผู้ใช้ใหม่ที่ต้องลงทะเบียนเพิ่มหรือไม่
  temp_token?: string;               // โทเค็นชั่วคราวสำหรับส่งต่อฟอร์มลงทะเบียน
  suggested_profile?: {              // ข้อมูลเบื้องต้นที่ดึงมาจาก Google Account
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

// ข้อมูลส่งคำขอรีเซ็ตรหัสผ่าน (ระบุตัวตนและช่องทางรับ OTP)
export interface PasswordResetRequestPayload {
  identifier: string;
  channel: "email" | "sms";
}

// ข้อมูลตอบกลับเมื่อส่งคำขอ OTP สำหรับรีเซ็ตรหัสผ่าน
export interface PasswordResetRequestResult extends ApiEnvelope {
  cooldown_seconds?: number;         // เวลาหน่วงก่อนขอ OTP ใหม่ได้ (วินาที)
  expires_in_seconds?: number;       // อายุของ OTP (วินาที)
  masked_target?: string;            // เบอร์โทรหรืออีเมลที่ซ่อนบางตัวอักษรเพื่อความปลอดภัย เช่น 081-xxx-1234
  message?: string;
}

// ข้อมูลสำหรับตรวจสอบรหัส OTP รีเซ็ตรหัสผ่าน
export interface PasswordResetVerifyPayload {
  identifier: string;
  otp: string;
}

// ข้อมูลผลลัพธ์เมื่อยืนยัน OTP ถูกต้อง (จะได้รับ reset_token เพื่อไปตั้งรหัสใหม่)
export interface PasswordResetVerifyResult extends ApiEnvelope {
  reset_token?: string;
  message?: string;
}

// ข้อมูลสำหรับตั้งรหัสผ่านใหม่
export interface PasswordResetConfirmPayload {
  reset_token?: string;
  identifier?: string;
  otp?: string;
  new_password: string;
  confirm_password?: string;
}

// ผลลัพธ์เมื่อตั้งรหัสผ่านใหม่เรียบร้อยแล้ว
export interface PasswordResetConfirmResult extends ApiEnvelope {
  message?: string;
}
