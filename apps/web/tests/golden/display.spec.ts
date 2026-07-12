import { test, expect, type Page } from "@playwright/test";

/**
 * Golden frames (§10 criterion 7): every scene, any theme, frozen at any
 * moment with fixture data, must look like a film still. This captures the
 * three launch themes × the three moods that define the demo beats:
 *
 *   ambient — the idle dashboard breathing (beat 1)
 *   alert   — a critical widget promoted, edge vignette bleeding in (beat 5)
 *   sleep   — the clock alone over a starfield (beat 6)
 *
 * Ambient uses the clean `minimal` scene (the homelab fixture has a `down`
 * service, so it auto-enters alert); alert uses `homelab` for that reason;
 * sleep uses the `sleep` scene.
 *
 * First run: `pnpm test:golden:update` writes the reference set — reviewing it
 * is the Chanel pass (§12). After that, `pnpm test:golden` fails on drift.
 */

const THEMES = ["observatory", "kanso", "noir"] as const;

// These are GPU-backed visual captures. Running six WebGL pages at once can
// starve one page's hydration/FLIP frame and produce a stable screenshot of
// the wrong animation instant (Kanso ambient was the repeat offender).
test.describe.configure({ mode: "serial" });

type Frame = { mood: string; params: string };

// A fixed instant so the clock, staleness math, and the Kanso growth
// lifecycle (day-bloom at 14:00) render identically every run.
const FIXED_TIME = new Date("2026-07-03T14:00:00");

// Advance far enough past the longest settle (still-mode fades ~200ms; give
// generous headroom for enter springs and draw-on) then the clock pauses, so
// shader time / idle drift / rAF are frozen for the capture.
const SETTLE = new Date(FIXED_TIME.getTime() + 6_000);

const FRAMES: Frame[] = [
  { mood: "ambient", params: "scene=minimal&mood=ambient" },
  { mood: "alert", params: "scene=homelab" },
  { mood: "sleep", params: "scene=sleep&mood=sleep" },
];

async function captureFrozen(page: Page, url: string) {
  // Install before navigation so the app's first Date.now()/rAF are mocked.
  await page.clock.install({ time: FIXED_TIME });
  await page.goto(url, { waitUntil: "load" });
  // Fast-forward through arrival choreography, firing timers/rAF, then pause —
  // leaves the scene settled and every animation clock stopped.
  await page.clock.pauseAt(SETTLE);
}

for (const theme of THEMES) {
  for (const frame of FRAMES) {
    test(`${theme} · ${frame.mood}`, async ({ page }) => {
      await captureFrozen(page, `/display?theme=${theme}&${frame.params}&still=1`);
      await expect(page).toHaveScreenshot(`${theme}-${frame.mood}.png`, {
        fullPage: false,
      });
    });
  }
}
