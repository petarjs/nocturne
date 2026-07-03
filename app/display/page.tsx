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
import type { Widget } from "@/lib/schema";
import type { WidgetSlot } from "@/lib/layout/types";
import { parsePresetData } from "@/lib/schema/widget";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { useDrawerOpen } from "@/lib/drawer/useDrawerOpen";
import { useFps } from "@/lib/fps";
import { useHeartbeat } from "@/lib/heartbeat";
import { useStalenessWatcher } from "@/lib/staleness";
import { useSceneStore } from "@/lib/store";
import { resolveTheme } from "@/lib/themes";

function FallbackWidget({ widget }: { widget: Widget }) {
  return (
    <div className="n-surface flex h-full w-full flex-col gap-2 p-6">
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
      return <Stat {...data} slot={slot} label={widget.title ?? data.label} />;
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
    default:
      return <FallbackWidget widget={widget} />;
  }
}

// Display route: fully client-side, static-exportable (§9.1).
export default function DisplayPage() {
  const scene = useSceneStore((s) => s.scene);
  const lastUpdated = useSceneStore((s) => s.lastUpdated);
  const theme = resolveTheme(scene.theme);
  const act = scene.narrative.acts[0];
  const motion = useMotionPrefs();
  const { open: drawerOpen } = useDrawerOpen();
  const fps = useFps(!drawerOpen);

  useHeartbeat(scene.mood, act?.hero, motion.reducedMotion);
  useStalenessWatcher(scene, lastUpdated);

  return (
    <ThemeScope theme={theme}>
      <div className="flex h-screen w-full overflow-hidden">
        <div className="relative isolate min-w-0 flex-1">
          <Background theme={theme} mood={scene.mood} tier={motion.tier} />
          <div className="relative z-10 flex h-full flex-col gap-6 p-12">
            <div className="n-label">
              {scene.name} · {scene.mood} · tier {motion.tier}
              {motion.reducedMotion ? " · reduced motion" : ""}
            </div>
            <div className="min-h-0 flex-1">
              {act && (
                <Stage
                  act={act}
                  widgets={scene.widgets}
                  dialect={theme.motion.dialect}
                  theme={theme}
                  mood={scene.mood}
                  lastUpdated={lastUpdated}
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
        </div>
        {drawerOpen && <ControlDrawer motion={motion} />}
      </div>
    </ThemeScope>
  );
}
