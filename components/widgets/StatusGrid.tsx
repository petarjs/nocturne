import { Label } from "@/components/primitives/Label";
import { Dot } from "@/components/primitives/Dot";
import type { WidgetSlot } from "@/lib/layout/types";

type StatusItem = {
  id: string;
  label: string;
  state: "up" | "down" | "degraded";
  latency?: number;
};

function StatusRow({ item, compact }: { item: StatusItem; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Dot state={item.state} />
      <span className={`n-data min-w-0 truncate ${compact ? "text-[11px]" : "text-[14px]"}`}>
        {item.label}
      </span>
      {item.state === "down" ? (
        <span
          className={`n-data shrink-0 uppercase ${compact ? "text-[10px]" : "text-[12px]"}`}
          style={{ color: "var(--n-negative)" }}
        >
          down
        </span>
      ) : item.latency !== undefined ? (
        <span
          className={`n-data shrink-0 ${compact ? "text-[10px]" : "text-[12px]"}`}
          style={{ color: "var(--n-text2)" }}
        >
          {item.latency}ms
        </span>
      ) : null}
    </div>
  );
}

// The `statusGrid` preset (§7.3): matrix archetype — dots + labels in a grid.
export function StatusGrid({
  label,
  items,
  slot = "supporting",
}: {
  label?: string;
  items: StatusItem[];
  slot?: WidgetSlot;
}) {
  if (slot === "ambient") {
    return (
      <div className="n-surface flex h-full w-full items-stretch gap-3 overflow-hidden px-4 py-2">
        {label && (
          <Label className="flex w-16 shrink-0 items-center leading-tight">{label}</Label>
        )}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-3 grid-rows-2 content-center gap-x-2 gap-y-0.5">
          {items.map((item) => (
            <StatusRow key={item.id} item={item} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="n-surface flex h-full w-full flex-col gap-3 overflow-hidden p-6">
      {label && <Label>{label}</Label>}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 content-start">
        {items.map((item) => (
          <StatusRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
