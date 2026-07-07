import type { Widget } from "@/lib/schema";
import { parsePresetData } from "@/lib/schema/widget";

const FIXTURE_EPOCH = Date.UTC(2026, 6, 3, 22, 0, 0);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * One chaos tick for a metric widget (§10): random-walk the value with
 * occasional spikes. Returns a partial pushData patch, or null if not applicable.
 */
export function chaosTick(widget: Widget, spikeChance = 0.06): Record<string, unknown> | null {
  switch (widget.type) {
    case "stat": {
      const data = parsePresetData("stat", widget.data);
      const spike = Math.random() < spikeChance;
      const step = spike ? Math.random() * 28 + 8 : (Math.random() - 0.5) * 6;
      const value = clamp(Math.round((data.value + step) * 10) / 10, 0, 100);
      const spark = [...(data.spark ?? [data.value]).slice(-59), value];
      const prev = spark[spark.length - 2] ?? data.value;
      return { value, delta: Math.round((value - prev) * 10) / 10, spark };
    }
    case "gauge": {
      const data = parsePresetData("gauge", widget.data);
      const spike = Math.random() < spikeChance;
      const step = spike ? Math.random() * 18 + 6 : (Math.random() - 0.5) * 5;
      const value = clamp(Math.round(data.value + step), data.min, data.max);
      return { value };
    }
    case "timeseries": {
      const data = parsePresetData("timeseries", widget.data);
      const last = data.series.at(-1)?.v ?? 40;
      const spike = Math.random() < spikeChance;
      const step = spike ? Math.random() * 30 - 10 : (Math.random() - 0.5) * 14;
      const v = clamp(Math.round((last + step) * 10) / 10, 0, 200);
      const t = (data.series.at(-1)?.t ?? FIXTURE_EPOCH) + 60_000;
      const series = [...data.series.slice(-59), { t, v }];
      return { series };
    }
    default:
      return null;
  }
}

export function randomWalkTick(widget: Widget): Record<string, unknown> | null {
  return chaosTick(widget, 0.02);
}
