import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueStatusView } from "./QueueStatusView";

describe("QueueStatusView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com", STATUS_REFRESH_MS: 10000 };
    vi.stubGlobal("fetch", vi.fn());
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
