import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5500",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "python mock_backend.py",
      port: 8000,
      reuseExistingServer: true,
      timeout: 15000,
      env: {
        PYTHONIOENCODING: "utf-8",
      },
    },
    {
      command: "python -m http.server 5500 --bind 127.0.0.1 -d dist",
      port: 5500,
      reuseExistingServer: true,
      timeout: 15000,
      env: {
        PYTHONIOENCODING: "utf-8",
      },
    },
  ],
});
