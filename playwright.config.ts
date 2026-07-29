import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      '"C:\\Users\\meton\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe" node_modules/next/dist/bin/next dev',
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 900 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],
});
