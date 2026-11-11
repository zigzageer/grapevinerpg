import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: "**/game.spec.ts",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
          args: ["--no-sandbox"],
        },
      },
    },
    ...(process.env.MINT_TEST_WEBKIT === "1"
      ? [
          {
            name: "iphone-webkit",
            testMatch: "**/iphone.spec.ts",
            use: {
              ...devices["iPhone 13"],
              browserName: "webkit" as const,
              launchOptions: process.env.MINT_WEBKIT_EXECUTABLE
                ? { executablePath: process.env.MINT_WEBKIT_EXECUTABLE }
                : {},
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
