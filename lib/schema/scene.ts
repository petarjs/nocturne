import { z } from "zod";
import { themeTokensSchema } from "./theme";
import { widgetSchema } from "./widget";

export const moodSchema = z.enum(["ambient", "focus", "alert", "sleep"]);
export type Mood = z.infer<typeof moodSchema>;

const widgetIdSchema = z.string();

export const actSchema = z.object({
  hero: widgetIdSchema.optional(),
  supporting: z.array(widgetIdSchema).max(4),
  ambient: z.array(widgetIdSchema),
  dwellSec: z.number().optional(),
});

export const rotationSchema = z.object({
  mode: z.enum(["off", "auto", "story"]),
  dwellSec: z.number().min(10).default(20),
  indicator: z.enum(["none", "hairline"]),
});

export const narrativeSchema = z.object({
  anchors: z.array(widgetIdSchema).optional(),
  acts: z.array(actSchema),
  rotation: rotationSchema,
});
export type Narrative = z.infer<typeof narrativeSchema>;

export const sceneSchema = z.object({
  version: z.number(),
  name: z.string(),
  theme: z.union([themeTokensSchema, z.object({ preset: z.string() })]),
  mood: moodSchema,
  narrative: narrativeSchema,
  widgets: z.array(widgetSchema),
});
export type Scene = z.infer<typeof sceneSchema>;
