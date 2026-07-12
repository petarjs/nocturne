import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Spark } from "@/components/primitives/Spark";
import { WeatherGlyph } from "@/components/primitives/WeatherGlyph";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type Hour = { t: string; tempC: number };

export function WeatherCard({
  slot,
  label,
  tempC,
  condition,
  hi,
  lo,
  hourly,
}: {
  slot: ArchetypeSlot;
  label?: string;
  tempC: number;
  condition: string;
  hi: number;
  lo: number;
  hourly?: Hour[];
}) {
  const pad = surfacePadForSlot[slot];
  const spark = hourly?.map((hour) => hour.tempC) ?? [];

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="min-w-0 flex-1 truncate">{label ?? condition}</Label>
        <div className="flex shrink-0 items-baseline gap-1">
          <Value value={tempC} decimals={0} size="value-s" />
          <Unit>°C</Unit>
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-3 overflow-hidden ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      <div className="flex min-h-0 flex-1 items-center gap-5">
        <div className="min-w-0 flex-1">
          <Label>{label ?? "Weather"}</Label>
          <div className="mt-2 flex items-baseline gap-1">
            <Value value={tempC} decimals={0} size={slot === "hero" ? "value-l" : "value-m"} />
            <Unit>°C</Unit>
          </div>
          <div className="mt-2 truncate capitalize" style={{ color: "var(--n-text2)", fontSize: "var(--n-meta-size)" }}>
            {condition} · {Math.round(lo)}° / {Math.round(hi)}°
          </div>
        </div>
        <WeatherGlyph condition={condition} size={slot === "hero" ? 112 : 78} />
      </div>
      {spark.length > 1 && (
        <div className="h-10 shrink-0">
          <Spark points={spark} fill className="h-full w-full" id={`weather-${condition}`} />
        </div>
      )}
    </div>
  );
}
