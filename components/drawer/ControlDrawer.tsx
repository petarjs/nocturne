"use client";

import { useMemo, useState } from "react";
import type { Mood, PresetType, Widget } from "@/lib/schema";
import { parsePresetData } from "@/lib/schema/widget";
import { useSceneStore } from "@/lib/store";
import { scenePresets } from "@/fixtures/scenes";
import { fixtureFor } from "@/fixtures";
import { themePresets } from "@/lib/themes";
import { vibePresets } from "@/lib/vibe-presets";
import { momentBus } from "@/lib/moments/bus";
import { isMetricWidget } from "@/lib/moments/evaluate";
import { setWidgetRole, widgetRole, type WidgetRole } from "@/lib/drawer/narrative";
import { resolveActs } from "@/lib/layout/resolveActs";
import { useChaosEngine } from "@/lib/drawer/useChaos";
import { useFps } from "@/lib/fps";
import type { MotionPrefs } from "@/lib/motion-prefs";

const MOODS: Mood[] = ["ambient", "focus", "alert", "sleep"];
const ADDABLE: PresetType[] = ["stat", "gauge", "timeseries", "statusGrid", "list", "clock", "headline"];
const MOMENT_TIERS = ["t1", "t2", "t3"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-white/6 pb-4">
      <h3 className="n-label">{title}</h3>
      {children}
    </section>
  );
}

