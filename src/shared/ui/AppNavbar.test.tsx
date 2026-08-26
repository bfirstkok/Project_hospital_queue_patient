import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNavbar } from "./AppNavbar";

describe("AppNavbar", () => {
  it("disables booking while the patient already has an active queue", () => {
    const onSelectView = vi.fn();
    render(createElement(AppNavbar, {
      currentView: "status",
      onSelectView,
      hasActiveQueue: true,
      queueNumber: "Q-10",
      hasToken: true,
    }));

    const bookingButton = screen.getByRole("button", { name: "มีคิวแล้ว" });
    expect((bookingButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(bookingButton);
    expect(onSelectView).not.toHaveBeenCalledWith("registration");
  });

  it("allows booking when no active queue exists", () => {
    const onSelectView = vi.fn();
    render(createElement(AppNavbar, {
      currentView: "status",
      onSelectView,
      hasActiveQueue: false,
      hasToken: true,
    }));

    fireEvent.click(screen.getByRole("button", { name: "จองคิว" }));
    expect(onSelectView).toHaveBeenCalledWith("registration");
  });
});
