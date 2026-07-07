import { z } from "zod";
import { sceneSchema } from "@nocturne/core";

/** Dashboard slugs double as DO names and URL segments: lowercase kebab, ≤64 chars. */
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/,
    "lowercase letters, digits, and inner hyphens only (max 64 chars)"
  );

export const createDashboardSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(80).optional(),
  /** Full initial scene; defaults to the `minimal` preset server-side. */
  scene: sceneSchema.optional(),
});

export const settingsSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    /** Set a code to lock viewing; `null` clears it. */
    viewCode: z.string().min(1).max(64).nullable().optional(),
  })
  .refine((s) => s.name !== undefined || s.viewCode !== undefined, {
    message: "nothing to update",
  });

export const createKeySchema = z.object({
  name: z.string().min(1).max(64),
});
