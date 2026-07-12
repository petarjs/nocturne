import { z } from "zod";

export const presetTypeSchema = z.enum([
  "clock",
  "stat",
  "gauge",
  "timeseries",
  "barChart",
  "donut",
  "statusGrid",
  "table",
  "list",
  "ticker",
  "nowPlaying",
  "weather",
  "agenda",
  "headline",
  "text",
  "image",
  "video",
]);
export type PresetType = z.infer<typeof presetTypeSchema>;

const seriesPointSchema = z.object({ t: z.number(), v: z.number() });

export const presetDataSchemas = {
  clock: z.object({}),
  stat: z.object({
    label: z.string(),
    value: z.number(),
    unit: z.string().optional(),
    delta: z.number().optional(),
    spark: z.array(z.number()).optional(),
  }),
  gauge: z.object({
    label: z.string(),
    value: z.number(),
    min: z.number(),
    max: z.number(),
    warn: z.number().optional(),
    crit: z.number().optional(),
    unit: z.string().optional(),
  }),
  timeseries: z.object({
    label: z.string(),
    series: z.array(seriesPointSchema),
    window: z.string().optional(),
    unit: z.string().optional(),
  }),
  barChart: z.object({
    label: z.string(),
    categories: z.array(z.object({ label: z.string(), value: z.number() })),
  }),
  donut: z.object({
    label: z.string(),
    segments: z.array(z.object({ label: z.string(), value: z.number() })).max(5),
  }),
  statusGrid: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        state: z.enum(["up", "down", "degraded"]),
        latency: z.number().optional(),
      })
    ),
  }),
  table: z.object({
    columns: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["text", "num", "delta", "status"]),
      })
    ),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  }),
  list: z.object({
    items: z.array(
      z.object({ id: z.string(), label: z.string(), value: z.union([z.string(), z.number()]) })
    ),
  }),
  ticker: z.object({
    lines: z.array(
      z.object({ t: z.string(), text: z.string(), level: z.enum(["info", "warn", "error"]).optional() })
    ),
  }),
  nowPlaying: z.object({
    title: z.string(),
    artist: z.string(),
    artUrl: z.string().optional(),
    progress: z.number().min(0).max(1),
    state: z.enum(["playing", "paused"]),
  }),
  weather: z.object({
    tempC: z.number(),
    condition: z.string(),
    hi: z.number(),
    lo: z.number(),
    hourly: z.array(z.object({ t: z.string(), tempC: z.number() })).optional(),
  }),
  agenda: z.object({
    events: z.array(
      z.object({ id: z.string(), title: z.string(), startsAt: z.string(), endsAt: z.string() })
    ),
  }),
  headline: z.object({
    text: z.string(),
    kicker: z.string().optional(),
    tone: z.enum(["neutral", "positive", "negative"]).optional(),
  }),
  text: z.object({ md: z.string() }),
  image: z.object({
    src: z.string(),
    alt: z.string().optional(),
    fit: z.enum(["cover", "contain"]).default("cover"),
    kenBurns: z.boolean().optional(),
  }),
  video: z.object({
    src: z.string(),
    poster: z.string(),
    loop: z.boolean().default(true),
  }),
} as const;

const widgetMetaSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  bind: z
    .object({
      source: z.string().optional(),
      ttlSec: z.number().default(60),
    })
    .optional(),
  accent: z.enum(["accent1", "accent2"]).optional(),
  thresholds: z.record(z.string(), z.number()).optional(),
  state: z.enum(["normal", "attention", "critical", "stale"]).default("normal"),
  pinned: z.boolean().optional(),
});

export const compositeArchetypeSchema = z.enum([
    "heroValue",
    "statRow",
    "chartCard",
    "matrix",
    "tableCard",
    "streamCard",
    "textCard",
    "mediaCard",
    "splitCard",
]);

export const compositeSchema = widgetMetaSchema.extend({
  type: z.literal("composite"),
  archetype: compositeArchetypeSchema,
  slots: z.record(z.string(), z.unknown()),
  data: z.unknown(),
});

const presetWidgetSchema = widgetMetaSchema.extend({
  type: presetTypeSchema,
  data: z.unknown(),
});

export const widgetSchema = z.union([presetWidgetSchema, compositeSchema]);

/** Shape-only patch schema; the reducer applies it to an existing validated widget. */
export const widgetPatchSchema = widgetMetaSchema
  .partial()
  .omit({ id: true })
  .extend({
    data: z.unknown().optional(),
  });

export type Widget = z.infer<typeof widgetSchema>;

export function parsePresetData<T extends PresetType>(type: T, data: unknown): z.infer<(typeof presetDataSchemas)[T]> {
  return presetDataSchemas[type].parse(data) as z.infer<(typeof presetDataSchemas)[T]>;
}
