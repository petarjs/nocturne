"use client";

import { ThemeScope } from "@/components/display/ThemeScope";
import { ControlDrawer } from "@/components/drawer/ControlDrawer";
import { Background } from "@/components/background/Background";
import { Stage } from "@/components/layout/Stage";
import { Clock } from "@/components/widgets/Clock";
import { Stat } from "@/components/widgets/Stat";
import { Gauge } from "@/components/widgets/Gauge";
import { Timeseries } from "@/components/widgets/Timeseries";
import { StatusGrid } from "@/components/widgets/StatusGrid";
import { List } from "@/components/widgets/List";
import { Headline } from "@/components/widgets/Headline";
import { ActIndicator } from "@/components/display/ActIndicator";
import type { Widget } from "@nocturne/core";
import type { WidgetSlot } from "@/lib/layout/types";
import { parsePresetData } from "@nocturne/core";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { MotionDialectProvider } from "@/lib/motion-context";
import { useActRotation } from "@/components/hooks/useActRotation";
import { ThemeMorphProvider, useThemeMorph } from "@/lib/theme/morph-context";
import { resolveActs } from "@/lib/layout/resolveActs";
import { useDrawerOpen } from "@/lib/drawer/useDrawerOpen";
import { useFps } from "@/lib/fps";
import { useHeartbeat } from "@/lib/heartbeat";
import { useStalenessWatcher } from "@/lib/staleness";
import { useSceneStore } from "@/lib/store";
import { useUrlSceneBootstrap } from "@/lib/display/urlBootstrap";
import { useDevOpsSync } from "@/lib/display/devOpsSync";
import { resolveTheme } from "@nocturne/core/themes";

function FallbackWidget({ widget }: { widget: Widget }) {
  return (
    <div className="n-surface flex h-full w-full flex-col gap-2">
      <div className="n-label">{widget.title ?? widget.type}</div>
      <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
        preset not wired yet
      </div>
    </div>
  );
}

function renderWidget(widget: Widget, slot: WidgetSlot) {
  switch (widget.type) {
    case "clock":
      return <Clock slot={slot} />;
    case "stat": {
      const data = parsePresetData("stat", widget.data);
      return (
        <Stat
          {...data}
          slot={slot}
          label={widget.title ?? data.label}
          widgetId={widget.id}
        />
      );
    }
    case "gauge": {
      const data = parsePresetData("gauge", widget.data);
      return <Gauge {...data} slot={slot} label={widget.title ?? data.label} />;
    }
    case "timeseries": {
      const data = parsePresetData("timeseries", widget.data);
      return <Timeseries {...data} slot={slot} label={widget.title ?? data.label} />;
    }
    case "statusGrid": {
      const data = parsePresetData("statusGrid", widget.data);
      return (
        <StatusGrid
          label={widget.title}
          items={data.items}
          slot={slot}
          critical={widget.state === "critical"}
        />
      );
    }
    case "list": {
      const data = parsePresetData("list", widget.data);
      return <List label={widget.title} items={data.items} slot={slot} />;
    }
    case "headline": {
      const data = parsePresetData("headline", widget.data);
      return <Headline slot={slot} text={data.text} kicker={data.kicker} tone={data.tone} />;
    }
    default:
      return <FallbackWidget widget={widget} />;
  }
}

function DisplayContent() {
  const scene = useSceneStore((s) => s.scene);
  const lastUpdated = useSceneStore((s) => s.lastUpdated);
  const motion = useMotionPrefs();
  const { theme: morphedTheme, morphActive, exitT, enterT, fromTheme, toTheme, bgT } =
    useThemeMorph();
  const acts = resolveActs(scene.narrative, scene.widgets);
  const { open: drawerOpen } = useDrawerOpen();
  const fps = useFps(!drawerOpen);

  const {
    currentAct: act,
    actIndex,
    actCount,
    dwellProgress,
    indicatorVisible,
    indicatorPulse,
    rotationEnabled,
  } = useActRotation({
    acts,
    rotation: scene.narrative.rotation,
    mood: scene.mood,
    widgets: scene.widgets,
    reducedMotion: motion.reducedMotion,
  });

  useHeartbeat(
    scene.mood,
    act?.hero,
    morphedTheme.motion.dialect,
    morphedTheme.background.engine,
    motion.reducedMotion
  );
  useStalenessWatcher(scene, lastUpdated);

  return (
    <ThemeScope theme={morphedTheme} tier={motion.tier}>
      <MotionDialectProvider dialect={morphedTheme.motion.dialect}>
        <div className="flex h-screen w-full overflow-hidden">
          <div className="relative isolate min-w-0 flex-1">
            <Background
              theme={morphedTheme}
              mood={scene.mood}
              tier={motion.tier}
              morphActive={morphActive}
              morphFrom={fromTheme}
              morphTo={toTheme}
              bgT={bgT}
            />
            <div className="relative z-10 flex h-full flex-col gap-6 p-12">
              <div className="n-label">
                {scene.name} · {scene.mood} · tier {motion.tier}
                {rotationEnabled ? ` · act ${actIndex + 1}/${actCount}` : ""}
                {motion.reducedMotion ? " · reduced motion" : ""}
              </div>
              <div className="min-h-0 flex-1">
                {act && (
                  <Stage
                    act={act}
                    widgets={scene.widgets}
                    anchors={scene.narrative.anchors ?? []}
                    dialect={morphedTheme.motion.dialect}
                    theme={morphedTheme}
                    mood={scene.mood}
                    lastUpdated={lastUpdated}
                    morphActive={morphActive}
                    morphExitT={exitT}
                    morphEnterT={enterT}
                    renderWidget={renderWidget}
                  />
                )}
              </div>
            </div>
            {!drawerOpen && (
              <div className="n-label pointer-events-none absolute bottom-4 right-4 opacity-40">
                {fps} fps · ` control
              </div>
            )}
            {indicatorVisible && <ActIndicator progress={dwellProgress} pulse={indicatorPulse} />}
          </div>
          {drawerOpen && <ControlDrawer motion={motion} />}
        </div>
      </MotionDialectProvider>
    </ThemeScope>
  );
}

// Display route: fully client-side, static-exportable (§9.1).
export default function DisplayPage() {
  useUrlSceneBootstrap();
  useDevOpsSync();
  const scene = useSceneStore((s) => s.scene);
  const theme = resolveTheme(scene.theme);
  const motion = useMotionPrefs();

  return (
    <ThemeMorphProvider targetTheme={theme} reducedMotion={motion.reducedMotion}>
      <DisplayContent />
    </ThemeMorphProvider>
  );
}
