"use client";

import type { ThemeTokens } from "@/lib/schema";
import type { CSSProperties, ReactNode } from "react";
import { useViewportScale } from "@/components/hooks/useViewportScale";
import { TYPE_SCALE } from "@/lib/typography/scale";

/** Applies resolved theme tokens as CSS variables on the display root (§3.1). */
export function ThemeScope({ theme, children }: { theme: ThemeTokens; children: ReactNode }) {
  const vpScale = useViewportScale();

  const style: CSSProperties = {
    ["--n-bg0" as string]: theme.palette.bg0,
    ["--n-bg1" as string]: theme.palette.bg1,
    ["--n-surface-tint" as string]: theme.palette.surfaceTint,
    ["--n-text1" as string]: theme.palette.text1,
    ["--n-text2" as string]: theme.palette.text2,
    ["--n-accent1" as string]: theme.palette.accent1,
    ["--n-accent2" as string]: theme.palette.accent2,
    ["--n-positive" as string]: theme.palette.positive,
    ["--n-negative" as string]: theme.palette.negative,
    ["--n-radius" as string]: `${Math.round(theme.shape.radius * vpScale)}px`,
    ["--n-density-pad" as string]: theme.density === "airy" ? "24px" : "24px",
    ["--n-vp-scale" as string]: String(vpScale),
    ["--n-label-size" as string]: `${Math.round(TYPE_SCALE.label * vpScale)}px`,
    ["--n-meta-size" as string]: `${Math.round(TYPE_SCALE.meta * vpScale)}px`,
    ["--n-value-s" as string]: `${Math.round(TYPE_SCALE["value-s"] * vpScale)}px`,
    ["--n-value-m" as string]: `${Math.round(TYPE_SCALE["value-m"] * vpScale)}px`,
    ["--n-value-l" as string]: `${Math.round(TYPE_SCALE["value-l"] * vpScale)}px`,
    ["--n-value-hero" as string]: `${Math.round(TYPE_SCALE["value-hero"] * vpScale)}px`,
    color: theme.palette.text1,
  };

  return (
    <div className="h-full w-full" style={style}>
      {children}
    </div>
  );
}
