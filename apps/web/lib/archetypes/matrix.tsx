import { Label } from "@/components/primitives/Label";
import { Dot } from "@/components/primitives/Dot";
import { EmptyState } from "@/components/primitives/EmptyState";
import type { ArchetypeSlot } from "./types";
import { surfacePadForSlot } from "./types";

type StatusItem = {
  id: string;
  label: string;
  state: "up" | "down" | "degraded";
  latency?: number;
};

function StatusRow({
  item,
  hero,
}: {
  item: StatusItem;
  hero?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${item.state === "down" && hero ? "rounded-md bg-[var(--n-negative)]/10 px-2 py-1" : ""}`}>
      <Dot state={item.state} size={hero ? "md" : "sm"} />
      <span
        className={`n-data min-w-0 truncate ${hero ? "text-[length:calc(var(--n-meta-size)*1.25)] font-medium" : "text-[length:var(--n-meta-size)]"}`}
      >
        {item.label}
      </span>
      {item.state === "down" ? (
        <span
          className="n-data shrink-0 text-[length:calc(var(--n-meta-size)*0.85)] uppercase tracking-wider"
          style={{ color: "var(--n-negative)" }}
        >
          down
        </span>
      ) : item.latency !== undefined ? (
        <span
          className="n-data shrink-0 text-[length:calc(var(--n-meta-size)*0.9)] tabular-nums"
          style={{ color: "var(--n-text1)", opacity: 0.55 }}
        >
          {item.latency}ms
        </span>
      ) : null}
    </div>
  );
}

/** matrix archetype (§7.2): status dots + labels in a grid. */
export function Matrix({
  slot,
  label,
  items,
  critical = false,
}: {
  slot: ArchetypeSlot;
  label?: string;
  items: StatusItem[];
  critical?: boolean;
}) {
  const pad = surfacePadForSlot[slot];
  const sorted = critical
    ? [...items].sort((a, b) => {
        if (a.state === "down" && b.state !== "down") return -1;
        if (b.state === "down" && a.state !== "down") return 1;
        return 0;
      })
    : items;

  if (slot === "ambient") {
    const downCount = sorted.filter((item) => item.state === "down").length;
    const degradedCount = sorted.filter((item) => item.state === "degraded").length;
    const summaryState = downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "up";
    const summary =
      downCount > 0
        ? `${downCount} down`
        : degradedCount > 0
          ? `${degradedCount} degraded`
          : `${sorted.length} up`;

    return (
      <div className={`n-surface flex h-full w-full items-center gap-3 overflow-hidden ${pad}`}>
        {label && (
          <Label className="min-w-0 flex-1 truncate leading-none">{label}</Label>
        )}
        {sorted.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            <Dot state={summaryState} size="md" />
            <span
              className="n-data whitespace-nowrap text-[length:var(--n-meta-size)]"
              style={{ color: summaryState === "down" ? "var(--n-negative)" : "var(--n-text1)" }}
            >
              {summary}
            </span>
          </div>
        ) : (
          <EmptyState compact />
        )}
      </div>
    );
  }

  if (slot === "hero") {
    const downItems = sorted.filter((i) => i.state === "down");
    const rest = sorted.filter((i) => i.state !== "down");

    return (
      <div className={`n-surface n-surface--hero flex h-full w-full flex-col gap-4 overflow-hidden ${pad}`}>
        {label && <Label>{label}</Label>}
        {downItems.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2 rounded-[calc(var(--n-radius)-4px)] border border-[var(--n-negative)]/25 bg-[var(--n-negative)]/8 p-4">
            {downItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <Dot state={item.state} size="md" />
                <span className="n-data text-[length:calc(var(--n-meta-size)*1.5)] font-medium">{item.label}</span>
                <span
                  className="n-data ml-auto text-[length:var(--n-meta-size)] uppercase tracking-[0.12em]"
                  style={{ color: "var(--n-negative)" }}
                >
                  down
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-6 gap-y-3 content-start">
          {sorted.length === 0 && (
            <div className="col-span-2 flex">
              <EmptyState />
            </div>
          )}
          {rest.map((item) => (
            <StatusRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`n-surface flex h-full w-full flex-col gap-3 overflow-hidden ${pad}`}>
      {label && <Label>{label}</Label>}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 content-start">
        {sorted.length === 0 && (
          <div className="col-span-2 flex">
            <EmptyState />
          </div>
        )}
        {sorted.map((item) => (
          <StatusRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
