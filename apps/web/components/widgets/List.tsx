import { Label } from "@/components/primitives/Label";
import { Rows } from "@/components/primitives/Rows";
import { EmptyState } from "@/components/primitives/EmptyState";
import type { WidgetSlot } from "@/lib/layout/types";

// The `list` preset (§7.3): rows archetype — ranked list with FLIP reorder.
export function List({
  label,
  items,
  slot = "supporting",
}: {
  label?: string;
  items: { id: string; label: string; value: string | number }[];
  slot?: WidgetSlot;
}) {
  if (slot === "ambient") {
    const visible = items.slice(0, 3);
    return (
      <div className="n-surface flex h-full w-full items-center gap-3 overflow-hidden px-4 py-2">
        {label && <Label className="w-14 shrink-0 leading-tight">{label}</Label>}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 overflow-hidden">
          {visible.length === 0 ? <EmptyState compact /> : visible.slice(0, 1).map((item) => (
            <span key={item.id} className="flex shrink-0 items-baseline gap-1.5">
              <span className="n-data max-w-24 truncate text-[12px]">{item.label}</span>
              <span className="n-data text-[11px]" style={{ color: "var(--n-text2)" }}>
                {item.value}
              </span>
            </span>
          ))}
          {items.length > 1 && <Label className="shrink-0">+{items.length - 1}</Label>}
        </div>
      </div>
    );
  }

  return (
    <div className="n-surface flex h-full w-full flex-col gap-3 overflow-hidden p-6">
      {label && <Label>{label}</Label>}
      {items.length > 0 ? <Rows items={items} /> : <EmptyState />}
    </div>
  );
}
