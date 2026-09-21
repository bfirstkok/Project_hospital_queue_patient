export type FieldErrors = Record<string, string[] | string>;

export interface ApiEnvelope {
  ok: boolean;
  error?: string;
  errors?: FieldErrors;
  access_token?: string;
}

export interface RegistrationPayload {
  username?: string | null;
  password?: string | null;
  temp_token?: string | null;
  website: string | null;
  first_name: string | null;
  last_name: string | null;
  national_id: string | null;
  gender: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  chronic_diseases: string | null;
  allergies: string | null;
  medications: string | null;
  note: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  postal_code: string | null;
  emergency_name: string | null;
  emergency_relationship: string | null;
  emergency_phone: string | null;
  consent: boolean;
}

export interface QueueData extends ApiEnvelope {
  queue_number: string;
  status_label: string;
  instruction: string;
  queue_position: number | null;
  room: string | null;
  updated_at: string;
}

export interface PatientProfile {
  username?: string | null;
  first_name: string;
  last_name: string;
  national_id?: string | null;
  hn?: string | null;
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

export interface VisitVitals {
  sys_bp?: number | null;
  dia_bp?: number | null;
  pr?: number | null;
  bt?: number | null;
  o2sat?: number | null;
}

export interface Visit {
  queue_number: string;
  status_label: string;
  registered_at: string;
  note?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  vitals?: VisitVitals | null;
}

export interface Appointment {
  status: string;
  status_label?: string;
  date: string;
  time?: string | null;
  note?: string | null;
}

export interface AccountData extends ApiEnvelope {
  profile: PatientProfile;
  active_queue: QueueData | null;
  visits: Visit[];
  appointments: Appointment[];
}

/** Patient-editable subset of the profile, sent to PATCH /api/patient/me/. */
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

export interface PinResetRequestPayload {
  national_id: string;
  channel: "phone" | "email";
  target: string;
}

export interface PinResetConfirmPayload {
  national_id: string;
  otp: string;
  pin: string;
}

export interface RegistrationResult extends QueueData {
  access_token: string;
}

export interface LoginResult extends ApiEnvelope {
  access_token: string;
}

export interface PinSetupResult extends ApiEnvelope {
  message?: string;
}

export interface PinVerifyResult extends ApiEnvelope {
  access_token: string;
}

export interface LoginCredentials {
  identifier: string;
  password?: string;
}

export interface GoogleAuthPayload {
  credential: string;
}

export interface GoogleAuthResult extends ApiEnvelope {
  access_token?: string;
  is_new_user?: boolean;
  temp_token?: string;
  suggested_profile?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface PasswordResetRequestPayload {
  identifier: string;
  channel: "email" | "sms";
}

export interface PasswordResetRequestResult extends ApiEnvelope {
  cooldown_seconds?: number;
  expires_in_seconds?: number;
  masked_target?: string;
  message?: string;
}

export interface PasswordResetVerifyPayload {
  identifier: string;
  otp: string;
}

export interface PasswordResetVerifyResult extends ApiEnvelope {
  reset_token?: string;
  message?: string;
}

export interface PasswordResetConfirmPayload {
  reset_token?: string;
  identifier?: string;
  otp?: string;
  new_password: string;
  confirm_password?: string;
}

export interface PasswordResetConfirmResult extends ApiEnvelope {
  message?: string;
}

