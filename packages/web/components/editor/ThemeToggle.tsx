"use client";

// Light / dark / system theme toggle.
//
// Default: respect the OS preference. User selection persists in
// localStorage. The pre-hydration script in `app/layout.tsx` applies the
// saved value before React renders so there's no flash of the wrong theme.

import { useEffect, useState } from "react";
import { IconCheck, IconEye } from "./icons";

type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "framedeck:theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(mode: Mode) {
  const effective = mode === "system" ? systemTheme() : mode;
  if (effective === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [open, setOpen] = useState(false);

  // Read persisted value on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setMode(stored);
    }
  }, []);

  // React to OS-level changes when in system mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handle = () => applyTheme("system");
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [mode]);

  useEffect(() => {
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-theme-toggle]")) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" data-theme-toggle>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1.5 rounded-full bg-ink-875 px-3 text-[11.5px] font-medium leading-none text-ink-200 transition hover:bg-ink-825 hover:text-ink-50"
        title="Theme"
      >
        <IconEye />
        <span className="capitalize">{mode}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-md border border-ink-800 bg-ink-900 shadow-2xl shadow-black/40">
          {(["system", "light", "dark"] as Mode[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setMode(opt);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] text-ink-200 transition hover:bg-ink-825"
            >
              <span className="capitalize">{opt}</span>
              {opt === mode && <IconCheck size={11} className="text-ink-300" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
