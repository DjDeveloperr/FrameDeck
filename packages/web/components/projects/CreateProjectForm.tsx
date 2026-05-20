"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { IconCheck, IconPlus } from "@/components/editor/icons";

type LocationMode = "library" | "custom";

interface Props {
  libraryRoot: string;
}

export function CreateProjectForm({ libraryRoot }: Props) {
  const { push, refresh } = useRouter();
  const [form, setForm] = useState({
    name: "",
    mode: "library" as LocationMode,
    directory: "",
    subdir: "screenshots",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { name, mode, directory, subdir } = form;

  const canCreate = name.trim().length > 0 && (mode === "library" || directory.trim().length > 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          directory: mode === "custom" ? directory : undefined,
          subdir: mode === "custom" ? subdir : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { project: { manifest: { id: string } } };
      push(`/projects/${encodeURIComponent(data.project.manifest.id)}`);
      refresh();
    } catch (err) {
      setError((err as Error).message || "Could not create project.");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-2xl border border-ink-800 bg-ink-900 p-4 shadow-2xl shadow-black/10"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,1.1fr)_minmax(220px,1.2fr)_auto] lg:items-end">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My App"
            className="h-9 w-full rounded-lg border border-ink-800 bg-ink-850 px-3 text-[13px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-ink-600 focus:bg-ink-825"
          />
        </label>

        <div className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Location
          </span>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-ink-800 bg-ink-850 p-0.5">
            <LocationButton
              active={mode === "library"}
              onClick={() => setForm((prev) => ({ ...prev, mode: "library" }))}
            >
              Library
            </LocationButton>
            <LocationButton
              active={mode === "custom"}
              onClick={() => setForm((prev) => ({ ...prev, mode: "custom" }))}
            >
              Custom
            </LocationButton>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canCreate || pending}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ink-100 px-4 text-[12.5px] font-semibold text-ink-1000 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400"
        >
          {pending ? <IconCheck size={13} /> : <IconPlus size={13} />}
          <span>{pending ? "Creating" : "Create"}</span>
        </button>
      </div>

      {mode === "custom" ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              Directory
            </span>
            <input
              value={directory}
              onChange={(e) => setForm((prev) => ({ ...prev, directory: e.target.value }))}
              placeholder="~/Developer/MyApp"
              className="h-9 w-full rounded-lg border border-ink-800 bg-ink-850 px-3 font-mono text-[12px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-ink-600 focus:bg-ink-825"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
              Subdir
            </span>
            <input
              value={subdir}
              onChange={(e) => setForm((prev) => ({ ...prev, subdir: e.target.value }))}
              placeholder="screenshots"
              className="h-9 w-full rounded-lg border border-ink-800 bg-ink-850 px-3 font-mono text-[12px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-ink-600 focus:bg-ink-825"
            />
          </label>
        </div>
      ) : (
        <div className="mt-3 truncate font-mono text-[11px] text-ink-500" title={libraryRoot}>
          {libraryRoot}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      )}
    </form>
  );
}

function LocationButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 rounded-md text-[12px] font-medium transition",
        active ? "bg-ink-700 text-ink-50 shadow-sm" : "text-ink-400 hover:bg-ink-825 hover:text-ink-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
