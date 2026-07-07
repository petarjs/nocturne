"use client";

import { useEffect, useState } from "react";

/** Rolling FPS sample for the perf overlay (§10). */
export function useFps(active = true): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!active) return;

    let frames = 0;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      frames++;
      const elapsed = now - last;
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return fps;
}
