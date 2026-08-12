import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationView } from "./RegistrationView";

describe("RegistrationView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("converts numeric values and moves to queue status after successful registration", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, access_token: "token", queue_number: "Q-1" }), { headers: { "content-type": "application/json" } }));
    const onSuccess = vi.fn();
    render(createElement(RegistrationView, { onLogin: vi.fn(), onSuccess }));
    fireEvent.change(screen.getByLabelText("ชื่อ *"), { target: { value: "สมชาย" } });
    fireEvent.change(screen.getByLabelText("นามสกุล *"), { target: { value: "ใจดี" } });
    fireEvent.change(screen.getByPlaceholderText("ตัวเลข 13 หลัก ไม่ต้องใส่ขีด"), { target: { value: "1234567890123" } });
    fireEvent.change(screen.getByLabelText("อายุ"), { target: { value: "30" } });
    fireEvent.change(screen.getByPlaceholderText("เช่น เวียนศีรษะ มีไข้ และไอติดต่อกัน 2 วัน"), { target: { value: "ปวดหัว" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้ป่วย" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("token", expect.objectContaining({ queue_number: "Q-1" })));
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toContain('"age":30');
  });
});
