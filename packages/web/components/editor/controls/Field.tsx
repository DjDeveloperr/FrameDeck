"use client";

import type { ReactNode } from "react";

interface Props {
  label: string;
  hint?: string;
  children: ReactNode;
  inline?: boolean;
}

export function Field({ label, hint, children, inline = false }: Props) {
  if (inline) {
    return (
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          {label}
        </span>
        <div className="min-w-0 flex-1 max-w-[180px]">{children}</div>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10.5px] text-ink-500">{hint}</span>}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-800/60 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

interface RowProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}

export function Row({ children, cols = 2 }: RowProps) {
  const grid = cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4";
  return <div className={`grid ${grid} gap-1.5`}>{children}</div>;
}
