"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MotionDialect } from "@/lib/schema";

const MotionDialectContext = createContext<MotionDialect>("calm");

export function MotionDialectProvider({
  dialect,
  children,
}: {
  dialect: MotionDialect;
  children: ReactNode;
}) {
  return <MotionDialectContext.Provider value={dialect}>{children}</MotionDialectContext.Provider>;
}

export function useMotionDialect(): MotionDialect {
  return useContext(MotionDialectContext);
}
