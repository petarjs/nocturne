import { defineConfig, devices } from "@playwright/test";

/**
 * Golden-frame harness (§10 criterion 7 / §12 "taste drift"): captures each
 * theme × mood on /display against committed reference frames so a palette or
 * layout regression fails CI instead of shipping.
 *
 * Determinism is enforced test-side (see tests/golden/display.spec.ts):
 *   - Playwright's clock API freezes Date / performance.now / rAF, so shader
 *     time, idle drift, and heartbeat can't advance between runs.
 *   - `?still=1` on /display OR's into reducedMotion (§4.7), quieting idle and
 *     heartbeat and collapsing transitions to short fades that settle fast.
 *
 * Server: reuses the dev server the user always keeps running (§project rule
 * "never start the dev server"). reuseExistingServer avoids spawning a second
 * one; if nothing is listening the run fails fast rather than booting Next.
 */
const PORT = Number(process.env.NOCTURNE_PORT ?? 3000);
const BASE_URL = process.env.NOCTURNE_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/golden",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  // 1080p design resolution (§3.3) — goldens are captured at the resolution
  // the numbers in the design system are specified against.
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  },
  // Loose enough to tolerate sub-pixel AA noise, tight enough to catch a
  // palette/layout regression. Tune after reviewing the first capture set.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
