"use client";

import { useSceneStore } from "@/lib/store";
import { resolveTheme } from "@/lib/themes";
import { Background } from "@/components/background/Background";
import { Clock } from "@/components/widgets/Clock";
import { Stat } from "@/components/widgets/Stat";
import type { Widget } from "@/lib/schema";

// Display route: fully client-side, static-exportable (§9.1). This is a
// fixed-layout holding pattern — the real layout engine (§6, narrative
// roles → geometry, FLIP, acts) lands in the next slice. For now widgets
// are placed by hand so the aurora engine + surface recipe + clock/stat
// primitives can be verified on screen together.
function FallbackWidget({ widget }: { widget: Widget }) {
  return (
    <div className="n-surface flex flex-col gap-2 p-6">
      <div className="n-label">{widget.title ?? widget.type}</div>
      <div className="n-data text-sm" style={{ color: "var(--n-text2)" }}>
        preset not wired yet
      </div>
    </div>
  );
}

export default function DisplayPage() {
  const scene = useSceneStore((s) => s.scene);
  const theme = resolveTheme(scene.theme);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Background theme={theme} />
      <div className="relative z-10 flex min-h-screen flex-col gap-8 p-12">
        <div className="n-label">
          {scene.name} · {scene.mood}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-10">
          <Clock />
          <div className="grid grid-cols-2 gap-6 xl:grid-cols-3">
            {scene.widgets
              .filter((w) => w.id !== "clock")
              .map((w) =>
                w.type === "stat" ? (
                  <Stat key={w.id} {...(w.data as { label: string; value: number; unit?: string; delta?: number; spark?: number[] })} />
                ) : (
                  <FallbackWidget key={w.id} widget={w} />
                )
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
