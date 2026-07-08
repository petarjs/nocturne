"use client";

import type { Mood } from "@nocturne/core";
import { useSceneStore } from "@/lib/store";
import { themePresets } from "@nocturne/core/themes";
import { momentBus } from "@/lib/moments/bus";
import { resolveActs } from "@/lib/layout/resolveActs";
import { useFps } from "@/lib/fps";
import { Section, Btn } from "@/components/drawer/DrawerUI";
import type { MotionPrefs } from "@/lib/motion-prefs";

const MOODS: Mood[] = ["ambient", "focus", "alert", "sleep"];

/**
 * The live dashboard's settings drawer (`/d/<slug>`) — real, ship-with-the-
 * product controls only: theme, mood, rotation, and perf/accessibility.
 * Everything fixture- or debug-shaped (scene presets, chaos mode, moment
 * triggers, widget add/remove, act-jumping) lives in `TestControlDrawer`,
 * which is `/display`-only (§10's drawer is a test harness, not a product
 * surface).
 */
export function SettingsDrawer({ motion }: { motion: MotionPrefs }) {
  const scene = useSceneStore((s) => s.scene);
  const applyOp = useSceneStore((s) => s.applyOp);
  const applyOps = useSceneStore((s) => s.applyOps);
  const resolvedActCount = resolveActs(scene.narrative, scene.widgets).length;

  const fps = useFps(true);

  function setMood(mood: Mood) {
    if (mood !== "alert") {
      momentBus.clearAlert();
      const resets = scene.widgets
        .filter((w) => w.state !== "normal")
        .map((w) => ({ type: "updateWidget" as const, id: w.id, patch: { state: "normal" as const } }));
      if (resets.length) applyOps(resets);
    }
    applyOp({ type: "setMood", mood });
  }

  return (
    <aside className="flex h-full w-[min(100vw,380px)] flex-col border-l border-white/8 bg-[rgb(8_12_22/0.92)] backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div>
          <div className="n-label">Settings</div>
          <div className="text-xs text-[var(--n-text2)]">` to close</div>
        </div>
        <div className="n-data text-sm tabular-nums text-[var(--n-accent1)]">{fps} fps</div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Section title="Theme">
          <div className="flex flex-wrap gap-1">
            {Object.entries(themePresets).map(([id, theme]) => (
              <Btn
                key={id}
                active={"palette" in scene.theme && scene.theme.id === theme.id}
                onClick={() => applyOp({ type: "setTheme", theme })}
              >
                {id}
              </Btn>
            ))}
          </div>
        </Section>

        <Section title="Mood">
          <div className="flex flex-wrap gap-1">
            {MOODS.map((m) => (
              <Btn key={m} active={scene.mood === m} onClick={() => setMood(m)}>
                {m}
              </Btn>
            ))}
          </div>
        </Section>

        {resolvedActCount > 1 && (
          <Section title="Rotation">
            <div className="flex flex-wrap gap-1">
              {(["off", "auto", "story"] as const).map((mode) => (
                <Btn
                  key={mode}
                  active={scene.narrative.rotation.mode === mode}
                  onClick={() =>
                    applyOp({
                      type: "setRotation",
                      rotation: {
                        ...scene.narrative.rotation,
                        mode,
                        indicator: mode === "off" ? "none" : "hairline",
                      },
                    })
                  }
                >
                  {mode}
                </Btn>
              ))}
            </div>
            <div className="text-xs text-[var(--n-text2)]">
              {resolvedActCount} act{resolvedActCount === 1 ? "" : "s"}
              {scene.narrative.rotation.mode !== "off" ? ` · ${scene.narrative.rotation.dwellSec}s dwell` : ""}
            </div>
          </Section>
        )}

        <Section title="Perf">
          <div className="flex flex-wrap gap-1">
            {([1, 2, 3] as const).map((t) => (
              <Btn key={t} active={motion.tier === t} onClick={() => motion.setTier(t)}>
                tier {t}
              </Btn>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--n-text2)]">
            <input
              type="checkbox"
              checked={motion.simulateReduced}
              onChange={(e) => motion.setSimulateReduced(e.target.checked)}
            />
            simulate prefers-reduced-motion
          </label>
          <p className="text-[11px] text-[var(--n-text2)]/70">
            Tier 3 = aurora shader. Tier 1–2 = flat fallback (§4.7).
          </p>
        </Section>
      </div>
    </aside>
  );
}
