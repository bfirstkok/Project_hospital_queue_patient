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
});
