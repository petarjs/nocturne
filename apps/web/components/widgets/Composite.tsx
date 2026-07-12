import { presetDataSchemas, type Widget } from "@nocturne/core";
import { HeroValue } from "@/lib/archetypes/heroValue";
import { ChartCard } from "@/lib/archetypes/chartCard";
import { Matrix } from "@/lib/archetypes/matrix";
import { TableCard } from "@/lib/archetypes/tableCard";
import { StreamCard } from "@/lib/archetypes/streamCard";
import { TextCard } from "@/lib/archetypes/textCard";
import { MediaCard } from "@/lib/archetypes/mediaCard";
import { NowPlayingCard } from "@/lib/archetypes/nowPlayingCard";
import { WeatherCard } from "@/lib/archetypes/weatherCard";
import { EmptyState } from "@/components/primitives/EmptyState";
import { Label } from "@/components/primitives/Label";
import type { WidgetSlot } from "@/lib/layout/types";
import { surfacePadForSlot } from "@/lib/archetypes/types";

type CompositeWidget = Extract<Widget, { type: "composite" }>;

function stringSlot(widget: CompositeWidget, name: string): string | undefined {
  const value = widget.slots[name];
  return typeof value === "string" ? value : undefined;
}

function InvalidComposite({ slot, title }: { slot: WidgetSlot; title?: string }) {
  return (
    <div className={`n-surface flex h-full w-full flex-col gap-3 ${surfacePadForSlot[slot]}`}>
      {title && <Label>{title}</Label>}
      <EmptyState message="Invalid composition" />
    </div>
  );
}

/**
 * Safe composite adapter. Agents choose an archetype, while its `data` is
 * validated against the closest preset contract before reaching a primitive.
 */
export function Composite({ widget, slot }: { widget: CompositeWidget; slot: WidgetSlot }) {
  const label = widget.title ?? stringSlot(widget, "label");

  if (widget.archetype === "heroValue" || widget.archetype === "statRow") {
    const result = presetDataSchemas.stat.safeParse(widget.data);
    if (!result.success) return <InvalidComposite slot={slot} title={label} />;
    return <HeroValue {...result.data} label={label ?? result.data.label} slot={slot} widgetId={widget.id} />;
  }

  if (widget.archetype === "chartCard") {
    const result = presetDataSchemas.timeseries.safeParse(widget.data);
    if (!result.success) return <InvalidComposite slot={slot} title={label} />;
    return <ChartCard {...result.data} label={label ?? result.data.label} slot={slot} />;
  }

  if (widget.archetype === "matrix") {
    const result = presetDataSchemas.statusGrid.safeParse(widget.data);
    if (!result.success) return <InvalidComposite slot={slot} title={label} />;
    return <Matrix items={result.data.items} label={label} slot={slot} critical={widget.state === "critical"} />;
  }

  if (widget.archetype === "tableCard") {
    const result = presetDataSchemas.table.safeParse(widget.data);
    if (!result.success) return <InvalidComposite slot={slot} title={label} />;
    return <TableCard {...result.data} label={label} slot={slot} />;
  }

  if (widget.archetype === "streamCard") {
    const result = presetDataSchemas.ticker.safeParse(widget.data);
    if (!result.success) return <InvalidComposite slot={slot} title={label} />;
    return <StreamCard lines={result.data.lines} label={label} slot={slot} />;
  }

  if (widget.archetype === "textCard") {
    const headline = presetDataSchemas.headline.safeParse(widget.data);
    if (headline.success) {
      return <TextCard {...headline.data} kicker={stringSlot(widget, "kicker") ?? headline.data.kicker} slot={slot} />;
    }
    const text = presetDataSchemas.text.safeParse(widget.data);
    if (text.success) return <TextCard text={text.data.md} slot={slot} markdown />;
    return <InvalidComposite slot={slot} title={label} />;
  }

  if (widget.archetype === "mediaCard") {
    const image = presetDataSchemas.image.safeParse(widget.data);
    if (image.success) {
      return (
        <MediaCard
          slot={slot}
          label={label}
          source={{ kind: "image", ...image.data, alt: image.data.alt ?? label ?? "Dashboard image", kenBurns: image.data.kenBurns ?? false }}
        />
      );
    }
    const video = presetDataSchemas.video.safeParse(widget.data);
    if (video.success) {
      return <MediaCard slot={slot} label={label} source={{ kind: "video", ...video.data, alt: label ?? "Dashboard video" }} />;
    }
    return <InvalidComposite slot={slot} title={label} />;
  }

  if (widget.archetype === "splitCard") {
    const nowPlaying = presetDataSchemas.nowPlaying.safeParse(widget.data);
    if (nowPlaying.success) return <NowPlayingCard {...nowPlaying.data} label={label} slot={slot} />;
    const weather = presetDataSchemas.weather.safeParse(widget.data);
    if (weather.success) return <WeatherCard {...weather.data} label={label} slot={slot} />;
    return <InvalidComposite slot={slot} title={label} />;
  }

  return <InvalidComposite slot={slot} title={label} />;
}
