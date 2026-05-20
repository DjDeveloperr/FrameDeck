"use client";

// Modal screenshot picker: lists existing shots from the project's shots/
// folder, lets the user upload a new file from disk. Selecting calls
// onSelect(path) where `path` is "shots/<filename>" relative to the project
// root — directly usable as the value of <Device screenshot="...">.

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../EditorContext";
import { Modal } from "./Popover";
import { IconPlus, IconX } from "../icons";

interface Shot {
  name: string;
  path: string;
  url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function ScreenshotPicker({ open, onClose, onSelect }: Props) {
  const { state } = useEditor();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${state.projectId}/shots`);
      const data = (await res.json()) as { shots: Shot[] };
      setShots(data.shots);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [state.projectId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${state.projectId}/shots`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as Shot;
      // Auto-pick the freshly-uploaded image.
      onSelect(data.path);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex h-[80vh] w-[92vw] max-w-[960px] flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-950 shadow-2xl shadow-black/60">
        <header className="flex shrink-0 items-center justify-between border-b border-ink-800 px-5 py-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink-50">Pick a screenshot</h3>
            <p className="text-[11.5px] text-ink-500">
              {loading ? "Loading…" : `${shots.length} in this project`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-825 hover:text-ink-100"
          >
            <IconX />
          </button>
        </header>

        <div className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-925 px-5 py-2.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-[12.5px] text-ink-100 transition hover:bg-ink-825">
            <IconPlus size={12} />
            {uploading ? "Uploading…" : "Upload from disk"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </label>
          <div className="text-[11px] text-ink-500">
            Files land in <code className="font-mono text-ink-400">projects/{state.projectId}/shots/</code>
          </div>
          {error && <div className="ml-auto text-[11.5px] text-red-300">{error}</div>}
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {shots.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="text-[13px] text-ink-300">No screenshots yet.</div>
              <div className="text-[11.5px] text-ink-500">
                Upload one from disk to get started.
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shots.map((s) => (
                <li key={s.path}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s.path);
                      onClose();
                    }}
                    className="group block w-full overflow-hidden rounded-lg border border-ink-800 bg-ink-900 text-left transition hover:border-ink-600 hover:bg-ink-875"
                  >
                    <div className="aspect-[9/19.5] overflow-hidden bg-ink-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.url}
                        alt={s.name}
                        draggable={false}
                        className="h-full w-full object-cover"
                        style={{ userSelect: "none" }}
                      />
                    </div>
                    <div className="space-y-0.5 p-2">
                      <div className="truncate text-[12px] text-ink-100">{s.name}</div>
                      <div className="truncate font-mono text-[10.5px] text-ink-500">{s.path}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
