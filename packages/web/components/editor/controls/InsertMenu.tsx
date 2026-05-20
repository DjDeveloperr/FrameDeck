"use client";

import { useState } from "react";
import { ELEMENT_MENU } from "framedeck-core";
import { Modal } from "./Popover";

interface Props {
  onPick: (tag: string) => void;
  children: (open: () => void) => React.ReactNode;
}

export function InsertMenu({ onPick, children }: Props) {
  const [open, setOpen] = useState(false);
  const groups = ["Content", "Layout", "Surface"] as const;
  return (
    <>
      {children(() => setOpen(true))}
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="w-[460px] overflow-hidden rounded-xl border border-ink-800 bg-ink-950 shadow-2xl shadow-black/60">
          <header className="border-b border-ink-800 px-5 py-3">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Insert element</div>
            <h3 className="text-[15px] font-semibold text-ink-50">Pick one to add</h3>
          </header>
          <div className="space-y-3 p-3">
            {groups.map((group) => {
              const entries = ELEMENT_MENU.filter((e) => e.group === group);
              if (entries.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                    {group}
                  </div>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {entries.map((e) => (
                      <li key={e.tag}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onPick(e.tag);
                          }}
                          className="block w-full rounded-md border border-ink-800 bg-ink-900 p-3 text-left transition hover:border-ink-600 hover:bg-ink-875"
                        >
                          <div className="font-mono text-[13px] font-medium text-ink-100">{e.tag}</div>
                          <div className="text-[11.5px] text-ink-500">{e.description}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
