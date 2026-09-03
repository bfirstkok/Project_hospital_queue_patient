import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = 8000

class MockBackendHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

    def do_POST(self):
        path = self.path.rstrip("/") + "/"
        
        # 1. Login Endpoint
        if path == "/api/patient/login/":
            response_data = {
                "ok": True,
                "access_token": "mock_patient_token_12345"
            }
            self._send_json(200, response_data)
            return

        # 2. Register Endpoint
        if path == "/api/patient/register/":
            response_data = {
                "ok": True,
                "access_token": "mock_patient_token_12345",
                "queue_number": "A012",
                "status_label": "รอตรวจ",
                "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
                "queue_position": 3,
                "room": "ห้องตรวจ 2",
                "updated_at": datetime.now().strftime("%H:%M:%S")
            }
            self._send_json(200, response_data)
            return

        # 3. Cancel Queue Endpoint
        if path == "/api/patient/queue/cancel/":
            response_data = {
                "ok": True,
                "message": "ยกเลิกคิวเรียบร้อยแล้ว"
            }
            self._send_json(200, response_data)
            return

        # 4. PIN Setup Endpoint
        if path == "/api/patient/pin/setup/":
            response_data = {
                "ok": True,
                "message": "ตั้งรหัส PIN สำเร็จ"
            }
            self._send_json(200, response_data)
            return

        # 5. PIN Verify/Login Endpoint
        if path == "/api/patient/pin/verify/":
            response_data = {
                "ok": True,
                "access_token": "mock_patient_token_12345"
            }
            self._send_json(200, response_data)
            return

        self._send_json(404, {"ok": False, "error": "Not Found"})

    def do_GET(self):
        path = self.path.rstrip("/") + "/"

        # 3. Queue Status Endpoint
        if path == "/api/patient/queue/":
            response_data = {
                "ok": True,
                "queue_number": "A012",
                "status_label": "รอตรวจ",
                "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
                "queue_position": 3,
                "room": "ห้องตรวจ 2",
                "updated_at": datetime.now().strftime("%H:%M:%S")
            }
            self._send_json(200, response_data)
            return

        # 4. Patient Account & History Endpoint
        if path == "/api/patient/me/":
            response_data = {
                "ok": True,
                "profile": {
                    "first_name": "สมชาย",
                    "last_name": "ใจดี",
                    "national_id": "1234567890123",
                    "hn": "HN-67001",
                    "phone": "081-234-5678",
                    "gender": "ชาย",
                    "age": 35,
                    "blood_type": "O",
                    "height_cm": 175,
                    "weight_kg": 70,
                    "address": "123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ",
                    "chronic_diseases": "ไม่มี",
                    "allergies": "ไม่มีประวัติแพ้ยา",
                    "medications": "ไม่มี",
                    "emergency_name": "สมศรี ใจดี",
                    "emergency_phone": "089-876-5432"
                },
                "active_queue": {
                    "ok": True,
                    "queue_number": "A012",
                    "status_label": "รอตรวจ",
                    "instruction": "กรุณารอเรียกคิวที่ห้องตรวจ 2",
                    "queue_position": 3,
                    "room": "ห้องตรวจ 2",
                    "updated_at": datetime.now().strftime("%H:%M:%S")
                },
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
    print(f"🏥 Mock Hospital Backend is running at http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
