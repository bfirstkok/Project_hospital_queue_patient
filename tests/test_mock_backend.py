"""HTTP contract checks for the local patient API mock. No Playwright or real email."""

import copy
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mock_backend as backend

SEED_ACCOUNTS = copy.deepcopy(backend.ACCOUNTS)


class MockPatientApiTest(unittest.TestCase):
    def setUp(self):
        backend.ACCOUNTS.clear()
        backend.ACCOUNTS.update(copy.deepcopy(SEED_ACCOUNTS))
        backend.TOKENS.clear()
        backend.PASSWORD_RESET.clear()
        backend.PIN_RESET.clear()
        backend.GOOGLE_LINK_TOKENS.clear()
        backend.RATE_EVENTS.clear()
        self.server = HTTPServer(("127.0.0.1", 0), backend.MockBackendHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, payload=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.server.server_port}{path}",
            json.dumps(payload).encode() if payload is not None else None,
            headers, method=method,
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def post(self, path, payload, token=None):
        return self.request("POST", path, payload, token)

    def test_register_login_profile_and_pin_match_backend_contract(self):
        payload = {
            "national_id": "2222222222222", "username": "newpatient",
            "password": "NewStrongPass#2026", "email": "new@example.com",
            "first_name": "ผู้ป่วย", "last_name": "ใหม่", "consent": True,
        }
        status, registered = self.post("/api/patient/register/", payload)
        self.assertEqual(status, 201)
        self.assertEqual(registered["token_type"], "Bearer")
        self.assertTrue(registered["access_token"])
        self.assertEqual(self.request("GET", "/api/patient/me/")[0], 401)
        self.assertEqual(self.request("GET", "/api/patient/queue/")[0], 401)
        status, me = self.request("GET", "/api/patient/me/", token=registered["access_token"])
        self.assertEqual(status, 200)
        self.assertEqual(me["profile"]["username"], "newpatient")
        self.assertEqual(self.request("GET", registered["status_url"])[0], 200)
        self.assertEqual(self.request("GET", "/api/patient/queue/", token=registered["access_token"])[1]["queue_number"], registered["queue_number"])
        self.assertEqual(self.request("PATCH", "/api/patient/me/", {"national_id": "9999999999999"}, registered["access_token"])[0], 400)
        self.assertEqual(self.request("PATCH", "/api/patient/me/", {"address": "99/1 ถนนทดสอบ"}, registered["access_token"])[1]["profile"]["address"], "99/1 ถนนทดสอบ")

        status, login = self.post("/api/patient/login/", {"identifier": "new@example.com", "password": payload["password"]})
        self.assertEqual(status, 200)
        self.assertEqual(login["profile"]["national_id"], payload["national_id"])
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "newpatient", "password": "wrong"})[0], 401)
        self.assertEqual(self.post("/api/patient/pin/verify/", {"national_id": payload["national_id"], "pin": "123456"})[0], 404)
        self.assertEqual(self.post("/api/patient/pin/setup/", {"pin": "456789"})[0], 401)
        self.assertEqual(self.post("/api/patient/pin/setup/", {"pin": "456789"}, login["access_token"])[0], 200)
        self.assertEqual(self.post("/api/patient/pin/verify/", {"national_id": payload["national_id"], "pin": "123456"})[0], 401)
        self.assertEqual(self.post("/api/patient/pin/verify/", {"national_id": payload["national_id"], "pin": "456789"})[0], 200)
        self.assertEqual(self.post("/api/patient/register/", payload)[0], 409)

    def test_password_reset_email_and_one_time_token(self):
        login = self.post("/api/patient/login/", {"identifier": "somchai99", "password": "Password@2026"})[1]
        status, unknown = self.post("/api/patient/password/reset/request/", {"identifier": "unknown@example.com", "channel": "email"})
        self.assertEqual(status, 200)
        self.assertIsNone(unknown["masked_target"])
        self.assertEqual(self.post("/api/patient/password/reset/request/", {"identifier": "somchai99", "channel": "sms"})[0], 400)
        with patch.object(backend, "send_password_reset_email", side_effect=ValueError("SMTP missing")):
            self.assertEqual(self.post("/api/patient/password/reset/request/", {"identifier": "somchai99", "channel": "email"})[0], 503)
            self.assertFalse(backend.PASSWORD_RESET)

        sent = []
        with patch.object(backend, "send_password_reset_email", side_effect=lambda address, otp: sent.append((address, otp))):
            status, result = self.post("/api/patient/password/reset/request/", {"identifier": "somchai99", "channel": "email"})
        self.assertEqual(status, 200)
        self.assertNotIn(sent[0][1], result["message"])
        self.assertIsNotNone(result["masked_target"])
        self.assertEqual(self.post("/api/patient/password/reset/verify-otp/", {"identifier": "somchai99", "otp": "abcdef"})[0], 400)
        status, verified = self.post("/api/patient/password/reset/verify-otp/", {"identifier": "somchai99", "otp": sent[0][1]})
        self.assertEqual(status, 200)
        self.assertEqual(self.post("/api/patient/password/reset/verify-otp/", {"identifier": "somchai99", "otp": sent[0][1]})[0], 400)
        confirm = {"identifier": "somchai99", "reset_token": verified["reset_token"], "new_password": "ChangedStrong#2026", "confirm_password": "ChangedStrong#2026"}
        self.assertEqual(self.post("/api/patient/password/reset/confirm/", confirm)[0], 200)
        self.assertEqual(self.post("/api/patient/password/reset/confirm/", confirm)[0], 400)
        self.assertEqual(self.request("GET", "/api/patient/me/", token=login["access_token"])[0], 401)
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "somchai99", "password": "ChangedStrong#2026"})[0], 200)
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "somchai99", "password": "Password@2026"})[0], 401)

    def test_google_rejects_unverified_credential(self):
        self.assertEqual(self.post("/api/patient/auth/google/", {"credential": ""})[0], 400)
        with patch.object(backend, "verify_google_id_token", side_effect=ValueError("bad token")):
            self.assertEqual(self.post("/api/patient/auth/google/", {"credential": "fake-token"})[0], 401)

    def test_verified_google_new_user_can_register(self):
        claims = {"sub": "google-123", "email": "google@example.com", "given_name": "Google", "family_name": "User"}
        with patch.object(backend, "verify_google_id_token", return_value=claims):
            status, google = self.post("/api/patient/auth/google/", {"credential": "verified-token"})
        self.assertEqual(status, 200)
        self.assertTrue(google["is_new_user"])
        status, registered = self.post("/api/patient/register/", {
            "temp_token": google["temp_token"], "national_id": "3333333333333",
            "first_name": "Google", "last_name": "User", "consent": True,
        })
        self.assertEqual(status, 201)
        self.assertTrue(registered["access_token"])
        with patch.object(backend, "verify_google_id_token", return_value=claims):
            status, login = self.post("/api/patient/auth/google/", {"credential": "verified-token"})
        self.assertEqual(status, 200)
        self.assertEqual(login["profile"]["national_id"], "3333333333333")

    def test_smtp_uses_configured_account(self):
        with patch.dict(os.environ, {"MOCK_SMTP_HOST": "smtp.example.test", "MOCK_SMTP_PORT": "587",
                                  "MOCK_SMTP_USER": "sender@example.test", "MOCK_SMTP_PASSWORD": "test-password"}), \
                patch.object(backend.smtplib, "SMTP") as smtp:
            backend.send_password_reset_email("recipient@example.test", "123456")
        smtp.assert_called_once_with("smtp.example.test", 587, timeout=10)
        connection = smtp.return_value.__enter__.return_value
        connection.starttls.assert_called_once()
        connection.login.assert_called_once_with("sender@example.test", "test-password")
        self.assertIn("123456", connection.send_message.call_args.args[0].get_content())

    def test_login_rate_limit_matches_backend_window(self):
        for _ in range(5):
            self.assertEqual(self.post("/api/patient/login/", {"identifier": "somchai99", "password": "wrong"})[0], 401)
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "somchai99", "password": "Password@2026"})[0], 429)

    def test_e2e_mode_reset_restores_seed_data_and_clears_rate_limits(self):
        patient = {
            "national_id": "2222222222222", "username": "newpatient",
            "password": "NewStrongPass#2026", "email": "new@example.com",
            "first_name": "ผู้ป่วย", "last_name": "ใหม่", "consent": True,
        }
        self.assertEqual(self.post("/api/patient/register/", patient)[0], 201)
        for _ in range(5):
            self.post("/api/patient/login/", {"identifier": "somchai99", "password": "wrong"})

        with patch.dict(os.environ, {"MOCK_BACKEND_TEST_MODE": "0"}):
            self.assertEqual(self.post("/__test__/reset/", {})[0], 404)

        with patch.dict(os.environ, {"MOCK_BACKEND_TEST_MODE": "1"}):
            status, result = self.post("/__test__/reset/", {})

        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "somchai99", "password": "Password@2026"})[0], 200)
        self.assertEqual(self.post("/api/patient/login/", {"identifier": "newpatient", "password": patient["password"]})[0], 401)

    def test_e2e_mode_uses_deterministic_email_otp_without_sending_mail(self):
        with patch.dict(os.environ, {"MOCK_BACKEND_TEST_MODE": "1"}), \
                patch.object(backend, "send_password_reset_email", side_effect=AssertionError("test mode must not send real email")):
            status, requested = self.post("/api/patient/password/reset/request/", {"identifier": "somchai99", "channel": "email"})
            self.assertEqual(status, 200)
            self.assertNotIn("otp", requested)
            status, verified = self.post("/api/patient/password/reset/verify-otp/", {"identifier": "somchai99", "otp": "123456"})

        self.assertEqual(status, 200)
        self.assertTrue(verified["reset_token"])

    def test_e2e_google_credential_uses_seeded_patient_without_google_network(self):
        with patch.dict(os.environ, {"MOCK_BACKEND_TEST_MODE": "1"}):
            status, result = self.post("/api/patient/auth/google/", {"credential": "google_oauth_test_token"})

        self.assertEqual(status, 200)
        self.assertEqual(result["profile"]["national_id"], "1234567890123")
        self.assertTrue(result["access_token"])


if __name__ == "__main__":
    unittest.main()
