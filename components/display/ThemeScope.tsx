"use client";

import type { ThemeTokens } from "@/lib/schema";
import type { EffectTier } from "@/lib/tiers";
import type { CSSProperties, ReactNode } from "react";
import { useViewportScale } from "@/components/hooks/useViewportScale";
import { TYPE_SCALE } from "@/lib/typography/scale";
import { resolveFontVar } from "@/lib/themes/fonts";

function surfaceAlpha(density: ThemeTokens["density"]): number {
  return density === "airy" ? 0.08 : 0.1;
}

function densityPad(density: ThemeTokens["density"], vpScale: number): number {
  const base = density === "airy" ? 28 : 24;
  return Math.round(base * vpScale);
}

/** Applies resolved theme tokens as CSS variables on the display root (§3.1). */
export function ThemeScope({
  theme,
  tier,
  children,
}: {
  theme: ThemeTokens;
  tier: EffectTier;
  children: ReactNode;
}) {
  const vpScale = useViewportScale();
  const pad = densityPad(theme.density, vpScale);
  const scaleRatio = theme.type.scaleRatio;

  const style: CSSProperties = {
    ["--n-bg0" as string]: theme.palette.bg0,
    ["--n-bg1" as string]: theme.palette.bg1,
    ["--n-surface-tint" as string]: theme.palette.surfaceTint,
    ["--n-surface-alpha" as string]: String(surfaceAlpha(theme.density)),
    ["--n-text1" as string]: theme.palette.text1,
    ["--n-text2" as string]: theme.palette.text2,
    ["--n-accent1" as string]: theme.palette.accent1,
    ["--n-accent2" as string]: theme.palette.accent2,
    ["--n-positive" as string]: theme.palette.positive,
    ["--n-negative" as string]: theme.palette.negative,
    ["--n-font-display" as string]: resolveFontVar(theme.type.display),
    ["--n-font-data" as string]: resolveFontVar(theme.type.data),
    ["--n-scale-ratio" as string]: String(scaleRatio),
    ["--n-radius" as string]: `${Math.round(theme.shape.radius * vpScale)}px`,
    ["--n-density-pad" as string]: `${pad}px`,
    ["--n-vp-scale" as string]: String(vpScale),
    ["--n-label-size" as string]: `${Math.round(TYPE_SCALE.label * vpScale)}px`,
    ["--n-meta-size" as string]: `${Math.round(TYPE_SCALE.meta * vpScale)}px`,
    ["--n-value-s" as string]: `${Math.round(TYPE_SCALE["value-s"] * vpScale * scaleRatio)}px`,
    ["--n-value-m" as string]: `${Math.round(TYPE_SCALE["value-m"] * vpScale * scaleRatio)}px`,
    ["--n-value-l" as string]: `${Math.round(TYPE_SCALE["value-l"] * vpScale * scaleRatio)}px`,
    ["--n-value-hero" as string]: `${Math.round(TYPE_SCALE["value-hero"] * vpScale * scaleRatio)}px`,
    ["--n-headline-size" as string]: `${Math.round(TYPE_SCALE.headline * vpScale * scaleRatio)}px`,
    color: theme.palette.text1,
  };

  return (
    <div
      className="h-full w-full"
      data-tier={tier}
      data-blur={theme.shape.blur ? "on" : "off"}
      data-border={theme.shape.border}
      data-density={theme.density}
      style={style}
    >
      {children}
    </div>
  );
}
