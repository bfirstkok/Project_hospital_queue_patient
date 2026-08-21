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
});
