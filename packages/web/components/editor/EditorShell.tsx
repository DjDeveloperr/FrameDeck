"use client";

// Three-column editor layout with resizable side panels.
//   visual mode: tree | canvas | inspector
//   code mode:   tree | (code | canvas) | inspector

import { useEffect, useRef, useState } from "react";
import { useEditor } from "./EditorContext";
import { Tabs } from "./Tabs";
import { ElementsTree } from "./ElementsTree";
import { Inspector } from "./Inspector";
import { CanvasView } from "./CanvasView";
import { CodeView } from "./CodeView";

const TREE_KEY = "framedeck:tree-width";
const INSP_KEY = "framedeck:inspector-width";
const TREE_OPEN_KEY = "framedeck:tree-open";
const INSP_OPEN_KEY = "framedeck:inspector-open";
const TREE_MIN = 220;
const TREE_MAX = 520;
const INSP_MIN = 240;
const INSP_MAX = 520;

interface Props {
  projectName: string;
}

export function EditorShell({ projectName }: Props) {
  const { state } = useEditor();
  const codeMode = state.viewMode === "code";
  const [treeWidth, setTreeWidth] = usePersistentWidth(TREE_KEY, 280, TREE_MIN, TREE_MAX);
  const [inspWidth, setInspWidth] = usePersistentWidth(INSP_KEY, 296, INSP_MIN, INSP_MAX);
  const [treeOpen, setTreeOpen] = usePersistentBoolean(TREE_OPEN_KEY, true);
  const [inspOpen, setInspOpen] = usePersistentBoolean(INSP_OPEN_KEY, true);

  return (
    <div className="editor-chrome flex h-full min-h-0 flex-1 flex-col">
      <Tabs
        projectName={projectName}
        leftSidebarOpen={treeOpen}
        rightSidebarOpen={inspOpen}
        onToggleLeftSidebar={() => setTreeOpen((open) => !open)}
        onToggleRightSidebar={() => setInspOpen((open) => !open)}
      />
      <div className="flex h-full min-h-0 flex-1">
        <div
          style={{
            width: treeOpen ? treeWidth : 0,
            flexBasis: treeOpen ? treeWidth : 0,
            flexGrow: 0,
            flexShrink: 0,
          }}
          className="min-w-0 overflow-hidden transition-[width,flex-basis] duration-200 ease-out"
          aria-hidden={!treeOpen}
        >
          <div style={{ width: treeWidth }} className="h-full">
            {treeOpen && <ElementsTree />}
          </div>
        </div>
        {treeOpen && <Resizer onResize={(dx) => setTreeWidth((w) => clamp(w + dx, TREE_MIN, TREE_MAX))} />}

        <main className="flex h-full min-h-0 flex-1">
          {codeMode ? (
            <div className="grid h-full min-h-0 w-full grid-cols-2">
              <div className="min-w-0 border-r border-ink-800">
                <CodeView />
              </div>
              <div className="min-w-0">
                <CanvasView />
              </div>
            </div>
          ) : (
            <CanvasView />
          )}
        </main>

        {inspOpen && <Resizer onResize={(dx) => setInspWidth((w) => clamp(w - dx, INSP_MIN, INSP_MAX))} />}
        <div
          style={{
            width: inspOpen ? inspWidth : 0,
            flexBasis: inspOpen ? inspWidth : 0,
            flexGrow: 0,
            flexShrink: 0,
          }}
          className="min-w-0 overflow-hidden transition-[width,flex-basis] duration-200 ease-out"
          aria-hidden={!inspOpen}
        >
          <div style={{ width: inspWidth }} className="h-full">
            {inspOpen && <Inspector />}
          </div>
        </div>
      </div>
    </div>
  );
}

function usePersistentWidth(
  key: string,
  initial: number,
  min: number,
  max: number,
): [number, (updater: (w: number) => number) => void] {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const n = Number.parseFloat(stored);
      if (Number.isFinite(n)) setWidth(clamp(n, min, max));
    }
  }, [key, min, max]);
  const setter = (updater: (w: number) => number) => {
    setWidth((prev) => {
      const next = clamp(updater(prev), min, max);
      window.localStorage.setItem(key, String(next));
      return next;
    });
  };
  return [width, setter];
}

function usePersistentBoolean(
  key: string,
  initial: boolean,
): [boolean, (updater: (value: boolean) => boolean) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored === "true" || stored === "false") {
      setValue(stored === "true");
    }
  }, [key]);
  const setter = (updater: (value: boolean) => boolean) => {
    setValue((prev) => {
      const next = updater(prev);
      window.localStorage.setItem(key, String(next));
      return next;
    });
  };
  return [value, setter];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function Resizer({ onResize }: { onResize: (dx: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startX: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    ref.current?.classList.add("is-active");
    document.body.style.cursor = "col-resize";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (dx === 0) return;
    d.startX = e.clientX;
    onResize(dx);
  };
  const onPointerUp = () => {
    drag.current = null;
    ref.current?.classList.remove("is-active");
    document.body.style.cursor = "";
  };

  return (
    <div
      ref={ref}
      className="resizer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
