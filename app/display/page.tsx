"use client";

import { useEffect } from "react";
import { useSceneStore } from "@/lib/store";
import { resolveTheme } from "@/lib/themes";
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
import { useEffectTier } from "@/lib/tiers";
import { useHeartbeat } from "@/lib/heartbeat";
import { useStalenessWatcher } from "@/lib/staleness";

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
      return <Stat {...data} label={widget.title ?? data.label} />;
    }
    case "gauge": {
      const data = parsePresetData("gauge", widget.data);
      return <Gauge {...data} label={widget.title ?? data.label} />;
    }
    case "timeseries": {
      const data = parsePresetData("timeseries", widget.data);
      return <Timeseries {...data} label={widget.title ?? data.label} />;
    }
    case "statusGrid": {
      const data = parsePresetData("statusGrid", widget.data);
      return <StatusGrid label={widget.title} items={data.items} slot={slot} />;
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
  const { tier, reducedMotion } = useEffectTier();

  useHeartbeat(scene.mood, act.hero, reducedMotion);
  useStalenessWatcher(scene, lastUpdated);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // dev-only escape hatch until the control drawer (§10) exists —
      // lets us drive narrative/op changes and moments from the console.
      (window as unknown as { __nocturne: typeof useSceneStore }).__nocturne = useSceneStore;
    }
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Background theme={theme} mood={scene.mood} tier={tier} />
      <div className="relative z-10 flex h-full flex-col gap-6 p-12">
        <div className="n-label">
          {scene.name} · {scene.mood} · tier {tier}
          {reducedMotion ? " · reduced motion" : ""}
        </div>
        <div className="min-h-0 flex-1">
          <Stage
            act={act}
            widgets={scene.widgets}
            dialect={theme.motion.dialect}
            theme={theme}
            mood={scene.mood}
            lastUpdated={lastUpdated}
            renderWidget={renderWidget}
          />
        </div>
      </div>
    </div>
  );
}
