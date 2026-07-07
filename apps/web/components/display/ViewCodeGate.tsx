"use client";

import { useState } from "react";

/**
 * Shown when the dashboard is view-code locked and this browser has no (or a
 * stale) code — the socket closed with 4001. Quiet by design: a single panel
 * over the dimmed canvas, no branding noise.
 */
export function ViewCodeGate({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  const submit = () => {
    const trimmed = code.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.55)" }}
    >
      <div className="n-surface flex w-72 flex-col gap-4 p-6">
        <div className="n-label">This display is locked</div>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="view code"
          className="n-data w-full rounded-md bg-transparent px-3 py-2 text-lg outline-none"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "var(--n-text1)",
          }}
        />
        <button
          onClick={submit}
          className="n-label cursor-pointer rounded-md px-3 py-2 text-left transition-opacity hover:opacity-80"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "var(--n-accent1)",
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
