"use client";

import { ThemeScope } from "@/components/display/ThemeScope";
import { TestControlDrawer } from "@/components/drawer/TestControlDrawer";
import { SettingsDrawer } from "@/components/drawer/SettingsDrawer";
import { Background } from "@/components/background/Background";
import { Stage } from "@/components/layout/Stage";
import { Clock } from "@/components/widgets/Clock";
import { Stat } from "@/components/widgets/Stat";
import { Gauge } from "@/components/widgets/Gauge";
import { Timeseries } from "@/components/widgets/Timeseries";
import { StatusGrid } from "@/components/widgets/StatusGrid";
import { List } from "@/components/widgets/List";
import { Headline } from "@/components/widgets/Headline";
import { BarChart } from "@/components/widgets/BarChart";
import { Donut } from "@/components/widgets/Donut";
import { Table } from "@/components/widgets/Table";
import { Ticker } from "@/components/widgets/Ticker";
import { Agenda } from "@/components/widgets/Agenda";
import { Text } from "@/components/widgets/Text";
import { NowPlaying } from "@/components/widgets/NowPlaying";
import { Weather } from "@/components/widgets/Weather";
import { ImageWidget } from "@/components/widgets/Image";
import { VideoWidget } from "@/components/widgets/Video";
import { Composite } from "@/components/widgets/Composite";
import { ActIndicator } from "@/components/display/ActIndicator";
import { ActDots } from "@/components/display/ActDots";
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
import { useRemoteSync, type RemoteSync } from "@/lib/remote/useRemoteSync";
import { ViewCodeGate } from "@/components/display/ViewCodeGate";
import { resolveTheme } from "@nocturne/core/themes";
import { Component, type ReactNode } from "react";

function WidgetMessage({ widget, message }: { widget: Widget; message: string }) {
  return (
    <div className="n-surface flex h-full w-full flex-col justify-center gap-2 p-[var(--n-density-pad)]">
      <div className="n-label">{widget.title ?? widget.type}</div>
      <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
        {message}
      </div>
    </div>
  );
}

class WidgetErrorBoundary extends Component<
  { widget: Widget; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { widget: Widget }) {
    if (this.state.failed && previous.widget.data !== this.props.widget.data) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? (
      <WidgetMessage widget={this.props.widget} message="Invalid widget data" />
    ) : (
      this.props.children
    );
  }
}

function WidgetContent({ widget, slot }: { widget: Widget; slot: WidgetSlot }) {
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
    case "barChart": {
      const data = parsePresetData("barChart", widget.data);
      return <BarChart {...data} slot={slot} label={widget.title ?? data.label} />;
    }
    case "donut": {
      const data = parsePresetData("donut", widget.data);
      return <Donut {...data} slot={slot} label={widget.title ?? data.label} />;
    }
    case "table": {
      const data = parsePresetData("table", widget.data);
      return <Table {...data} slot={slot} label={widget.title} />;
    }
    case "ticker": {
      const data = parsePresetData("ticker", widget.data);
      return <Ticker {...data} slot={slot} label={widget.title} />;
    }
    case "agenda": {
      const data = parsePresetData("agenda", widget.data);
      return <Agenda {...data} slot={slot} label={widget.title} />;
    }
    case "text": {
      const data = parsePresetData("text", widget.data);
      return <Text slot={slot} md={data.md} />;
    }
    case "nowPlaying": {
      const data = parsePresetData("nowPlaying", widget.data);
      return <NowPlaying {...data} slot={slot} label={widget.title} />;
    }
    case "weather": {
      const data = parsePresetData("weather", widget.data);
      return <Weather {...data} slot={slot} label={widget.title} />;
    }
    case "image": {
      const data = parsePresetData("image", widget.data);
      return <ImageWidget {...data} slot={slot} label={widget.title} />;
    }
    case "video": {
      const data = parsePresetData("video", widget.data);
      return <VideoWidget {...data} slot={slot} label={widget.title} />;
    }
    case "composite":
      return <Composite widget={widget} slot={slot} />;
    default:
      return <WidgetMessage widget={widget} message="Unsupported widget" />;
  }
}

function renderWidget(widget: Widget, slot: WidgetSlot) {
  return (
    <WidgetErrorBoundary widget={widget}>
      <WidgetContent widget={widget} slot={slot} />
    </WidgetErrorBoundary>
  );
}

function DisplayContent({ remote, isDev }: { remote: RemoteSync; isDev: boolean }) {
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
                {fps} fps
                {remote.active ? (remote.connected ? " · live" : " · reconnecting") : ""}
                {remote.writeFailed && (
                  <span style={{ color: "var(--n-negative)" }}> · write failed</span>
                )}{" "}
                · ` control
              </div>
            )}
            {remote.needsCode && <ViewCodeGate onSubmit={remote.submitCode} />}
            {remote.gone && (
              <div className="absolute inset-0 z-50 flex items-center justify-center">
                <div className="n-label">this dashboard no longer exists</div>
              </div>
            )}
            {indicatorVisible && scene.narrative.rotation.indicator === "dots" && (
              <ActDots count={actCount} index={actIndex} progress={dwellProgress} pulse={indicatorPulse} />
            )}
            {indicatorVisible && scene.narrative.rotation.indicator === "hairline" && (
              <ActIndicator progress={dwellProgress} pulse={indicatorPulse} />
            )}
          </div>
          {drawerOpen &&
            (isDev ? <TestControlDrawer motion={motion} /> : <SettingsDrawer motion={motion} />)}
        </div>
      </MotionDialectProvider>
    </ThemeScope>
  );
}

/**
 * Shared display renderer for both routes:
 *  - `/display` (dev + golden frames): `slug={null}`, local fixture mode,
 *    `?scene=`/`?theme=`/`?mood=` bootstrap the store (§10 criterion 7).
 *  - `/d/<slug>` (production): `slug` from the path, always a live view of
 *    that dashboard — the server owns the scene, no fixture bootstrap.
 */
export function DisplayView({ slug }: { slug: string | null }) {
  useUrlSceneBootstrap(slug === null);
  const remote = useRemoteSync(slug);
  const scene = useSceneStore((s) => s.scene);
  const theme = resolveTheme(scene.theme);
  const motion = useMotionPrefs();

  return (
    <ThemeMorphProvider targetTheme={theme} reducedMotion={motion.reducedMotion}>
      <DisplayContent remote={remote} isDev={slug === null} />
    </ThemeMorphProvider>
  );
}
