import { z } from "zod";

export const decorLayerSchema = z.object({
  type: z.enum(["lottie", "image", "video"]),
  src: z.string(),
  placement: z.string(),
  opacity: z.number().min(0).max(0.5),
  tint: z.string().optional(),
});

export const backgroundEngineSchema = z.enum([
  "aurora",
  "gridHorizon",
  "particles",
  "phosphor",
  "growth",
  "deepField",
  "flat",
]);

export const motionDialectSchema = z.enum([
  "calm",
  "ink",
  "mechanical",
  "chromatic",
  "terse",
  "gothic",
]);

export const themeTokensSchema = z.object({
  id: z.string(),
  palette: z.object({
    bg0: z.string(),
    bg1: z.string(),
    surfaceTint: z.string(),
    text1: z.string(),
    text2: z.string(),
    accent1: z.string(),
    accent2: z.string(),
    positive: z.string(),
    negative: z.string(),
  }),
  type: z.object({
    display: z.string(),
    data: z.string(),
    scaleRatio: z.number().min(1.4).max(1.6),
  }),
  shape: z.object({
    radius: z.number().min(0),
    border: z.enum(["hairline", "glow", "none"]),
    blur: z.boolean(),
  }),
  motion: z.object({
    dialect: motionDialectSchema,
    speed: z.number().min(0.5).max(1.5),
  }),
  background: z.object({
    engine: backgroundEngineSchema,
    preset: z.string().optional(),
    params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    decor: z.array(decorLayerSchema).optional(),
  }),
  density: z.enum(["airy", "normal"]),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type DecorLayer = z.infer<typeof decorLayerSchema>;
export type BackgroundEngine = z.infer<typeof backgroundEngineSchema>;
export type MotionDialect = z.infer<typeof motionDialectSchema>;
