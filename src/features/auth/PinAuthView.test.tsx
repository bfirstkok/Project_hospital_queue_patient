import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinAuthView } from "./PinAuthView";
import { savePin } from "@/shared/auth/pin-storage";

describe("PinAuthView", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("unlocks when correct 6-digit PIN is entered", () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["1", "2", "3", "4", "5", "6"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows error alert on incorrect PIN", () => {
    savePin("123456");
    const onSuccess = vi.fn();
    render(createElement(PinAuthView, { mode: "unlock", onSuccess }));

    ["9", "9", "9", "9", "9", "9"].forEach((num) => {
      fireEvent.click(screen.getByRole("button", { name: num }));
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("รหัส PIN ไม่ถูกต้อง");
  });
});
