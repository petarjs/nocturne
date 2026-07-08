import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Delta } from "@/components/primitives/Delta";
import { Spark } from "@/components/primitives/Spark";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot, valueSizeForSlot } from "./types";

const CURRENCY_SYMBOLS = new Set(["$", "€", "£", "¥"]);

/** statRow / heroValue archetype (§7.2): label + value + optional delta/spark. */
export function HeroValue({
  slot,
  label,
  value,
  unit,
  delta,
  spark,
  widgetId,
}: {
  slot: ArchetypeSlot;
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  spark?: number[];
  widgetId?: string;
}) {
  const pad = surfacePadForSlot[slot];
  const valueSize = valueSizeForSlot[slot];
  // Currency symbols prefix the value and always show cents; everything
  // else suffixes and only shows a decimal when the value itself has one.
  const isCurrency = unit !== undefined && CURRENCY_SYMBOLS.has(unit);
  const decimals = isCurrency ? 2 : value % 1 !== 0 ? 1 : 0;

  if (slot === "ambient") {
    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        <Label className="w-16 shrink-0 leading-tight">{label}</Label>
        <div className="flex min-w-0 items-baseline gap-1">
          {isCurrency && <Unit className="text-[12px]">{unit}</Unit>}
          <Value value={value} decimals={decimals} size="value-s" />
          {!isCurrency && unit && <Unit className="text-[12px]">{unit}</Unit>}
        </div>
      </div>
    );
  }

  const showDelta = slot === "hero" && delta !== undefined;
  const showSpark = spark && spark.length > 1;

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-2 ${pad} ${slot === "hero" ? "n-surface--hero" : ""}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Label>{label}</Label>
        {showDelta && <Delta value={delta} />}
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        {isCurrency && <Unit>{unit}</Unit>}
        <Value value={value} decimals={decimals} size={valueSize} />
        {!isCurrency && unit && <Unit>{unit}</Unit>}
      </div>
      {showSpark && (
        <div className="flex min-h-0 flex-1 items-stretch pt-1">
          <Spark
            points={spark}
            fill
            className="h-full min-h-[24px] w-full"
            widgetId={widgetId}
            id={widgetId ? `${widgetId}-spark` : "spark"}
          />
        </div>
      )}
    </div>
  );
}
