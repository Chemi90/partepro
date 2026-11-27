import { defineConfig, devices } from "@playwright/test";
import { baseURL, isRemote } from "./tests/support/target";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: isRemote ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      testMatch: /(?:workflow|accessibility|entry|connected)\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 90_000,
      },
});
