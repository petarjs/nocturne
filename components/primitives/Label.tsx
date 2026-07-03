// The `label` / `unit` primitives (§7.1, §3.3): small, uppercase, tracked,
// quiet — stagehands, never the star.
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`n-label ${className}`}>{children}</span>;
}

export function Unit({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`n-data text-[14px] ${className}`} style={{ color: "var(--n-text2)" }}>
      {children}
    </span>
  );
}
