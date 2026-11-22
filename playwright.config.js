import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./client/test",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5051",
    trace: "retain-on-failure",
    ...(process.env.REVIEWFLOW_BROWSER_PATH
      ? { launchOptions: { executablePath: process.env.REVIEWFLOW_BROWSER_PATH } }
      : {}),
  },
  webServer: {
    command: "node server/test/start-browser-api.js",
    url: "http://127.0.0.1:5051/api/health",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
