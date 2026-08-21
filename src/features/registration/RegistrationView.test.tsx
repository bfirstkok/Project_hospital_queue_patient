import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationView } from "./RegistrationView";

describe("RegistrationView", () => {
  beforeEach(() => {
    localStorage.clear();
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com" };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows PDPA consent gate initially and allows proceeding when accepted", async () => {
    const onLogin = vi.fn();
    render(createElement(RegistrationView, { onLogin, onSuccess: vi.fn() }));

    // Should show PDPA gate first
    expect(screen.getByText("หนังสือยินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล (PDPA)")).toBeDefined();
    
    // Accept button should be disabled until checkbox is checked
    const acceptBtn = screen.getByRole("button", { name: /ยินยอมและดำเนินการต่อ/ });
    expect(acceptBtn.hasAttribute("disabled")).toBe(true);

    // Check PDPA consent checkbox
    const pdpaCheckbox = screen.getByRole("checkbox", { name: /ยินยอมเงื่อนไข PDPA/ });
    fireEvent.click(pdpaCheckbox);
    expect(acceptBtn.hasAttribute("disabled")).toBe(false);

    // Click accept to proceed to registration form
    fireEvent.click(acceptBtn);

    // Should now show registration form
    expect(screen.getByLabelText("ชื่อ *")).toBeDefined();
    expect(screen.getByLabelText("จังหวัด")).toBeDefined();
  });

  it("calculates age automatically when birth date is selected", async () => {
    render(createElement(RegistrationView, { initialPdpaAccepted: true, onLogin: vi.fn(), onSuccess: vi.fn() }));

    const birthDateInput = screen.getByLabelText("วันเดือนปีเกิด") as HTMLInputElement;
    const ageInput = screen.getByLabelText("อายุ") as HTMLInputElement;

    // Pick a birthdate (e.g. 2000-01-01)
    fireEvent.change(birthDateInput, { target: { value: "2000-01-01" } });

    // Age should be automatically populated
    expect(Number(ageInput.value)).toBeGreaterThan(20);
    expect(screen.getByRole("status").textContent).toContain("อายุ:");
  });

  it("restores draft data from localStorage and displays draft banner", async () => {
    localStorage.setItem(
      "opd_patient_registration_draft_v1",
      JSON.stringify({
        firstName: "สมคิด",
        lastName: "มุ่งมั่น",
        nationalId: "1234567890123",
        phone: "0812345678",
        savedAt: "16:45",
        isPdpaAccepted: true,
      })
    );

    render(createElement(RegistrationView, { initialPdpaAccepted: true, onLogin: vi.fn(), onSuccess: vi.fn() }));

    expect(screen.getByText("กู้คืนข้อมูลร่างที่คุณเคยกรอกไว้ให้อัตโนมัติ")).toBeDefined();
    expect((screen.getByLabelText("ชื่อ *") as HTMLInputElement).value).toBe("สมคิด");
    expect((screen.getByLabelText("นามสกุล *") as HTMLInputElement).value).toBe("มุ่งมั่น");
  });

  it("cascades address dropdowns from province to district and subdistrict and fills postal code", async () => {
    render(createElement(RegistrationView, { initialPdpaAccepted: true, onLogin: vi.fn(), onSuccess: vi.fn() }));

    const provinceSelect = screen.getByLabelText("จังหวัด") as HTMLSelectElement;
    const districtSelect = screen.getByLabelText("อำเภอ / เขต") as HTMLSelectElement;
    const subdistrictSelect = screen.getByLabelText("ตำบล / แขวง") as HTMLSelectElement;
    const postalCodeInput = screen.getByLabelText("รหัสไปรษณีย์") as HTMLInputElement;

    // Initially district and subdistrict are disabled
    expect(districtSelect.disabled).toBe(true);
    expect(subdistrictSelect.disabled).toBe(true);

    // Select province: ขอนแก่น
    fireEvent.change(provinceSelect, { target: { value: "ขอนแก่น" } });
    expect(districtSelect.disabled).toBe(false);

    // Select district: เมืองขอนแก่น
    fireEvent.change(districtSelect, { target: { value: "เมืองขอนแก่น" } });
    expect(subdistrictSelect.disabled).toBe(false);

    // Select subdistrict: ศิลา
    fireEvent.change(subdistrictSelect, { target: { value: "ศิลา" } });
    expect(postalCodeInput.value).toBe("40000");
  });

  it("correctly preserves the 3rd emergency contact when removing the 2nd contact", async () => {
    render(createElement(RegistrationView, { initialPdpaAccepted: true, onLogin: vi.fn(), onSuccess: vi.fn() }));

    // Add 2nd contact
    fireEvent.click(screen.getByRole("button", { name: /\+ เพิ่มผู้ติดต่อฉุกเฉิน \(1\/3\)/ }));
    // Add 3rd contact
    fireEvent.click(screen.getByRole("button", { name: /\+ เพิ่มผู้ติดต่อฉุกเฉิน \(2\/3\)/ }));

    // Fill in Contact 1, Contact 2, Contact 3
    const nameInputs = screen.getAllByPlaceholderText("ชื่อ-นามสกุล") as HTMLInputElement[];
    expect(nameInputs.length).toBe(3);

    fireEvent.change(nameInputs[0], { target: { value: "ผู้ติดต่อหนึ่ง" } });
    fireEvent.change(nameInputs[1], { target: { value: "ผู้ติดต่อสอง" } });
    fireEvent.change(nameInputs[2], { target: { value: "ผู้ติดต่อสาม" } });

    // There are 2 "ลบรายการ" buttons (for contact 2 and contact 3)
    const removeButtons = screen.getAllByRole("button", { name: "ลบรายการ" });
    expect(removeButtons.length).toBe(2);

    // Click remove on the 2nd contact (the first remove button in the list)
    fireEvent.click(removeButtons[0]);

    // Now there should be 2 contacts remaining: "ผู้ติดต่อหนึ่ง" and "ผู้ติดต่อสาม" (shifted to index 2)
    const remainingInputs = screen.getAllByPlaceholderText("ชื่อ-นามสกุล") as HTMLInputElement[];
    expect(remainingInputs.length).toBe(2);
    expect(remainingInputs[0].value).toBe("ผู้ติดต่อหนึ่ง");
    expect(remainingInputs[1].value).toBe("ผู้ติดต่อสาม");
  });

  it("converts numeric values and moves to queue status after successful registration", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, access_token: "token", queue_number: "Q-1" }), {
        headers: { "content-type": "application/json" },
      })
    );
    const onSuccess = vi.fn();
    render(createElement(RegistrationView, { initialPdpaAccepted: true, onLogin: vi.fn(), onSuccess }));
    
    fireEvent.change(screen.getByLabelText("ชื่อ *"), { target: { value: "สมชาย" } });
    fireEvent.change(screen.getByLabelText("นามสกุล *"), { target: { value: "ใจดี" } });
    fireEvent.change(screen.getByPlaceholderText("ตัวเลข 13 หลัก ไม่ต้องใส่ขีด"), { target: { value: "1234567890123" } });
    fireEvent.change(screen.getByLabelText("อายุ"), { target: { value: "30" } });
    fireEvent.change(screen.getByPlaceholderText("เช่น เวียนศีรษะ มีไข้ และไอติดต่อกัน 2 วัน"), { target: { value: "ปวดหัว" } });
    
    // Address dropdown selection
    fireEvent.change(screen.getByLabelText("จังหวัด"), { target: { value: "ขอนแก่น" } });
    fireEvent.change(screen.getByLabelText("อำเภอ / เขต"), { target: { value: "เมืองขอนแก่น" } });
    fireEvent.change(screen.getByLabelText("ตำบล / แขวง"), { target: { value: "ศิลา" } });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้ป่วย" }));
    
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("token", expect.objectContaining({ queue_number: "Q-1" })));
    const fetchBody = vi.mocked(fetch).mock.calls[0][1]?.body as string;
    expect(fetchBody).toContain('"age":30');
    expect(fetchBody).toContain('"province":"ขอนแก่น"');
    expect(fetchBody).toContain('"district":"เมืองขอนแก่น"');
    expect(fetchBody).toContain('"subdistrict":"ศิลา"');
    expect(fetchBody).toContain('"postal_code":"40000"');
  });
});
