"""Local, in-memory stand-in for the patient API in Project_hospital_queue.

Data resets when this process stops. Never use this server for real patients.
"""

import copy
import json
import os
import re
import secrets
import smtplib
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


PORT = int(os.environ.get("MOCK_BACKEND_PORT", "8000"))
ENV_KEYS = {
    "GOOGLE_CLIENT_ID", "MOCK_PATIENT_EMAIL", "MOCK_SMTP_HOST", "MOCK_SMTP_PORT",
    "MOCK_SMTP_USER", "MOCK_SMTP_PASSWORD", "MOCK_SMTP_FROM", "EMAIL_HOST",
    "EMAIL_PORT", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD", "DEFAULT_FROM_EMAIL",
}
env_file = Path(__file__).with_name(".env")
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() in ENV_KEYS:
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


MOCK_PATIENT_PROFILE = {
    "username": "somchai99", "first_name": "สมชาย", "last_name": "ใจดี",
    "national_id": "1234567890123", "hn": "HN-67001",
    "phone": "0812345678", "email": os.environ.get("MOCK_PATIENT_EMAIL", "somchai@example.com"),
    "gender": "M", "age": 35, "blood_type": "O", "height_cm": 175, "weight_kg": 70,
    "address": "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
    "province": "กรุงเทพมหานคร", "district": "เขตจตุจักร", "subdistrict": "แขวงลาดยาว",
    "postal_code": "10900", "chronic_diseases": "ไม่มี", "allergies": "ไม่มีประวัติแพ้ยา",
    "medications": "ไม่มี", "emergency_name": "สมศรี ใจดี", "emergency_phone": "0898765432",
    "emergency_contacts": [{"id": "em-mock-1", "name": "สมศรี ใจดี", "relationship": "SPOUSE", "phone": "0898765432"}],
}
MOCK_ACTIVE_QUEUE = {
    "ok": True, "queue_number": "A012", "status": "WAITING_VITALS", "status_label": "รอตรวจ",
    "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2", "queue_position": 3,
    "room": "ห้องตรวจ 2", "updated_at": now_iso(),
}
MOCK_VISITS = [{
    "queue_number": "A005", "status_label": "ตรวจเสร็จสิ้น", "registered_at": "2026-08-01 09:30",
    "note": "ตรวจสุขภาพทั่วไปและตรวจเลือด", "diagnosis": "สุขภาพแข็งแรงดี ผลเลือดปกติ",
    "treatment": "แนะนำการออกกำลังกายและรับประทานอาหารให้ครบ 5 หมู่",
    "vitals": {"sys_bp": 120, "dia_bp": 80, "pr": 72, "bt": 36.5, "o2sat": 99},
}]
MOCK_APPOINTMENTS = [{
    "status": "confirmed", "status_label": "นัดตรวจติดตาม", "date": "2026-09-15",
    "time": "09:00 - 10:00", "note": "ติดตามผลสุขภาพประจำปี",
}]

# One account is seeded for a quick thesis demo. Registration adds more accounts.
ACCOUNTS = {
    MOCK_PATIENT_PROFILE["national_id"]: {
        "profile": MOCK_PATIENT_PROFILE, "password": "Password@2026", "google_id": None,
        "pin": None, "pin_attempts": 0, "pin_locked_until": 0,
        "queue": MOCK_ACTIVE_QUEUE, "visits": MOCK_VISITS, "appointments": MOCK_APPOINTMENTS,
    }
}
SEED_ACCOUNTS = copy.deepcopy(ACCOUNTS)
TOKENS = {}                  # bearer token -> {national_id, expires_at}
PASSWORD_RESET = {}          # national_id -> one active OTP challenge
PIN_RESET = {}               # national_id -> one active PIN OTP challenge
GOOGLE_LINK_TOKENS = {}      # temporary registration token -> verified Google claims
RATE_EVENTS = {}             # (operation, identifier) -> request timestamps


def reset_mock_state():
    ACCOUNTS.clear()
    ACCOUNTS.update(copy.deepcopy(SEED_ACCOUNTS))
    for state in (TOKENS, PASSWORD_RESET, PIN_RESET, GOOGLE_LINK_TOKENS, RATE_EVENTS):
        state.clear()


def is_local_test_mode(client_address):
    return (os.environ.get("MOCK_BACKEND_TEST_MODE") == "1"
            and client_address[0] in {"127.0.0.1", "::1"})


