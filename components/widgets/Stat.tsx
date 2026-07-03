import { Label, Unit } from "@/components/primitives/Label";
import { Value } from "@/components/primitives/Value";
import { Delta } from "@/components/primitives/Delta";
import { Spark } from "@/components/primitives/Spark";

// The `stat` preset (§7.3): statRow archetype — label + value + unit +
// optional delta/spark.
export function Stat({
  label,
  value,
  unit,
  delta,
  spark,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  spark?: number[];
}) {
  return (
    <div className="n-surface flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <div className="flex items-baseline gap-2">
        <Value value={value} decimals={value % 1 !== 0 ? 1 : 0} size="value-l" />
        {unit && <Unit>{unit}</Unit>}
      </div>
      {spark && <Spark points={spark} width={140} height={28} />}
    </div>
  );
}
