import { afterEach, describe, expect, it } from "vitest";
import { getRuntimeConfig } from "./runtime-config";

describe("getRuntimeConfig", () => {
  afterEach(() => {
    delete window.PATIENT_APP_ENV;
  });

  it("uses the configured API URL when runtime config is available", () => {
    window.PATIENT_APP_ENV = { API_BASE_URL: "https://hospital.example.com/" };

    expect(getRuntimeConfig().apiBaseUrl).toBe("https://hospital.example.com");
  });

  it("falls back to the current origin when runtime config is unavailable", () => {
    expect(getRuntimeConfig().apiBaseUrl).toBe(window.location.origin);
  });

  it.each([-1, -10000, 0, 0.5, Infinity, NaN, 2147483648, "Infinity", "invalid"])("uses a safe polling delay for invalid value %s", (value) => {
    window.PATIENT_APP_ENV = { STATUS_REFRESH_MS: value };
    expect(getRuntimeConfig().statusRefreshMs).toBe(10000);
  });

  it.each([1000, "15000", 2147483647])("preserves a valid configured polling delay %s", (value) => {
    window.PATIENT_APP_ENV = { STATUS_REFRESH_MS: value };
    expect(getRuntimeConfig().statusRefreshMs).toBe(Number(value));
  });
});