function Btn({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${active ? "border-[var(--n-accent1)] bg-[var(--n-accent1)]/15 text-[var(--n-text1)]" : "border-white/10 text-[var(--n-text2)] hover:border-white/20 hover:text-[var(--n-text1)]"} ${className}`}
    >
      {children}
    </button>
  );
}

function clearMomentState(applyOps: ReturnType<typeof useSceneStore.getState>["applyOps"], widgets: Widget[]) {
  momentBus.clearAlert();
  const resets = widgets
    .filter((w) => w.state !== "normal")
    .map((w) => ({ type: "updateWidget" as const, id: w.id, patch: { state: "normal" as const } }));
  if (resets.length) applyOps(resets);
}

export function ControlDrawer({ motion }: { motion: MotionPrefs }) {
  const scene = useSceneStore((s) => s.scene);
  const applyOp = useSceneStore((s) => s.applyOp);
  const applyOps = useSceneStore((s) => s.applyOps);
  const act = scene.narrative.acts[0];
  const resolvedActCount = resolveActs(scene.narrative, scene.widgets).length;

  const [selectedId, setSelectedId] = useState<string | null>(scene.widgets[0]?.id ?? null);
  const [chaos, setChaos] = useState(false);
  const [walkIds, setWalkIds] = useState<string[]>([]);
  const [addType, setAddType] = useState<PresetType>("stat");
  const [valueInput, setValueInput] = useState("");
  const [vibeText, setVibeText] = useState("");

  const fps = useFps(true);
  const selected = scene.widgets.find((w) => w.id === selectedId) ?? null;

  useChaosEngine(chaos, walkIds, scene.widgets, applyOp);

  const metricIds = useMemo(
    () => scene.widgets.filter((w) => isMetricWidget(w.type)).map((w) => w.id),
    [scene.widgets]
  );

  function setMood(mood: Mood) {
    if (mood !== "alert") clearMomentState(applyOps, scene.widgets);
    applyOp({ type: "setMood", mood });
  }

  function spikeWidget(widget: Widget) {
    if (widget.type === "stat") {
      const data = parsePresetData("stat", widget.data);
      applyOp({ type: "pushData", id: widget.id, data: { value: Math.min(100, data.value + 35) } });
    } else if (widget.type === "gauge") {
      const data = parsePresetData("gauge", widget.data);
      applyOp({ type: "pushData", id: widget.id, data: { value: data.crit ?? data.max } });
    } else if (widget.type === "timeseries") {
      const data = parsePresetData("timeseries", widget.data);
      const last = data.series.at(-1);
      const v = (last?.v ?? 40) + 40;
      applyOp({
        type: "pushData",
        id: widget.id,
        data: { series: [...data.series.slice(-59), { t: (last?.t ?? Date.now()) + 60_000, v }] },
      });
    }
  }

  function pushValue(widget: Widget, raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    if (widget.type === "stat" || widget.type === "gauge") {
      applyOp({ type: "pushData", id: widget.id, data: { value: n } });
    }
  }

  function toggleWalk(id: string) {
    setWalkIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function addWidget() {
    const id = `${addType}-${Date.now().toString(36).slice(-4)}`;
    const widget: Widget = {
      id,
      type: addType,
      title: addType,
      data: fixtureFor(addType),
      state: "normal",
    };
    applyOp({ type: "addWidget", widget });
    if (act) {
      const nextAct = setWidgetRole(act, id, "ambient");
      applyOp({ type: "setActs", acts: [nextAct, ...scene.narrative.acts.slice(1)] });
    }
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selected) return;
    applyOp({ type: "removeWidget", id: selected.id });
    setSelectedId(scene.widgets.find((w) => w.id !== selected.id)?.id ?? null);
  }

  function applyVibeFromText() {
    const match = vibePresets.find(
      (v) =>
        vibeText.toLowerCase().includes(v.label.toLowerCase()) ||
        vibeText.toLowerCase().includes(v.id.replace("-", " "))
    );
    applyOp({ type: "setTheme", theme: match?.theme ?? vibePresets[0].theme });
  }

  return (
    <aside className="flex h-full w-[min(100vw,380px)] flex-col border-l border-white/8 bg-[rgb(8_12_22/0.92)] backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div>
          <div className="n-label">Control</div>
          <div className="text-xs text-[var(--n-text2)]">` to close</div>
        </div>
        <div className="n-data text-sm tabular-nums text-[var(--n-accent1)]">{fps} fps</div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Section title="Scene">
          <div className="flex flex-wrap gap-1">
            {Object.keys(scenePresets).map((name) => (
              <Btn
                key={name}
                active={scene.name.toLowerCase() === name}
                onClick={() => applyOp({ type: "loadScene", name })}
              >
                {name}
              </Btn>
            ))}
          </div>
        </Section>

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

        <Section title="Vibe (stub)">
          <input
            value={vibeText}
            onChange={(e) => setVibeText(e.target.value)}
            placeholder="rainy tokyo night…"
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-[var(--n-text1)] outline-none focus:border-[var(--n-accent1)]/50"
          />
          <div className="flex flex-wrap gap-1">
            {vibePresets.map((v) => (
              <Btn
                key={v.id}
                onClick={() => {
                  setVibeText(v.label);
                  applyOp({ type: "setTheme", theme: v.theme });
                }}
              >
                {v.label}
              </Btn>
            ))}
          </div>
          <Btn onClick={applyVibeFromText}>Apply vibe</Btn>
        </Section>

        {act && (
          <Section title="Narrative">
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
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
              {scene.widgets.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-xs">
                  <span className="w-20 truncate text-[var(--n-text2)]">{w.id}</span>
                  <select
                    value={widgetRole(act, w.id)}
                    onChange={(e) => {
                      const nextAct = setWidgetRole(act, w.id, e.target.value as WidgetRole);
                      applyOp({ type: "setActs", acts: [nextAct, ...scene.narrative.acts.slice(1)] });
                    }}
                    className="flex-1 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[var(--n-text1)]"
                  >
                    <option value="hero">hero</option>
                    <option value="supporting">supporting</option>
                    <option value="ambient">ambient</option>
                    <option value="off">off</option>
                  </select>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Widgets">
          <div className="flex flex-wrap gap-1">
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as PresetType)}
              className="rounded border border-white/10 bg-black/30 px-1 py-1 text-xs text-[var(--n-text1)]"
            >
              {ADDABLE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Btn onClick={addWidget}>add</Btn>
            <Btn onClick={removeSelected} className="!border-[var(--n-negative)]/40">
              remove
            </Btn>
          </div>
          <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto">
            {scene.widgets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setSelectedId(w.id);
                  if (w.type === "stat" || w.type === "gauge") {
                    const data = parsePresetData(w.type, w.data) as { value: number };
                    setValueInput(String(data.value));
                  }
                }}
                className={`rounded px-2 py-1 text-left text-xs ${selectedId === w.id ? "bg-white/10 text-[var(--n-text1)]" : "text-[var(--n-text2)] hover:bg-white/5"}`}
              >
                {w.id} · {w.type}
                {w.state !== "normal" ? ` · ${w.state}` : ""}
              </button>
            ))}
          </div>
        </Section>

        {selected && (
          <Section title={`Widget · ${selected.id}`}>
            {isMetricWidget(selected.type) && (
              <div className="flex flex-wrap items-center gap-1">
                <input
                  type="number"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-[var(--n-text1)]"
                />
                <Btn onClick={() => pushValue(selected, valueInput)}>set value</Btn>
                <Btn onClick={() => toggleWalk(selected.id)}>
                  {walkIds.includes(selected.id) ? "walk off" : "walk on"}
                </Btn>
                <Btn onClick={() => spikeWidget(selected)}>spike</Btn>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {MOMENT_TIERS.map((tier) => (
                <Btn
                  key={tier}
                  onClick={() => applyOp({ type: "triggerMoment", id: selected.id, tier })}
                >
                  {tier}
                </Btn>
              ))}
              <Btn
                onClick={() => {
                  clearMomentState(applyOps, scene.widgets);
                  applyOp({ type: "setMood", mood: "ambient" });
                }}
              >
                clear
              </Btn>
            </div>
          </Section>
        )}

        <Section title="Chaos">
          <label className="flex items-center gap-2 text-xs text-[var(--n-text2)]">
            <input type="checkbox" checked={chaos} onChange={(e) => setChaos(e.target.checked)} />
            chaos mode — random-walk all metrics ({metricIds.length} widgets)
          </label>
          <p className="text-[11px] leading-relaxed text-[var(--n-text2)]/70">
            Walks every ~900ms with occasional spikes. Moments fire when thresholds cross.
          </p>
        </Section>

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