def digits(value):
    return "".join(char for char in str(value or "") if char.isdigit())


def find_account(identifier):
    value = str(identifier or "").strip().lower()
    if not value:
        return None
    if "@" in value:
        matches = [account for account in ACCOUNTS.values()
                   if str(account["profile"].get("email") or "").strip().lower() == value]
        return matches[0] if len(matches) == 1 else None
    for account in ACCOUNTS.values():
        profile = account["profile"]
        if value in {str(profile.get(key) or "").strip().lower() for key in ("username", "email", "national_id", "phone")}:
            return account
        if len(digits(value)) in (10, 13) and digits(value) in {digits(profile.get("phone")), digits(profile.get("national_id"))}:
            return account
    return None


def issue_token(account):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=12)
    TOKENS[token] = {"national_id": account["profile"]["national_id"], "expires_at": expires.timestamp()}
    return {
        "access_token": token, "token_type": "Bearer", "expires_in": 43200,
        "expires_at": expires.isoformat(),
    }


def revoke_tokens(account):
    national_id = account["profile"]["national_id"]
    for token, record in list(TOKENS.items()):
        if record["national_id"] == national_id:
            del TOKENS[token]


def mask_email(email):
    if "@" not in email:
        return "***"
    name, domain = email.split("@", 1)
    return name[:2] + "***@" + domain


def rate_limited(operation, identifier, limit, window_seconds):
    key = (operation, str(identifier or "").lower())
    now = time.monotonic()
    events = [value for value in RATE_EVENTS.get(key, []) if now - value < window_seconds]
    RATE_EVENTS[key] = events
    if len(events) >= limit:
        return True
    events.append(now)
    return False


def send_email(recipient, subject, text):
    host = os.environ.get("MOCK_SMTP_HOST") or os.environ.get("EMAIL_HOST", "")
    user_value = os.environ.get("MOCK_SMTP_USER") or os.environ.get("EMAIL_HOST_USER", "")
    _, parsed_user = parseaddr(user_value)
    user = parsed_user or user_value.strip()
    password = os.environ.get("MOCK_SMTP_PASSWORD") or os.environ.get("EMAIL_HOST_PASSWORD", "")
    sender_value = os.environ.get("MOCK_SMTP_FROM") or os.environ.get("DEFAULT_FROM_EMAIL") or user
    port = int(os.environ.get("MOCK_SMTP_PORT") or os.environ.get("EMAIL_PORT", "587"))
    if not all((host, user, password, sender_value)):
        raise ValueError("ยังไม่ได้ตั้งค่า SMTP ใน .env")
    if not user.isascii() or not password.isascii():
        raise ValueError("SMTP username และ app password ต้องเป็น ASCII; ใช้อีเมลบัญชี SMTP และ app password")

    sender_name, sender_address = parseaddr(sender_value)
    if "@" not in sender_address:
        sender_name, sender_address = sender_value.strip(), user
    if not sender_address.isascii():
        raise ValueError("MOCK_SMTP_FROM ต้องมีที่อยู่อีเมล SMTP ที่เป็น ASCII")

    message = EmailMessage()
    message["From"] = formataddr((sender_name, sender_address), charset="utf-8")
    message["To"], message["Subject"] = recipient, subject
    message.set_content(text)
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=10) as smtp:
            smtp.login(user, password)
            smtp.send_message(message, from_addr=sender_address)
    else:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(message, from_addr=sender_address)


def send_otp_email(recipient, purpose, otp):
    subject = f"รหัสยืนยัน{purpose} | ระบบคิวผู้ป่วย OPD"
    message = (
        "เรียน ผู้ใช้บริการ,\n\n"
        f"เราได้รับคำขอ{purpose}สำหรับบัญชีของคุณ\n\n"
        f"รหัสยืนยัน (OTP): {otp}\n"
        "รหัสนี้ใช้ได้ภายใน 5 นาทีและใช้ได้เพียงครั้งเดียว\n\n"
        "หากคุณไม่ได้เป็นผู้ร้องขอ โปรดละเว้นอีเมลฉบับนี้ และอย่าเปิดเผยรหัสแก่ผู้อื่น\n\n"
        "ขอแสดงความนับถือ\nระบบคิวผู้ป่วยนอก (OPD)\n\n"
        "อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ"
    )
    send_email(recipient, subject, message)


def send_password_reset_email(recipient, otp):
    send_otp_email(recipient, "การกู้คืนรหัสผ่าน", otp)


