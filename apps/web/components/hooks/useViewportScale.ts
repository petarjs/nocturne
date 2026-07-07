"use client";

import { useEffect, useState } from "react";
import { DESIGN_HEIGHT, viewportScale } from "@/lib/typography/scale";

/** Tracks viewport height and returns the §3.3 scale factor (0.6–2.0). */
export function useViewportScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => setScale(viewportScale(window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return scale;
}

export { DESIGN_HEIGHT };
