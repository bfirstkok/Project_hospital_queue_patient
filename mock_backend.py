import json
import base64
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = 8000

MOCK_PATIENT_PROFILE = {
    "username": "somchai99",
    "first_name": "สมชาย",
    "last_name": "ใจดี",
    "national_id": "1234567890123",
    "hn": "HN-67001",
    "phone": "081-234-5678",
    "email": "somchai@example.com",
    "gender": "ชาย",
    "age": 35,
    "blood_type": "O",
    "height_cm": 175,
    "weight_kg": 70,
    "address": "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
    "province": "กรุงเทพมหานคร",
    "district": "เขตจตุจักร",
    "subdistrict": "แขวงลาดยาว",
    "postal_code": "10900",
    "chronic_diseases": "ไม่มี",
    "allergies": "ไม่มีประวัติแพ้ยา",
    "medications": "ไม่มี",
    "emergency_name": "สมศรี ใจดี",
    "emergency_phone": "089-876-5432",
    "emergency_contacts": [
        {
            "id": "em-mock-1",
            "name": "สมศรี ใจดี",
            "relationship": "SPOUSE",
            "phone": "089-876-5432"
        }
    ]
}

MOCK_DATABASE_SECURITY = {
    "pins": {},
    "attempts": {}
}

MOCK_ACTIVE_QUEUE = {
    "ok": True,
    "queue_number": "A012",
    "status_label": "รอตรวจ",
    "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
    "queue_position": 3,
    "room": "ห้องตรวจ 2",
    "updated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
}

class MockBackendHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}

    def do_POST(self):
        path = self.path.rstrip("/") + "/"
        body = self._read_json()
        
        # 1. Login Endpoint
        if path == "/api/patient/login/":
            identifier = body.get("identifier") or body.get("national_id") or ""
            password = body.get("password")

            # Probing national_id without password (used by registration duplicate guard)
            if not password and "national_id" in body and not body.get("identifier"):
                if identifier in ["1234567890123", "somchai99"]:
                    MOCK_ACTIVE_QUEUE["queue_number"] = "A012"
                    MOCK_ACTIVE_QUEUE["status_label"] = "รอตรวจ"
                    MOCK_ACTIVE_QUEUE["instruction"] = "กรุณารอเรียกคิวที่ห้องตรวจ 2"
                    MOCK_ACTIVE_QUEUE["queue_position"] = 3
                    MOCK_ACTIVE_QUEUE["room"] = "ห้องตรวจ 2"
                    response_data = {
                        "ok": True,
                        "access_token": "mock_patient_token_12345",
                        "message": f"พบบัญชีผู้ป่วย {identifier}"
                    }
                    self._send_json(200, response_data)
                    return
                else:
                    self._send_json(404, {"ok": False, "error": "ไม่พบบัญชีผู้ป่วยเดิมในระบบ"})
                    return

            # Normal Login
            if password and password != "Password@2026":
                self._send_json(401, {"ok": False, "error": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"})
                return

            if identifier in ["somchai99", "1234567890123"]:
                MOCK_ACTIVE_QUEUE["queue_number"] = "A012"
                MOCK_ACTIVE_QUEUE["status_label"] = "รอตรวจ"
                MOCK_ACTIVE_QUEUE["instruction"] = "กรุณารอเรียกคิวที่ห้องตรวจ 2"
                MOCK_ACTIVE_QUEUE["queue_position"] = 3
                MOCK_ACTIVE_QUEUE["room"] = "ห้องตรวจ 2"

            response_data = {
                "ok": True,
                "access_token": "mock_patient_token_12345",
                "message": f"เข้าสู่ระบบสำเร็จในชื่อ {identifier or 'user'}"
            }
            self._send_json(200, response_data)
            return

        # 2. Google OAuth Login Endpoint
        if path == "/api/patient/auth/google/":
            credential = body.get("credential", "")
            
            # If a real Google OAuth2 access_token is received, query Google Userinfo endpoint
            if credential and credential.startswith("ya29."):
                try:
                    req = urllib.request.Request(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {credential}"}
                    )
                    with urllib.request.urlopen(req, timeout=5) as response:
                        user_info = json.loads(response.read().decode("utf-8"))
                        google_email = user_info.get("email", MOCK_PATIENT_PROFILE["email"])
                        given_name = user_info.get("given_name", "")
                        family_name = user_info.get("family_name", "")
                        
                        if given_name:
                            MOCK_PATIENT_PROFILE["first_name"] = given_name
                        if family_name:
                            MOCK_PATIENT_PROFILE["last_name"] = family_name
                        MOCK_PATIENT_PROFILE["email"] = google_email
                        
                        print(f"\n========================================================")
                        print(f" [Google OAuth2] Received REAL Google Access Token from Browser!")
                        print(f" > Email: {google_email}")
                        print(f" > Name:  {given_name} {family_name}")
                        print(f" > Picture: {user_info.get('picture')}")
                        print(f"========================================================\n")
                except Exception as e:
                    print(f"[Google OAuth2] Could not fetch userinfo from Google: {e}")

            # If a real Google JWT token (e.g. from One Tap) is received, extract claims
            elif credential and "." in credential:
                try:
                    parts = credential.split(".")
                    if len(parts) >= 2:
                        payload_b64 = parts[1]
                        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                        claims = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8"))
                        google_email = claims.get("email", MOCK_PATIENT_PROFILE["email"])
                        given_name = claims.get("given_name", "")
                        family_name = claims.get("family_name", "")
                        
                        if given_name:
                            MOCK_PATIENT_PROFILE["first_name"] = given_name
                        if family_name:
                            MOCK_PATIENT_PROFILE["last_name"] = family_name
                        MOCK_PATIENT_PROFILE["email"] = google_email
                        
                        print(f"\n========================================================")
                        print(f" [Google OAuth] Received REAL Google JWT Token from Browser!")
                        print(f" > Email: {google_email}")
                        print(f" > Name:  {given_name} {family_name}")
                        print(f" > Sub:   {claims.get('sub')}")
                        print(f" > Raw Token (First 60 chars): {credential[:60]}...")
                        print(f"========================================================\n")
                except Exception as e:
                    print(f"[Google OAuth] Could not decode JWT claims: {e}")

            response_data = {
                "ok": True,
                "access_token": "mock_patient_token_google_12345",
                "message": f"เข้าสู่ระบบด้วย Google สำเร็จ ({MOCK_PATIENT_PROFILE.get('email', '')})"
            }
            self._send_json(200, response_data)
            return

        # 3. Register Endpoint
        if path == "/api/patient/register/":
            first_name = body.get("first_name") or "สมหญิง"
            last_name = body.get("last_name") or "รักดี"
            username = body.get("username") or ""
            national_id = body.get("national_id") or "1103702111111"
            email = body.get("email") or ""
            phone = body.get("phone") or ""

            MOCK_PATIENT_PROFILE["first_name"] = first_name
            MOCK_PATIENT_PROFILE["last_name"] = last_name
            MOCK_PATIENT_PROFILE["username"] = username
            MOCK_PATIENT_PROFILE["national_id"] = national_id
            MOCK_PATIENT_PROFILE["email"] = email
            MOCK_PATIENT_PROFILE["phone"] = phone
            MOCK_PATIENT_PROFILE["hn"] = "HN-67002"

            MOCK_ACTIVE_QUEUE["queue_number"] = "A015"
            MOCK_ACTIVE_QUEUE["status_label"] = "รอตรวจ"
            MOCK_ACTIVE_QUEUE["instruction"] = "กรุณารอเรียกคิวที่ห้องตรวจ 1"
            MOCK_ACTIVE_QUEUE["queue_position"] = 4
            MOCK_ACTIVE_QUEUE["room"] = "ห้องตรวจ 1"
            MOCK_ACTIVE_QUEUE["updated_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

            response_data = {
                "ok": True,
                "access_token": f"mock_patient_token_{national_id}",
                "queue_number": MOCK_ACTIVE_QUEUE["queue_number"],
                "status_label": MOCK_ACTIVE_QUEUE["status_label"],
                "instruction": MOCK_ACTIVE_QUEUE["instruction"],
                "queue_position": MOCK_ACTIVE_QUEUE["queue_position"],
                "room": MOCK_ACTIVE_QUEUE["room"],
                "updated_at": MOCK_ACTIVE_QUEUE["updated_at"]
            }
            self._send_json(200, response_data)
            return

        # 4. Password Recovery - Request OTP
        if path == "/api/patient/password/reset/request/":
            channel = body.get("channel", "email")
            identifier = body.get("identifier", "")
            response_data = {
                "ok": True,
                "message": f"ระบบได้ส่งรหัส OTP 6 หลักไปยัง {channel} เรียบร้อยแล้ว (รหัสทดสอบ: 123456)",
                "cooldown_seconds": 60,
                "expires_in_seconds": 300,
                "masked_target": identifier[:3] + "•••" if len(identifier) > 3 else "user•••"
            }
            self._send_json(200, response_data)
            return

        # 5. Password Recovery - Verify OTP
        if path == "/api/patient/password/reset/verify-otp/":
            otp = str(body.get("otp", "")).strip()
            if len(otp) == 6:
                response_data = {
                    "ok": True,
                    "reset_token": "mock_reset_token_valid_998877",
                    "message": "ยืนยันรหัส OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่"
                }
                self._send_json(200, response_data)
            else:
                self._send_json(400, {"ok": False, "error": "รหัส OTP ต้องมี 6 หลัก"})
            return

        # 6. Password Recovery - Confirm New Password
        if path == "/api/patient/password/reset/confirm/":
            new_password = body.get("new_password", "")
            if len(new_password) >= 8:
                response_data = {
                    "ok": True,
                    "message": "เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
                }
                self._send_json(200, response_data)
            else:
                self._send_json(400, {"ok": False, "error": "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร"})
            return

        # 7. Cancel Queue Endpoint
        if path == "/api/patient/queue/cancel/":
            MOCK_ACTIVE_QUEUE["queue_number"] = None
            response_data = {
                "ok": True,
                "message": "ยกเลิกคิวเรียบร้อยแล้ว"
            }
            self._send_json(200, response_data)
            return

        # 8. Server-Authoritative Database PIN Setup Endpoint
        if path == "/api/patient/pin/setup/":
            pin = str(body.get("pin", "")).strip()
            if len(pin) == 6:
                MOCK_DATABASE_SECURITY["pins"]["default"] = pin
                MOCK_DATABASE_SECURITY["attempts"]["default"] = 0
                response_data = {
                    "ok": True,
                    "message": "บันทึกรหัสความปลอดภัย PIN บนระบบคลาวด์/ฐานข้อมูลสำเร็จ"
                }
                self._send_json(200, response_data)
            else:
                self._send_json(400, {"ok": False, "error": "รหัส PIN ต้องมี 6 หลัก"})
            return

        # 9. Server-Authoritative Database PIN Verify/Login Endpoint
        if path == "/api/patient/pin/verify/":
            pin = str(body.get("pin", "")).strip()
            stored_pin = MOCK_DATABASE_SECURITY["pins"].get("default")
            if not stored_pin or pin == stored_pin or pin == "123456":
                MOCK_DATABASE_SECURITY["attempts"]["default"] = 0
                response_data = {
                    "ok": True,
                    "access_token": "mock_patient_token_12345"
                }
                self._send_json(200, response_data)
            else:
                attempts = MOCK_DATABASE_SECURITY["attempts"].get("default", 0) + 1
                MOCK_DATABASE_SECURITY["attempts"]["default"] = attempts
                if attempts >= 3:
                    self._send_json(423, {"ok": False, "error": "รหัส PIN ไม่ถูกต้องเกินกำหนด ระบบฐานข้อมูลระงับชั่วคราว"})
                else:
                    self._send_json(401, {"ok": False, "error": f"รหัส PIN ไม่ถูกต้อง (เหลือโอกาสอีก {3 - attempts} ครั้ง)"})
            return

        # 10. PIN Reset - request OTP
        if path == "/api/patient/pin/reset/request/":
            self._send_json(200, {"ok": True, "message": "ส่งรหัส OTP กู้คืน PIN ผ่านระบบคลาวด์แล้ว"})
            return

        # 11. PIN Reset - confirm OTP + set new PIN
        if path == "/api/patient/pin/reset/confirm/":
            pin = str(body.get("pin", "")).strip()
            if len(pin) == 6:
                MOCK_DATABASE_SECURITY["pins"]["default"] = pin
                MOCK_DATABASE_SECURITY["attempts"]["default"] = 0
            self._send_json(200, {"ok": True, "access_token": "mock_patient_token_12345"})
            return

        self._send_json(404, {"ok": False, "error": "Not Found"})

    def do_PATCH(self):
        path = self.path.rstrip("/") + "/"

        # Patient profile update
        if path == "/api/patient/me/":
            body = self._read_json()
            for key, val in body.items():
                # Guard: Do not allow modifying national_id and hn
                if key not in ("national_id", "hn"):
                    MOCK_PATIENT_PROFILE[key] = val

            response_data = {
                "ok": True,
                "message": "บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว",
                "profile": MOCK_PATIENT_PROFILE,
                "active_queue": None,
                "visits": [],
                "appointments": []
            }
            self._send_json(200, response_data)
            return

        self._send_json(404, {"ok": False, "error": "Not Found"})

    def do_GET(self):
        path = self.path.rstrip("/") + "/"

        # Queue Status Endpoint
        if path == "/api/patient/queue/":
            if MOCK_ACTIVE_QUEUE.get("queue_number"):
                response_data = dict(MOCK_ACTIVE_QUEUE)
                response_data["updated_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
                self._send_json(200, response_data)
            else:
                self._send_json(200, {"ok": True, "queue_number": None, "status_label": "ไม่มีคิว"})
            return

        # Patient Account & History Endpoint
        if path == "/api/patient/me/":
            active_q = dict(MOCK_ACTIVE_QUEUE) if MOCK_ACTIVE_QUEUE.get("queue_number") else None
            response_data = {
                "ok": True,
                "profile": MOCK_PATIENT_PROFILE,
                "active_queue": active_q,
                "visits": [
                    {
                        "queue_number": "A005",
                        "status_label": "ตรวจเสร็จสิ้น",
                        "registered_at": "2026-08-01 09:30",
                        "note": "ตรวจสุขภาพทั่วไปและตรวจเลือด",
                        "diagnosis": "สุขภาพแข็งแรงดี ผลเลือดปกติ",
                        "treatment": "แนะนำการออกกำลังกายและรับประทานอาหารให้ครบ 5 หมู่",
                        "vitals": {
                            "sys_bp": 120,
                            "dia_bp": 80,
                            "pr": 72,
                            "bt": 36.5,
                            "o2sat": 99
                        }
                    }
                ],
                "appointments": [
                    {
                        "status": "confirmed",
                        "status_label": "นัดตรวจติดตาม",
                        "date": "2026-09-15",
                        "time": "09:00 - 10:00",
                        "note": "ติดตามผลสุขภาพประจำปี"
                    }
                ]
            }
            self._send_json(200, response_data)
            return

        self._send_json(404, {"ok": False, "error": "Not Found"})

if __name__ == "__main__":
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, MockBackendHandler)
    print(f"[Mock Backend] Running at http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
