import { defineConfig } from "@playwright/test";

/**
 * Headless screenshot/e2e runner. Token-cheap by design: it drives the app in a local
 * Chromium and writes PNGs to disk — only the pass/fail summary comes back to a watching
 * agent, never the intermediate pages. `webServer` starts its own Vite on a dedicated port
 * (so it never clashes with a dev server on 5173) and tears it down after.
 *
 * One-time setup: `pnpm --filter @kuiz/web exec playwright install chromium`.
 * Run: `pnpm --filter @kuiz/web shots` → screenshots land in apps/web/screenshots/.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts", // not *.spec/*.test, so vitest never picks these up
  outputDir: "./screenshots/.artifacts",
  use: {
    baseURL: "http://localhost:5199",
    headless: true,
    viewport: { width: 900, height: 720 },
  },
  webServer: {
    command: "pnpm exec vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
