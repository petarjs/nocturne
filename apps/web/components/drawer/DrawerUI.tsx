export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-white/6 pb-4">
      <h3 className="n-label">{title}</h3>
      {children}
    </section>
  );
}

export function Btn({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${active ? "border-[var(--n-accent1)] bg-[var(--n-accent1)]/15 text-[var(--n-text1)]" : "border-white/10 text-[var(--n-text2)] hover:border-white/20 hover:text-[var(--n-text1)]"} ${className}`}
    >
      {children}
    </button>
  );
}
