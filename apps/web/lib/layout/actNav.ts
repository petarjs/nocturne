"use client";

import { useSyncExternalStore } from "react";

// Manual act navigation for the /display test harness only (§10's drawer):
// lets the control drawer jump between story-arc acts without waiting out
// the dwell timer. useActRotation (both routes) reads/writes this same
// index so a manual jump resets the dwell clock exactly like auto-advance
// does; production's SettingsDrawer never imports the setters.
type Updater = number | ((prev: number) => number);

let index = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const actNav = {
  get: () => index,
  set: (next: Updater) => {
    index = typeof next === "function" ? (next as (p: number) => number)(index) : next;
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useActNavIndex() {
  return useSyncExternalStore(actNav.subscribe, actNav.get, () => 0);
}
