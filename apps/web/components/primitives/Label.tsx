// The `label` / `unit` primitives (§7.1, §3.3): small, uppercase, tracked,
// quiet — stagehands, never the star.
import type { CSSProperties } from "react";

export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`n-label ${className}`}>{children}</span>;
}

export function Unit({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`n-data ${className}`} style={{ color: "var(--n-text2)", fontSize: "var(--n-meta-size, 14px)", ...style }}>
      {children}
    </span>
  );
}
