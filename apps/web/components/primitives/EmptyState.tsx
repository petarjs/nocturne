import { Label } from "@/components/primitives/Label";

/** Quiet, useful fallback for a valid widget that has not received data yet. */
export function EmptyState({
  message = "Awaiting data",
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-h-0 flex-1 items-center ${compact ? "gap-2" : "gap-3"}`}>
      <span
        className={`${compact ? "w-5" : "w-8"} h-px shrink-0`}
        style={{ background: "color-mix(in srgb, var(--n-accent1) 45%, transparent)" }}
      />
      <Label className="normal-case tracking-[0.04em] opacity-70">{message}</Label>
    </div>
  );
}