def send_pin_reset_email(recipient, otp):
    send_otp_email(recipient, "การตั้งรหัส PIN ใหม่", otp)


def verify_google_id_token(credential):
    """Use Google's tokeninfo endpoint; never trust decoded JWT claims alone."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise RuntimeError("Google Sign-In ยังไม่ได้ตั้งค่า")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    with urllib.request.urlopen(url, timeout=8) as response:
        claims = json.load(response)
    if (claims.get("aud") != client_id or not claims.get("sub") or not claims.get("email")
            or str(claims.get("email_verified", "")).lower() != "true"):
        raise ValueError("Google credential ไม่ถูกต้อง")
    return claims


def verify_google_access_token(access_token):
    """Validate a GIS OAuth access token and its issuing client with Google."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise RuntimeError("Google Sign-In ยังไม่ได้ตั้งค่า")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"access_token": access_token})
    with urllib.request.urlopen(url, timeout=8) as response:
        claims = json.load(response)
    client_ids = {claims.get("aud"), claims.get("azp"), claims.get("issued_to")}
    if (client_id not in client_ids or not claims.get("sub") or not claims.get("email")
            or str(claims.get("email_verified", claims.get("verified_email", ""))).lower() != "true"):
        raise ValueError("Google access token ไม่ถูกต้อง")
    userinfo_request = urllib.request.Request(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    with urllib.request.urlopen(userinfo_request, timeout=8) as response:
        profile = json.load(response)
    profile_email = str(profile.get("email") or "").strip()
    if (profile.get("sub") != claims["sub"] or not profile_email
            or profile_email.casefold() != str(claims["email"]).casefold()
            or str(profile.get("email_verified", "")).lower() != "true"):
        raise ValueError("Google userinfo does not match the verified access token")
    claims.update({key: profile[key] for key in ("given_name", "family_name", "name") if profile.get(key)})
    return claims


class MockBackendHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, data):
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self._send_json(200, {})

    def _read_json(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            return body if isinstance(body, dict) else {}
        except (ValueError, UnicodeDecodeError):
            return {}

    def _account(self):
        scheme, _, token = self.headers.get("Authorization", "").partition(" ")
        record = TOKENS.get(token) if scheme.lower() == "bearer" else None
        if record and record["expires_at"] > time.time():
            return ACCOUNTS.get(record["national_id"])
        return None

    def _require_account(self):
        account = self._account()
        if not account:
            self._send_json(401, {"ok": False, "error": "โทเคนไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่"})
        return account

    def _account_data(self, account):
        return {
            "ok": True, "profile": account["profile"], "active_queue": account["queue"],
            "visits": account["visits"], "appointments": account["appointments"],
        }

    def do_POST(self):
        path = self.path.rstrip("/") + "/"
        body = self._read_json()

        if path == "/__test__/reset/":
            if not is_local_test_mode(self.client_address):
                return self._send_json(404, {"ok": False, "error": "Not Found"})
            reset_mock_state()
            return self._send_json(200, {"ok": True})

        if path == "/api/patient/register/":
            if body.get("website"):
                return self._send_json(202, {"ok": True})
            national_id = str(body.get("national_id") or "").strip()
            username = str(body.get("username") or "").strip()
            password = str(body.get("password") or "")
            email = str(body.get("email") or "").strip().lower()
            errors = {}
            if not re.fullmatch(r"[0-9]{13}", national_id):
                errors["national_id"] = ["เลขบัตรประชาชนต้องมี 13 หลัก"]
            if not body.get("first_name") or not body.get("last_name"):
                errors["first_name"] = ["กรุณาระบุชื่อและนามสกุล"]
            if not body.get("consent"):
                errors["consent"] = ["กรุณายอมรับข้อตกลง"]
            if username and not re.fullmatch(r"[A-Za-z0-9._-]{3,50}", username):
                errors["username"] = ["ชื่อผู้ใช้ต้องยาว 3-50 ตัว และใช้ได้เฉพาะ a-z, A-Z, 0-9, จุด, ขีดกลาง หรือขีดล่าง"]
            if username and not password:
                errors["password"] = ["กรุณาระบุรหัสผ่านสำหรับบัญชีนี้"]
            if password and not 8 <= len(password) <= 128:
                errors["password"] = ["รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"]
            google_link = GOOGLE_LINK_TOKENS.get(body.get("temp_token")) if body.get("temp_token") else None
            google_claims = google_link["claims"] if google_link and google_link["expires_at"] > time.monotonic() else None
            if body.get("temp_token") and not google_claims:
                errors["temp_token"] = ["ข้อมูลเชื่อมบัญชี Google ไม่ถูกต้องหรือหมดอายุ"]
            if google_claims:
                email = google_claims["email"].lower()
            if (username or password or body.get("temp_token")) and not email:
                errors["email"] = ["กรุณาระบุอีเมลสำหรับบัญชีผู้ป่วย"]
            elif email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                errors["email"] = ["รูปแบบอีเมลไม่ถูกต้อง"]
            if errors:
                return self._send_json(400, {"ok": False, "error": "กรุณาตรวจสอบข้อมูลที่กรอก", "errors": errors})
            existing = ACCOUNTS.get(national_id)
            for account in ACCOUNTS.values():
                if account is existing:
                    continue
                profile = account["profile"]
                if username and username.lower() == str(profile.get("username") or "").lower():
                    return self._send_json(409, {"ok": False, "error": "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว", "errors": {"username": ["ชื่อผู้ใช้นี้ถูกใช้งานแล้ว"]}})
                if email and email == str(profile.get("email") or "").lower():
                    return self._send_json(409, {"ok": False, "error": "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว", "errors": {"email": ["อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว"]}})
            if existing and existing["queue"]:
                return self._send_json(409, {"ok": False, "error": "คุณมีคิวที่กำลังรับบริการอยู่แล้ว กรุณาตรวจสอบคิวเดิมก่อนจองใหม่", "active_queue": existing["queue"]})
            profile = dict(existing["profile"]) if existing else {}
            profile.update({key: value for key, value in body.items() if key in {
                "username", "first_name", "last_name", "national_id", "gender", "age", "phone", "email",
                "blood_type", "height_cm", "weight_kg", "address", "province", "district", "subdistrict",
                "postal_code", "chronic_diseases", "allergies", "medications", "emergency_name",
                "emergency_phone", "emergency_contacts",
            }})
            profile["email"] = email
            profile["hn"] = profile.get("hn") or f"HN-{len(ACCOUNTS) + 67001}"
            queue = {
                "ok": True, "queue_number": f"A{len(ACCOUNTS) + 12:03d}", "status": "WAITING_VITALS",
                "status_label": "รอตรวจวัดสัญญาณชีพ", "instruction": "กรุณาไปยังจุดวัดสัญญาณชีพ",
                "queue_position": 4, "people_ahead": 3, "room": None, "updated_at": now_iso(),
            }
            tracking_token = str(uuid.uuid4())
            account = existing or {"pin": None, "pin_attempts": 0, "pin_locked_until": 0, "visits": [], "appointments": []}
            account.update({"profile": profile, "password": password or account.get("password"),
                            "google_id": google_claims["sub"] if google_claims else account.get("google_id"),
                            "queue": queue, "tracking_token": tracking_token})
            ACCOUNTS[national_id] = account
            if body.get("temp_token"):
                GOOGLE_LINK_TOKENS.pop(body["temp_token"], None)
            return self._send_json(201, {
                "ok": True, **issue_token(account), "patient_id": len(ACCOUNTS), "hn": profile["hn"],
                "tracking_token": tracking_token, "status_url": f"/api/patient/queue/{tracking_token}/",
                "message": "ลงทะเบียนและรับบัตรคิวสำเร็จ", **queue,
            })

        if path == "/api/patient/login/":
            identifier = str(body.get("identifier") or body.get("national_id") or "").strip()
            if rate_limited("login", identifier or "missing", 5, 60):
                return self._send_json(429, {"ok": False, "error": "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่"})
            if not identifier:
                return self._send_json(400, {"ok": False, "error": "กรุณาระบุข้อมูลเข้าสู่ระบบ"})
            account = find_account(identifier)
            password = body.get("password")
            if not account or (password and password != account["password"]) or (
                not password and body.get("national_id") != account["profile"]["national_id"]
            ):
                return self._send_json(401, {"ok": False, "error": "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง"})
            return self._send_json(200, {"ok": True, **issue_token(account), "profile": account["profile"], "message": "เข้าสู่ระบบสำเร็จ"})

        if path == "/api/patient/auth/google/":
            credential = str(body.get("credential") or "").strip()
            access_token = str(body.get("access_token") or "").strip()
            if rate_limited("google-login", "all", 10, 300):
                return self._send_json(429, {"ok": False, "error": "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่"})
            if not credential and not access_token:
                return self._send_json(400, {"ok": False, "error": "ไม่พบข้อมูลยืนยันจาก Google"})
            try:
                if is_local_test_mode(self.client_address) and (
                    credential == "google_oauth_test_token" or access_token == "google_oauth_test_access_token"
                ):
                    claims = {"sub": "playwright-test-user", "email": MOCK_PATIENT_PROFILE["email"]}
                elif credential:
                    claims = verify_google_id_token(credential)
                else:
                    claims = verify_google_access_token(access_token)
            except RuntimeError:
                return self._send_json(503, {"ok": False, "error": "ระบบ Google Sign-In ยังไม่ได้ตั้งค่า"})
            except Exception:
                return self._send_json(401, {"ok": False, "error": "ไม่สามารถยืนยันบัญชี Google ได้"})
            account = next((item for item in ACCOUNTS.values() if item.get("google_id") == claims["sub"]), None)
            if not account:
                account = find_account(claims["email"])
                if account:
                    if account.get("google_id") and account["google_id"] != claims["sub"]:
                        return self._send_json(409, {"ok": False, "error": "อีเมลนี้เชื่อมกับบัญชี Google อื่นแล้ว กรุณาติดต่อเจ้าหน้าที่"})
                    account["google_id"] = claims["sub"]
            if account:
                return self._send_json(200, {"ok": True, **issue_token(account), "profile": account["profile"], "message": "เข้าสู่ระบบด้วย Google สำเร็จ"})
            temp_token = secrets.token_urlsafe(24)
            GOOGLE_LINK_TOKENS[temp_token] = {"claims": claims, "expires_at": time.monotonic() + 600}
            return self._send_json(200, {"ok": True, "is_new_user": True, "temp_token": temp_token,
                "suggested_profile": {"email": claims["email"], "first_name": claims.get("given_name", ""), "last_name": claims.get("family_name", "")}})

        if path == "/api/patient/password/reset/request/":
            identifier = str(body.get("identifier") or "").strip()
            channel = str(body.get("channel") or "email").strip().lower()
            generic = {"ok": True, "message": "ส่งรหัส OTP เรียบร้อยแล้ว หากมีบัญชีในระบบ",
                       "cooldown_seconds": 60, "expires_in_seconds": 300, "masked_target": None}
            if not identifier:
                return self._send_json(200, generic)
            if channel in ("sms", "phone"):
                return self._send_json(400, {"ok": False, "error": "ยังไม่เปิดให้บริการรับรหัสทาง SMS กรุณาใช้อีเมล"})
            if channel != "email":
                return self._send_json(400, {"ok": False, "error": "ช่องทางรับรหัสไม่ถูกต้อง"})
            if rate_limited("password-reset", identifier, 3, 900):
                return self._send_json(429, {"ok": False, "error": "ขอรหัสถี่เกินไป กรุณารอสักครู่"})
            account = find_account(identifier)
            if not account or not account["profile"].get("email"):
                return self._send_json(200, generic)
            national_id = account["profile"]["national_id"]
            email = account["profile"]["email"]
            test_mode = is_local_test_mode(self.client_address)
            otp = "123456" if test_mode else f"{secrets.randbelow(1_000_000):06d}"
            if not test_mode:
                try:
                    send_password_reset_email(email, otp)
                except (OSError, smtplib.SMTPException, ValueError) as error:
                    print(f"[Mock SMTP] {error}")
                    return self._send_json(503, {"ok": False, "error": "ส่งอีเมล OTP ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP และหน้าต่างเซิร์ฟเวอร์"})
            PASSWORD_RESET[national_id] = {"otp": otp, "expires_at": time.monotonic() + 300, "attempts": 0}
            generic["masked_target"] = mask_email(email)
            return self._send_json(200, generic)

        if path == "/api/patient/password/reset/verify-otp/":
            account = find_account(body.get("identifier"))
            challenge = PASSWORD_RESET.get(account["profile"]["national_id"]) if account else None
            otp = str(body.get("otp") or "")
            if not challenge:
                return self._send_json(400, {"ok": False, "error": "รหัส OTP ไม่ถูกต้องหรือหมดอายุ"})
            if challenge["expires_at"] <= time.monotonic():
                return self._send_json(400, {"ok": False, "error": "รหัส OTP หมดอายุ กรุณาขอใหม่"})
            if challenge["attempts"] >= 5:
                return self._send_json(400, {"ok": False, "error": "กรอกรหัส OTP ผิดเกินกำหนด กรุณาขอใหม่"})
            if not re.fullmatch(r"[0-9]{6}", otp) or otp != challenge["otp"]:
                challenge["attempts"] += 1
                message = "กรอกรหัส OTP ผิดเกินกำหนด กรุณาขอใหม่" if challenge["attempts"] >= 5 else "รหัส OTP ไม่ถูกต้อง"
                return self._send_json(400, {"ok": False, "error": message})
            token = secrets.token_hex(32)
            challenge.update({"otp": None, "reset_token": token, "token_expires_at": time.monotonic() + 900})
            return self._send_json(200, {"ok": True, "reset_token": token, "message": "รหัส OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่"})

        if path == "/api/patient/password/reset/confirm/":
            reset_token = str(body.get("reset_token") or "")
            account = next((item for nid, item in ACCOUNTS.items()
                            if PASSWORD_RESET.get(nid, {}).get("reset_token") == reset_token and reset_token), None)
            if not account:
                return self._send_json(400, {"ok": False, "error": "Reset token ไม่ถูกต้องหรือหมดอายุ"})
            challenge = PASSWORD_RESET[account["profile"]["national_id"]]
            if challenge["token_expires_at"] <= time.monotonic():
                return self._send_json(400, {"ok": False, "error": "Reset token ไม่ถูกต้องหรือหมดอายุ"})
            new_password = str(body.get("new_password") or "")
            if body.get("confirm_password") and new_password != body["confirm_password"]:
                return self._send_json(400, {"ok": False, "error": "รหัสผ่านยืนยันไม่ตรงกัน", "errors": {"confirm_password": ["รหัสผ่านยืนยันไม่ตรงกัน"]}})
            if not 8 <= len(new_password) <= 128:
                return self._send_json(400, {"ok": False, "error": "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร", "errors": {"new_password": ["รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"]}})
            if body.get("identifier") and find_account(body["identifier"]) is not account:
                return self._send_json(400, {"ok": False, "error": "Reset token ไม่ตรงกับบัญชีผู้ใช้"})
            account["password"] = new_password
            revoke_tokens(account)
            del PASSWORD_RESET[account["profile"]["national_id"]]
            return self._send_json(200, {"ok": True, "message": "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่"})

        if path == "/api/patient/pin/setup/":
            account = self._require_account()
            if not account:
                return
            pin = str(body.get("pin") or "")
            if not re.fullmatch(r"[0-9]{6}", pin):
                return self._send_json(400, {"ok": False, "error": "รหัส PIN ต้องเป็นตัวเลข 6 หลัก"})
            account.update({"pin": pin, "pin_attempts": 0, "pin_locked_until": 0})
            return self._send_json(200, {"ok": True, **issue_token(account), "message": "ตั้งรหัส PIN สำเร็จ"})

        if path == "/api/patient/pin/verify/":
            national_id, pin = str(body.get("national_id") or ""), str(body.get("pin") or "")
            if not re.fullmatch(r"[0-9]{13}", national_id) or not re.fullmatch(r"[0-9]{6}", pin):
                return self._send_json(400, {"ok": False, "error": "ข้อมูลไม่ถูกต้อง"})
            if rate_limited("pin-verify", national_id, 30, 300):
                return self._send_json(429, {"ok": False, "error": "พยายามตรวจรหัสถี่เกินไป กรุณารอสักครู่"})
            account = ACCOUNTS.get(national_id)
            if not account or not account["pin"]:
                return self._send_json(404, {"ok": False, "error": "ยังไม่ได้ตั้งรหัส PIN"})
            if account["pin_locked_until"] > time.monotonic():
                return self._send_json(423, {"ok": False, "error": "รหัส PIN ถูกระงับชั่วคราว"})
            if pin != account["pin"]:
                account["pin_attempts"] += 1
                if account["pin_attempts"] >= 5:
                    account["pin_locked_until"] = time.monotonic() + 300
                return self._send_json(401, {"ok": False, "error": "รหัส PIN ไม่ถูกต้อง", "attempts_left": max(0, 5 - account["pin_attempts"])})
            account.update({"pin_attempts": 0, "pin_locked_until": 0})
            return self._send_json(200, {"ok": True, **issue_token(account)})

        if path == "/api/patient/pin/change/":
            account = self._require_account()
            if not account:
                return
            old_pin, new_pin = str(body.get("current_pin") or ""), str(body.get("new_pin") or "")
            if not re.fullmatch(r"[0-9]{6}", old_pin) or not re.fullmatch(r"[0-9]{6}", new_pin):
                return self._send_json(400, {"ok": False, "error": "รหัส PIN ต้องเป็นตัวเลข 6 หลัก"})
            if not account["pin"]:
                return self._send_json(404, {"ok": False, "error": "ยังไม่ได้ตั้งรหัส PIN"})
            if old_pin != account["pin"]:
                return self._send_json(401, {"ok": False, "error": "รหัส PIN เดิมไม่ถูกต้อง", "attempts_left": 4})
            if new_pin == old_pin:
                return self._send_json(400, {"ok": False, "error": "รหัส PIN ใหม่ต้องไม่ซ้ำกับรหัสเดิม"})
            account["pin"] = new_pin
            return self._send_json(200, {"ok": True, "message": "เปลี่ยนรหัส PIN สำเร็จ"})

        if path == "/api/patient/pin/reset/request/":
            national_id = str(body.get("national_id") or "").strip()
            channel = str(body.get("channel") or "").strip().lower()
            if not re.fullmatch(r"[0-9]{13}", national_id):
                return self._send_json(400, {"ok": False, "error": "ข้อมูลไม่ถูกต้อง"})
            if channel not in ("email", "phone"):
                return self._send_json(400, {"ok": False, "error": "ช่องทางรับรหัสไม่ถูกต้อง"})
            if channel == "phone":
                return self._send_json(400, {"ok": False, "error": "ยังไม่เปิดให้บริการรับรหัสทาง SMS กรุณาใช้อีเมล"})
            if rate_limited("pin-reset", national_id, 3, 900):
                return self._send_json(429, {"ok": False, "error": "ขอรหัสถี่เกินไป กรุณารอสักครู่"})
            generic = {"ok": True, "message": "ส่งรหัส OTP เรียบร้อยแล้ว", "resend_after_seconds": 60,
                       "cooldown_seconds": 60, "expires_in_seconds": 300, "masked_target": None}
            account = ACCOUNTS.get(national_id)
            if not account or not account["profile"].get("email"):
                return self._send_json(200, generic)
            test_mode = is_local_test_mode(self.client_address)
            otp = "123456" if test_mode else f"{secrets.randbelow(1_000_000):06d}"
            if not test_mode:
                try:
                    send_pin_reset_email(account["profile"]["email"], otp)
                except (OSError, smtplib.SMTPException, ValueError) as error:
                    print(f"[Mock SMTP] {error}")
                    return self._send_json(503, {"ok": False, "error": "ส่งอีเมล OTP ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP"})
            PIN_RESET[national_id] = {"otp": otp, "expires_at": time.monotonic() + 300, "attempts": 0}
            generic["masked_target"] = mask_email(account["profile"]["email"])
            return self._send_json(200, generic)

        if path == "/api/patient/pin/reset/verify-otp/":
            national_id = str(body.get("national_id") or "").strip()
            otp = str(body.get("otp") or "")
            if not re.fullmatch(r"[0-9]{13}", national_id):
                return self._send_json(400, {"ok": False, "error": "ข้อมูลไม่ถูกต้อง"})
            challenge = PIN_RESET.get(national_id)
            if not challenge or challenge.get("otp") is None:
                return self._send_json(400, {"ok": False, "error": "ไม่พบรหัส OTP ที่ใช้งานได้ กรุณาขอใหม่"})
            if challenge["expires_at"] <= time.monotonic():
                return self._send_json(400, {"ok": False, "error": "รหัส OTP หมดอายุ กรุณาขอใหม่"})
            if challenge["attempts"] >= 5:
                return self._send_json(400, {"ok": False, "error": "กรอกรหัส OTP ผิดเกินกำหนด กรุณาขอใหม่"})
            if not re.fullmatch(r"[0-9]{6}", otp) or otp != challenge["otp"]:
                challenge["attempts"] += 1
                message = "กรอกรหัส OTP ผิดเกินกำหนด กรุณาขอใหม่" if challenge["attempts"] >= 5 else "รหัส OTP ไม่ถูกต้อง"
                return self._send_json(400, {"ok": False, "error": message})
            reset_token = secrets.token_urlsafe(32)
            challenge.update({"otp": None, "reset_token": reset_token, "token_expires_at": time.monotonic() + 900})
            return self._send_json(200, {"ok": True, "reset_token": reset_token, "message": "ยืนยันรหัส OTP สำเร็จ กรุณาตั้งรหัส PIN ใหม่"})

        if path == "/api/patient/pin/reset/confirm/":
            reset_token = str(body.get("reset_token") or "")
            pin = str(body.get("pin") or body.get("new_pin") or "")
            if not re.fullmatch(r"[0-9]{6}", pin):
                return self._send_json(400, {"ok": False, "error": "รหัส PIN ต้องเป็นตัวเลข 6 หลัก"})
            match = next(((national_id, challenge) for national_id, challenge in PIN_RESET.items()
                          if reset_token and challenge.get("reset_token") == reset_token), None)
            if not match:
                return self._send_json(400, {"ok": False, "error": "Reset token ไม่ถูกต้องหรือหมดอายุ"})
            national_id, challenge = match
            if challenge.get("token_expires_at", 0) <= time.monotonic():
                del PIN_RESET[national_id]
                return self._send_json(400, {"ok": False, "error": "Reset token ไม่ถูกต้องหรือหมดอายุ"})
            account = ACCOUNTS[national_id]
            account.update({"pin": pin, "pin_attempts": 0, "pin_locked_until": 0})
            del PIN_RESET[national_id]
            return self._send_json(200, {"ok": True, **issue_token(account), "message": "ตั้งรหัส PIN ใหม่สำเร็จ"})

        if path == "/api/patient/queue/cancel/":
            account = self._require_account()
            if not account:
                return
            if not account["queue"]:
                return self._send_json(409, {"ok": False, "error": "ไม่พบคิวที่กำลังใช้งาน"})
            account["queue"] = None
            return self._send_json(200, {"ok": True, "message": "ยกเลิกคิวเรียบร้อยแล้ว"})

        self._send_json(404, {"ok": False, "error": "Not Found"})

    def do_GET(self):
        path = self.path.rstrip("/") + "/"
        if path.startswith("/api/patient/queue/") and path != "/api/patient/queue/":
            tracking_token = path[len("/api/patient/queue/"):].rstrip("/")
            account = next((item for item in ACCOUNTS.values() if item.get("tracking_token") == tracking_token), None)
            if not account:
                return self._send_json(404, {"ok": False, "error": "ไม่พบข้อมูลคิว"})
            if not account["queue"]:
                return self._send_json(200, {"ok": True, "queue_number": None, "status_label": "ไม่มีคิว"})
            return self._send_json(200, account["queue"])
        if path in ("/api/patient/me/", "/api/patient/queue/"):
            account = self._require_account()
            if not account:
                return
            if path.endswith("/me/"):
                return self._send_json(200, self._account_data(account))
            if not account["queue"]:
                return self._send_json(200, {"ok": True, "queue_number": None, "message": "ไม่มีคิวที่กำลังรอรับบริการในวันนี้"})
            account["queue"]["updated_at"] = now_iso()
            return self._send_json(200, account["queue"])
        self._send_json(404, {"ok": False, "error": "Not Found"})

    def do_PATCH(self):
        if self.path.rstrip("/") + "/" != "/api/patient/me/":
            return self._send_json(404, {"ok": False, "error": "Not Found"})
        account = self._require_account()
        if not account:
            return
        body = self._read_json()
        profile = account["profile"]
        errors = {key: ["ไม่สามารถแก้ไขข้อมูลนี้ผ่าน Patient Portal ได้"] for key in ("national_id", "hn")
                  if key in body and str(body[key]) != str(profile.get(key))}
        if errors:
            return self._send_json(400, {"ok": False, "error": "มีข้อมูลที่ไม่อนุญาตให้แก้ไข", "errors": errors})
        for key in ("first_name", "last_name", "phone", "email", "gender", "blood_type", "age", "height_cm", "weight_kg",
                    "address", "province", "district", "subdistrict", "postal_code", "chronic_diseases", "allergies",
                    "medications", "emergency_name", "emergency_phone", "emergency_contacts"):
            if key in body:
                profile[key] = body[key]
        return self._send_json(200, self._account_data(account))


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), MockBackendHandler)
    print(f"[Mock Backend] Running at http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
