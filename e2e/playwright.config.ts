import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, MOCK_URL, PAYSTACK_SECRET, WEB_PORT, WEB_URL, e2eDatabaseUrl } from "./env";

const apiEnv = {
  NODE_ENV: "development",
  DATABASE_URL: e2eDatabaseUrl(),
  PORT: String(API_PORT),
  CORS_ORIGINS: WEB_URL,
  WEB_URL,
  PAYSTACK_SECRET_KEY: PAYSTACK_SECRET,
  PAYSTACK_BASE_URL: MOCK_URL,
  S3_BUCKET: "e2e-bucket",
  S3_ENDPOINT: MOCK_URL,
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "e2e",
  S3_SECRET_ACCESS_KEY: "e2e-secret",
  S3_PUBLIC_URL: `${MOCK_URL}/e2e-bucket`,
  RESEND_API_KEY: "",
};

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  // Tests share one database; running them in order keeps the story
  // (a vendor lists stock, then a buyer buys it) honest and failures readable.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "e2e", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"] },
  ],
  webServer: [
    { command: "npx tsx mock-services.ts", url: `${MOCK_URL}/__health`, reuseExistingServer: false, timeout: 30_000 },
    {
      command: "npx ts-node --transpile-only src/index.ts",
      cwd: "../apps/api",
      url: `${API_URL}/api/healthz`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      cwd: "../apps/web",
      url: `${WEB_URL}/login`,
      env: { API_URL, NEXT_PUBLIC_APP_URL: WEB_URL, NEXT_PUBLIC_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
void API_PORT;
