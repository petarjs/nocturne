"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/primitives/Label";
import { Arc } from "@/components/primitives/Arc";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// The `clock` preset (§7.3): heroValue archetype. Seconds are a thin
// progress arc, never a ticking number (§7.3) — the display never shows a
// jittery digit.
export function Clock() {
  // null until mount avoids an SSR/client hydration mismatch on the time.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to a timer, not derived state
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="n-surface n-surface--hero relative flex flex-col items-center justify-center gap-3 p-10">
      <Label>{dateLabel}</Label>
      <div className="relative flex items-center justify-center">
        <span
          className="n-data"
          style={{ fontSize: 132, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </span>
        <div className="pointer-events-none absolute -right-14 top-1/2 -translate-y-1/2">
          <Arc fraction={now.getSeconds() / 60} size={40} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
