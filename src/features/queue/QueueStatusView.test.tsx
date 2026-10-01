import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueStatusView } from "./QueueStatusView";
import { patientApi } from "@/shared/api/patient-api";
import type { AccountData } from "@/shared/api/types";

describe("QueueStatusView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com", STATUS_REFRESH_MS: 10000 };
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(patientApi, "account").mockResolvedValue({ ok: true, visits: [] } as unknown as AccountData);
  });

  it("shows station event times instead of the polling time after refreshing", async () => {
    let pharmacyDone = false;
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
      ok: true, queue_number: "A012", status: "OPD_DONE", status_label: "รอปิด Visit",
      updated_at: pharmacyDone ? "2026-10-01T12:00:00Z" : "2026-10-01T11:30:00Z",
      patient_journey: { steps: [
        { key: "registration", label: "ลงทะเบียน", state: "done", detail: "ลงทะเบียนแล้ว", timestamp: "2026-10-01T11:00:00Z" },
        { key: "billing", label: "การเงิน", state: "done", detail: "ชำระแล้ว", timestamp: "2026-10-01T11:10:00Z" },
        { key: "pharmacy", label: "ห้องยา", state: pharmacyDone ? "done" : "pending", detail: "จ่ายยาแล้ว", timestamp: pharmacyDone ? "2026-10-01T11:20:40Z" : null },
      ] },
    }), { headers: { "content-type": "application/json" } }));
    render(createElement(QueueStatusView, { token: "mock_token", onAccount: vi.fn(), onUnauthorized: vi.fn() }));
    await waitFor(() => expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("การเงิน · ชำระแล้ว: 18:10:00 น."));
    pharmacyDone = true;
    fireEvent.click(screen.getByRole("button", { name: /อัปเดตสถานะคิว/ }));
    await waitFor(() => expect(screen.getByText("สถานะคิวจุดล่าสุด:").parentElement).toHaveTextContent("ห้องยา · จ่ายยาแล้ว: 18:20:40 น."));
    expect(screen.getByText("เริ่มรับคิว:").parentElement).toHaveTextContent("18:00:00 น.");
    expect(document.querySelector(".card-top-actions .card-updated-at")).toHaveTextContent("อัปเดตล่าสุด 19:00:00 น.");
    expect(screen.getByText("ประวัติคิว")).toBeInTheDocument();
  });

  it("shows LoadingScreen during initial queue status lookup", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // pending promise
    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    expect(screen.getByText("กำลังโหลด")).toBeInTheDocument();
  });

  it("renders queue data, estimated wait time, and room details", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          queue_number: "A012",
          status_label: "รอเรียกตรวจ",
          instruction: "รอเรียกหน้าห้องตรวจ 2",
          queue_position: 2,
          room: "ห้องตรวจ 2",
          updated_at: "2026-08-20T10:00:00Z",
        }),
        { headers: { "content-type": "application/json" } }
      )
    );

    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText("A012")).toBeInTheDocument());
    expect(screen.getByText("รอเรียกตรวจ")).toBeInTheDocument();
    expect(screen.getByText("ห้องตรวจ 2")).toBeInTheDocument();
    expect(screen.getByText("อันดับ 2")).toBeInTheDocument();
    expect(screen.getByText(/รออีกประมาณ 10 – 14 นาที/)).toBeInTheDocument();
    expect(screen.getByText("ใกล้ถึงคิวของคุณแล้ว!")).toBeInTheDocument();
  });

  it("updates the care steps when the backend advances the queue", async () => {
    const queueResponse = (status: string, statusLabel: string) => new Response(
      JSON.stringify({ ok: true, queue_number: "A012", status, status_label: statusLabel, instruction: "กรุณารอ", queue_position: null, room: null }),
      { headers: { "content-type": "application/json" } },
    );
    vi.mocked(fetch)
      .mockResolvedValueOnce(queueResponse("WAITING_VITALS", "รอตรวจวัดสัญญาณชีพ"))
      .mockResolvedValueOnce(queueResponse("WAITING_QUEUE", "รอเรียกคิว"))
      .mockResolvedValueOnce(queueResponse("CALLED", "กรุณาเข้าห้องตรวจ"));

    render(createElement(QueueStatusView, { token: "mock_token", onAccount: vi.fn(), onUnauthorized: vi.fn() }));
    await waitFor(() => expect(document.querySelector('.queue-progress [aria-current="step"]')?.textContent).toContain("ตรวจร่างกาย"));

    fireEvent.click(screen.getByRole("button", { name: /อัปเดตสถานะคิว/ }));
    await waitFor(() => expect(document.querySelector('.queue-progress [aria-current="step"]')?.textContent).toContain("รอห้องตรวจ"));

    fireEvent.click(screen.getByRole("button", { name: /อัปเดตสถานะคิว/ }));
    await waitFor(() => expect(document.querySelector('.queue-progress [aria-current="step"]')?.textContent).toContain("เข้าตรวจ"));
  });

  it("refreshes the billing and pharmacy footer from the backend journey", async () => {
    const queueResponse = (paid: boolean, dispensed: boolean) => new Response(
      JSON.stringify({
        ok: true,
        queue_number: "A012",
        status: "OPD_DONE",
        status_label: paid && dispensed ? "พร้อมกลับบ้าน · รอปิด Visit" : "การเงิน",
        instruction: paid && dispensed ? "รอเจ้าหน้าที่ปิด Visit" : "รอชำระเงิน",
        queue_position: null,
        room: null,
        updated_at: "2026-09-29T10:00:00Z",
        patient_journey: {
          current_label: paid && dispensed ? "พร้อมกลับบ้าน · รอปิด Visit" : "การเงิน",
          current_detail: paid && dispensed ? "รับยาและชำระเงินครบแล้ว · รอปิด Visit" : "รอชำระเงิน",
          steps: [
            { key: "registration", label: "ลงทะเบียน", state: "done", detail: "ลงทะเบียนแล้ว" },
            { key: "vitals", label: "วัดสัญญาณชีพ", state: "done", detail: "บันทึกสัญญาณชีพแล้ว" },
            { key: "triage", label: "คัดกรอง", state: "done", detail: "คัดกรองแล้ว" },
            { key: "queue", label: "รอ/เรียกคิว", state: "done", detail: "เรียกคิวแล้ว" },
            { key: "doctor", label: "ห้องตรวจ", state: "done", detail: "แพทย์ตรวจแล้ว" },
            {
              key: "billing",
              label: "การเงิน",
              state: paid ? "done" : "current",
              detail: paid ? "ชำระแล้ว" : "รอชำระเงิน",
            },
            {
              key: "pharmacy",
              label: "ห้องยา",
              state: dispensed ? "done" : "current",
              detail: dispensed ? "จ่ายยาแล้ว" : "รอห้องยา",
            },
            { key: "complete", label: "ออกจากโรงพยาบาล", state: "current", detail: "รอปิด Visit" },
          ],
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
    vi.mocked(fetch)
      .mockResolvedValueOnce(queueResponse(false, false))
      .mockResolvedValueOnce(queueResponse(true, true));

    render(createElement(QueueStatusView, {
      token: "mock_token",
      onAccount: vi.fn(),
      onUnauthorized: vi.fn(),
    }));

    await waitFor(() => {
      expect(screen.getByText("ชำระเงิน: รอชำระเงิน · จ่ายยา: รอห้องยา")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /อัปเดตสถานะคิว/ }));

    await waitFor(() => {
      expect(screen.getByText("ชำระเงิน: ชำระแล้ว · จ่ายยา: จ่ายยาแล้ว")).toBeInTheDocument();
    });
    expect(screen.getByText("ตอนนี้: พร้อมกลับบ้าน · รอปิด Visit")).toBeInTheDocument();
  });

  it("shows today's completed visit after it leaves the active queue API", async () => {
    vi.mocked(patientApi.account).mockRestore();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      const payload = url.includes("/api/patient/me/")
        ? { ok: true, visits: [{ queue_number: "A012", status: "DISCHARGED", status_label: "เสร็จสิ้นการรับบริการ", registered_at: new Date().toISOString() }] }
        : { ok: true, queue_number: null };
      return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    });

    render(createElement(QueueStatusView, { token: "mock_token", onAccount: vi.fn(), onUnauthorized: vi.fn() }));
    await waitFor(() => expect(screen.getByText(/คิวล่าสุดวันนี้ A012/)).toBeInTheDocument());
    expect(document.querySelector('.recent-visit-progress [aria-current="step"]')?.textContent).toContain("เสร็จสิ้น");
  });

  it("handles sound toggle and image save clicks without crash", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          queue_number: "B005",
          status_label: "รอตรวจ",
          instruction: "กรุณารอสักครู่",
          queue_position: 5,
          room: "ห้องตรวจ 1",
          updated_at: "2026-08-20T10:00:00Z",
        }),
        { headers: { "content-type": "application/json" } }
      )
    );

    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText("B005")).toBeInTheDocument());

    const toggleBtn = screen.getByLabelText("ปิดเสียงเตือน");
    fireEvent.click(toggleBtn);
    expect(screen.getByLabelText("เปิดเสียงเตือน")).toBeInTheDocument();

    const saveImgBtn = screen.getByRole("button", { name: /บันทึกบัตรคิวเป็นรูปภาพ/ });
    expect(saveImgBtn).toBeInTheDocument();
  });

  it("handles cancelling active queue with 2-step confirmation modal", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            queue_number: "C001",
            status_label: "รอตรวจ",
            instruction: "กรุณารอสักครู่",
            queue_position: 1,
            room: "ห้องตรวจ 3",
            updated_at: "2026-08-20T10:00:00Z",
          }),
          { headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            message: "ยกเลิกคิวเรียบร้อยแล้ว",
          }),
          { headers: { "content-type": "application/json" } }
        )
      );

    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText("C001")).toBeInTheDocument());

    // Click cancel queue button
    const cancelBtn = screen.getByRole("button", { name: "ยกเลิกคิวรับบริการ" });
    fireEvent.click(cancelBtn);

    // Step 1 modal appears
    expect(screen.getByText("ขั้นตอนที่ 1 จาก 2 : ตรวจสอบความตั้งใจ")).toBeInTheDocument();
    expect(screen.getByText("คุณต้องการยกเลิกคิวรับบริการหรือไม่?")).toBeInTheDocument();

    // Dismiss modal on step 1
    const dismissBtn = screen.getByRole("button", { name: "ไม่ยกเลิก (คงคิวไว้)" });
    fireEvent.click(dismissBtn);
    expect(screen.queryByText("ขั้นตอนที่ 1 จาก 2 : ตรวจสอบความตั้งใจ")).toBeNull();
    expect(screen.getByText("C001")).toBeInTheDocument();

    // Open again to Step 1
    fireEvent.click(cancelBtn);
    expect(screen.getByText("ขั้นตอนที่ 1 จาก 2 : ตรวจสอบความตั้งใจ")).toBeInTheDocument();

    // Proceed to Step 2
    const nextStepBtn = screen.getByRole("button", { name: "ดำเนินการต่อ (ขั้นที่ 2) →" });
    fireEvent.click(nextStepBtn);

    // Step 2 modal appears
    expect(screen.getByText("ขั้นตอนที่ 2 จาก 2 : ยืนยันครั้งสุดท้าย")).toBeInTheDocument();
    expect(screen.getByText(/ยืนยันการสละสิทธิ์คิว C001/)).toBeInTheDocument();

    // Test back button to Step 1
    const backBtn = screen.getByRole("button", { name: "← ย้อนกลับ" });
    fireEvent.click(backBtn);
    expect(screen.getByText("ขั้นตอนที่ 1 จาก 2 : ตรวจสอบความตั้งใจ")).toBeInTheDocument();

    // Go to Step 2 again and Confirm
    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ (ขั้นที่ 2) →" }));
    const confirmBtn = screen.getByRole("button", { name: "ยืนยันยกเลิกคิวทันที" });
    fireEvent.click(confirmBtn);

    // Should call cancel API and show success message in no-queue view
    await waitFor(() => expect(screen.getByText("ยกเลิกคิวรับบริการเรียบร้อยแล้ว")).toBeInTheDocument());
    expect(screen.getByText("ยังไม่มีคิวรับบริการในขณะนี้")).toBeInTheDocument();
  });

  it("hides self-service cancellation after the queue enters a protected clinical stage", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          queue_number: "M009",
          status: "OBSERVATION_MONITORING",
          status_label: "กำลังเฝ้าระวัง",
          instruction: "กรุณารอพยาบาลดูแล",
          queue_position: null,
          room: null,
          updated_at: "2026-09-24T06:30:00Z",
        }),
        { headers: { "content-type": "application/json" } }
      )
    );

    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText("M009")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "ยกเลิกคิวรับบริการ" })).toBeNull();
    expect(screen.getByText("ไม่สามารถยกเลิกคิวด้วยตนเองในขั้นตอนนี้")).toBeInTheDocument();
    expect(screen.getByText("คิวอยู่ในขั้นตอนที่ไม่สามารถยกเลิกด้วยตนเองได้ กรุณาติดต่อเจ้าหน้าที่")).toBeInTheDocument();
  });

  it("keeps the queue visible and shows the API error when cancellation fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            queue_number: "C002",
            status_label: "รอตรวจ",
            instruction: "กรุณารอสักครู่",
            queue_position: 1,
            room: "ห้องตรวจ 3",
            updated_at: "2026-08-20T10:00:00Z",
          }),
          { headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: "ไม่สามารถยกเลิกคิวนี้ได้" }),
          { status: 409, headers: { "content-type": "application/json" } }
        )
      );

    render(
      createElement(QueueStatusView, {
        token: "mock_token",
        onAccount: vi.fn(),
        onUnauthorized: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText("C002")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกคิวรับบริการ" }));
    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ (ขั้นที่ 2) →" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันยกเลิกคิวทันที" }));

    await waitFor(() => expect(screen.getByText("ไม่สามารถยกเลิกคิวนี้ได้")).toBeInTheDocument());
    expect(screen.getAllByText("C002").length).toBeGreaterThan(0);
    expect(screen.queryByText("ยกเลิกคิวรับบริการเรียบร้อยแล้ว")).toBeNull();
  });
});
