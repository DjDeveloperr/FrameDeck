"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeviceFamily, DeviceIndex, DeviceProfile } from "@screendeck/core";
import { Modal } from "./Popover";

interface Props {
  value?: string;
  onChange: (next: string | undefined) => void;
}

let cachedIndex: Promise<DeviceIndex> | null = null;
function loadIndex(): Promise<DeviceIndex> {
  if (!cachedIndex) {
    cachedIndex = fetch("/api/devices").then((r) => r.json());
  }
  return cachedIndex;
}

const FAMILIES: { id: DeviceFamily | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "iphone", label: "iPhone" },
  { id: "ipad", label: "iPad" },
  { id: "apple-watch", label: "Watch" },
];

export function DevicePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<DeviceProfile[]>([]);
  const [family, setFamily] = useState<DeviceFamily | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadIndex().then((data) => {
      if (!cancelled) setIndex(data.devices);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return index
      .filter((d) => (family === "all" ? true : d.family === family))
      .filter((d) => (q ? d.slug.includes(q) || d.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, family, search]);

  const current = index.find((d) => d.slug === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 rounded-md border border-ink-800 bg-ink-850 px-2 py-1.5 text-left transition hover:border-ink-700 hover:bg-ink-825"
      >
        <DeviceThumb profile={current} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] text-ink-100">{current?.name ?? "— pick device —"}</div>
          <div className="truncate font-mono text-[10.5px] text-ink-500">{value ?? "no model"}</div>
        </div>
        <span className="text-[12px] text-ink-500 group-hover:text-ink-300">›</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="flex h-[80vh] w-[92vw] max-w-[960px] flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-950 shadow-2xl shadow-black/60">
          <header className="flex shrink-0 items-center justify-between border-b border-ink-800 px-5 py-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink-50">Pick a device frame</h3>
              <p className="text-[11.5px] text-ink-500">{filtered.length} matching</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[16px] text-ink-400 transition hover:bg-ink-825 hover:text-ink-100"
            >
              ×
            </button>
          </header>

          <div className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-925 px-5 py-2.5">
            <div className="inline-flex overflow-hidden rounded-md border border-ink-800 bg-ink-850 p-0.5">
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFamily(f.id)}
                  className={`rounded-[5px] px-3 py-1 text-[12px] transition ${
                    family === f.id ? "bg-ink-700 text-ink-50" : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or slug…"
              spellCheck={false}
              autoFocus
              className="flex-1 rounded-md border border-ink-800 bg-ink-850 px-3 py-1.5 text-[13px] text-ink-100 outline-none transition focus:border-ink-500 focus:bg-ink-825 placeholder:text-ink-600"
            />
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((d) => {
                const isActive = d.slug === value;
                return (
                  <li key={d.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(d.slug);
                        setOpen(false);
                      }}
                      className={`group flex h-full w-full flex-col items-center gap-2 rounded-lg border p-3 text-center transition ${
                        isActive
                          ? "border-ink-300 bg-ink-825"
                          : "border-ink-800 bg-ink-900 hover:border-ink-700 hover:bg-ink-875"
                      }`}
                    >
                      <DeviceThumb profile={d} large />
                      <div className="w-full min-w-0">
                        <div className="truncate text-[12.5px] font-medium text-ink-100">{d.name}</div>
                        <div className="truncate font-mono text-[10.5px] text-ink-500">{d.slug}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DeviceThumb({ profile, large = false }: { profile?: DeviceProfile; large?: boolean }) {
  const size = large ? 96 : 28;
  if (!profile) {
    return (
      <div
        className="shrink-0 rounded-md border border-dashed border-ink-700 bg-ink-850"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/assets/${profile.images.bezel}`}
        alt={profile.name}
        draggable={false}
        style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", userSelect: "none" }}
      />
    </div>
  );
}
