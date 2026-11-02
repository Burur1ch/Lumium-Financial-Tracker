import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 150_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    ...devices["Pixel 7"],
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm.cmd run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: "lumium-local-e2e-secret-at-least-32-characters",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    },
  },
});
