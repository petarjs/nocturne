"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MomentEvent } from "@/lib/moments/bus";

const MomentFlashContext = createContext<MomentEvent | undefined>(undefined);

export function MomentFlashProvider({
  flash,
  children,
}: {
  flash?: MomentEvent;
  children: ReactNode;
}) {
  return <MomentFlashContext.Provider value={flash}>{children}</MomentFlashContext.Provider>;
}

export function useMomentFlash(): MomentEvent | undefined {
  return useContext(MomentFlashContext);
}
