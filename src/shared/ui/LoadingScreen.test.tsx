import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./LoadingScreen";

describe("LoadingScreen", () => {
  it("renders custom title and subtitle correctly", () => {
    render(
      createElement(LoadingScreen, {
        title: "กำลังโหลดข้อมูลคิว...",
        subtitle: "กรุณารอสักครู่",
      })
    );

    expect(screen.getByText("กำลังโหลดข้อมูลคิว...")).toBeInTheDocument();
    expect(screen.getByText("กรุณารอสักครู่")).toBeInTheDocument();
  });

  it("renders fullScreen container class when fullScreen prop is true", () => {
    const { container } = render(createElement(LoadingScreen, { fullScreen: true }));
    expect(container.querySelector(".app-loading-container.full-screen")).not.toBeNull();
  });
});
