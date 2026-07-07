"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/primitives/Label";
import { Arc } from "@/components/primitives/Arc";
import type { WidgetSlot } from "@/lib/layout/types";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// The `clock` preset (§7.3): heroValue archetype. Seconds are a thin
// progress arc, never a ticking number (§7.3) — the display never shows a
// jittery digit.
export function Clock({ slot = "hero" }: { slot?: WidgetSlot }) {
  // null until mount avoids an SSR/client hydration mismatch on the time.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to a timer, not derived state
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="n-surface h-full w-full" aria-hidden />;
  }

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (slot === "ambient") {
    const dateLabel = now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return (
      <div className="n-surface flex h-full w-full items-center justify-between gap-3 overflow-hidden px-4 py-2">
        <Label className="shrink-0">{dateLabel}</Label>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="n-data"
            style={{
              fontSize: "calc(var(--n-value-l) * 0.45)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {time}
          </span>
          <Arc fraction={now.getSeconds() / 60} size={24} strokeWidth={2} />
        </div>
      </div>
    );
  }

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="n-surface n-surface--hero relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden p-10">
      <Label>{dateLabel}</Label>
      <div className="relative flex items-center justify-center">
        <span
          className="n-data"
          style={{
            fontSize: "var(--n-value-hero)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {time}
        </span>
        <div className="pointer-events-none absolute -right-14 top-1/2 -translate-y-1/2">
          <Arc fraction={now.getSeconds() / 60} size={40} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
