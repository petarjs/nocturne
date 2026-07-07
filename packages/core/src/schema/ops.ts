import { z } from "zod";
import { themeTokensSchema, backgroundEngineSchema } from "./theme";
import { widgetSchema } from "./widget";
import { narrativeSchema, actSchema, rotationSchema, moodSchema, sceneSchema } from "./scene";

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setNarrative"), narrative: narrativeSchema }),
  z.object({ type: z.literal("setActs"), acts: z.array(actSchema) }),
  z.object({ type: z.literal("setRotation"), rotation: rotationSchema }),
  z.object({ type: z.literal("addWidget"), widget: widgetSchema }),
  z.object({ type: z.literal("removeWidget"), id: z.string() }),
  z.object({
    type: z.literal("updateWidget"),
    id: z.string(),
    patch: widgetSchema.partial().omit({ id: true }),
  }),
  z.object({ type: z.literal("pinWidget"), id: z.string(), pinned: z.boolean() }),
  z.object({ type: z.literal("setTheme"), theme: z.union([themeTokensSchema, z.object({ preset: z.string() })]) }),
  z.object({
    type: z.literal("setBackground"),
    engine: backgroundEngineSchema,
    preset: z.string().optional(),
    params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  }),
  z.object({ type: z.literal("setMood"), mood: moodSchema }),
  z.object({
    type: z.literal("triggerMoment"),
    id: z.string(),
    tier: z.enum(["t0", "t1", "t2", "t3"]),
  }),
  z.object({ type: z.literal("setScene"), scene: sceneSchema }),
  z.object({ type: z.literal("saveScene"), name: z.string() }),
  z.object({ type: z.literal("loadScene"), name: z.string() }),
  // data-plane op — high-frequency, never through an LLM
  z.object({ type: z.literal("pushData"), id: z.string(), data: z.unknown() }),
]);

export type Op = z.infer<typeof opSchema>;
export const opsBatchSchema = z.array(opSchema);
