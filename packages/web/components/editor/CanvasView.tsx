"use client";

// Multi-screen canvas surface.
//
// The active board is rendered as a free-form grid: one <ScreenFrame> per
// member screen, each at its (x, y) inside a shared transformed wrapper.
// One pan/zoom viewport spans the whole board.
//
// Editing state (editingPath, screenshot picker) is owned here and dispatched
// to the focused frame.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DeviceRegistry,
  boardBounds,
  type DeviceIndex,
  type ElementPath,
} from "@screendeck/core";
import { useEditor } from "./EditorContext";
import { useViewport } from "./canvas/useViewport";
import { ScreenFrame } from "./canvas/ScreenFrame";
import { ScreenshotPicker } from "./controls/ScreenshotPicker";
import { IconMaximize, IconMinus, IconPlus } from "./icons";

let cachedRegistry: DeviceRegistry | null = null;
let inflight: Promise<DeviceRegistry> | null = null;
function getRegistry(): Promise<DeviceRegistry> {
  if (cachedRegistry) return Promise.resolve(cachedRegistry);
  if (inflight) return inflight;
  inflight = fetch("/api/devices")
    .then((r) => r.json() as Promise<DeviceIndex>)
    .then((index) => (cachedRegistry = new DeviceRegistry("/api/assets", index)));
  return inflight;
}

const DEFAULT = { w: 1284, h: 2778 };

export function CanvasView() {
  const { state, activeBoard, focused, focusScreen, setAttrs } = useEditor();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewport = useViewport(stageRef);
  const [devices, setDevices] = useState<DeviceRegistry | null>(null);
  const [editingPath, setEditingPath] = useState<ElementPath | null>(null);
  const [pickerPath, setPickerPath] = useState<ElementPath | null>(null);

  useEffect(() => {
    getRegistry().then(setDevices);
  }, []);

  const baseUrl = `/api/projects/${state.projectId}/files`;

  // Resolve each screen's artwork size from its parsed AST (fallback when missing).
  const screenSize = useMemo(() => {
    return (name: string): { w: number; h: number } => {
      const s = state.screens[name];
      if (!s?.doc) return DEFAULT;
      const size = s.doc.root.attrs.size;
      if (!size) return DEFAULT;
      const m = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (!m) return DEFAULT;
      return { w: Number.parseInt(m[1]!, 10), h: Number.parseInt(m[2]!, 10) };
    };
  }, [state.screens]);

  const bounds = useMemo(() => {
    if (!activeBoard) return { width: DEFAULT.w, height: DEFAULT.h };
    if (activeBoard.screens.length === 0) return { width: DEFAULT.w, height: DEFAULT.h };
    return boardBounds(activeBoard, screenSize);
  }, [activeBoard, screenSize]);

  // On first mount / board switch, frame the FIRST screen at a readable size
  // rather than squeezing every screen into the viewport. The user can pan to
  // the others; the toolbar's Fit button still fits the whole board.
  useLayoutEffect(() => {
    const first = activeBoard?.screens[0];
    const focusSize = first ? screenSize(first.name) : null;
    const handle = window.requestAnimationFrame(() => {
      if (focusSize && first) {
        viewport.frameRect(
          { x: first.x, y: first.y, w: focusSize.w, h: focusSize.h },
          0.92,
        );
      } else {
        viewport.fitInstant(bounds.width, bounds.height);
      }
    });
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoard?.id]);

  // Clear editing/picker state when switching boards or focused screen.
  useEffect(() => {
    setEditingPath(null);
    setPickerPath(null);
  }, [activeBoard?.id, state.focusedScreen]);

  const onStagePointerDown = (e: React.PointerEvent) => {
    // Click on bare stage → unfocus everything (allows pan freely).
    if (e.target === e.currentTarget) {
      focusScreen(null);
    }
    viewport.onPointerDown(e);
  };

  const zoomPercent = Math.round(viewport.transform.scale * 100);
  const boardScreenNames = activeBoard?.screens.map((screen) => screen.name) ?? [];

  return (
    <div className="relative flex h-full w-full select-none flex-col bg-ink-1000">
      <div
        ref={stageRef}
        className="canvas-stage canvas-stage-bg relative flex-1 touch-none overflow-hidden"
        style={{ cursor: viewport.isPanning ? "grabbing" : "default" }}
        onPointerDown={onStagePointerDown}
        onPointerMove={viewport.onPointerMove}
        onPointerUp={viewport.onPointerUp}
        onPointerCancel={viewport.onPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate3d(${Math.round(viewport.transform.x)}px, ${Math.round(viewport.transform.y)}px, 0) scale(${viewport.transform.scale})`,
            width: bounds.width,
            height: bounds.height,
            backfaceVisibility: "hidden",
          }}
        >
          {activeBoard?.screens.map((entry) => {
            const size = screenSize(entry.name);
            return (
              <ScreenFrame
                key={screenFrameKey(entry.name, activeBoard.screens.map((s) => s.name))}
                boardId={activeBoard.id}
                screenName={entry.name}
                x={entry.x}
                y={entry.y}
                width={size.w}
                height={size.h}
                scale={viewport.transform.scale}
                devices={devices}
                baseUrl={baseUrl}
                editingPath={state.focusedScreen === entry.name ? editingPath : null}
                onBeginEdit={(p) => setEditingPath(p)}
                onEndEdit={() => setEditingPath(null)}
                onOpenScreenshotPicker={(p) => setPickerPath(p)}
                onExport={(name) => downloadScreen(state.projectId, name)}
              />
            );
          })}
          {activeBoard && activeBoard.screens.length === 0 && (
            <EmptyBoardHint scale={viewport.transform.scale} />
          )}
        </div>

        {activeBoard && boardScreenNames.length > 0 && (
          <div className="absolute left-4 top-4 flex select-none items-center gap-2">
            {focused && (
              <button
                type="button"
                onClick={() => downloadScreen(state.projectId, focused.name)}
                className="pointer-events-auto rounded-full bg-ink-925/85 px-3 py-1 text-[11px] font-medium text-ink-200 ring-1 ring-ink-800/80 backdrop-blur transition hover:bg-ink-825 hover:text-ink-50"
                title={`Export ${focused.name}`}
              >
                Export {focused.name}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void downloadAllScreens(state.projectId, boardScreenNames);
              }}
              className="pointer-events-auto rounded-full bg-ink-925/85 px-3 py-1 text-[11px] font-medium text-ink-200 ring-1 ring-ink-800/80 backdrop-blur transition hover:bg-ink-825 hover:text-ink-50"
              title="Export all screens on this board"
            >
              Export all
            </button>
          </div>
        )}

        <FloatingZoom
          zoomPercent={zoomPercent}
          onZoomIn={() => viewport.zoomBySmooth(1.2)}
          onZoomOut={() => viewport.zoomBySmooth(1 / 1.2)}
          onReset={() => viewport.setTransform({ x: 0, y: 0, scale: 1 })}
          onFit={() => viewport.fit(bounds.width, bounds.height)}
        />
      </div>

      <ScreenshotPicker
        open={pickerPath != null}
        onClose={() => setPickerPath(null)}
        onSelect={(path) => {
          if (!pickerPath || !focused) return;
          setAttrs(focused.name, pickerPath, { screenshot: path });
          setPickerPath(null);
        }}
      />
    </div>
  );
}

function downloadScreen(projectId: string, screenName: string): void {
  const a = document.createElement("a");
  a.href = `/api/projects/${projectId}/render/${encodeURIComponent(screenName)}.png`;
  a.download = `${screenName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function screenFrameKey(name: string, boardNames: string[]): string {
  const key = screenIdentity(name);
  const count = boardNames.filter((candidate) => screenIdentity(candidate) === key).length;
  return count === 1 ? key : name;
}

function screenIdentity(name: string): string {
  return name.replace(/^\d+[-_\s]+/, "");
}

export async function downloadAllScreens(projectId: string, names: string[]): Promise<void> {
  for (const name of names) {
    downloadScreen(projectId, name);
    await new Promise((r) => setTimeout(r, 200));
  }
}

function EmptyBoardHint({ scale }: { scale: number }) {
  return (
    <div
      className="absolute left-0 top-0 flex select-none items-center justify-center text-center"
      style={{
        width: 1284,
        height: 2778,
        outline: `${4 / scale}px dashed rgba(255,255,255,0.12)`,
        borderRadius: 24 / scale,
      }}
    >
      <div className="rounded-full bg-ink-925/85 px-5 py-2 font-mono text-[14px] text-ink-400 ring-1 ring-ink-800 backdrop-blur" style={{ transform: `scale(${1 / Math.max(scale, 0.05)})` }}>
        Empty board — add a screen from the tree.
      </div>
    </div>
  );
}

interface FloatingZoomProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

function FloatingZoom({ zoomPercent, onZoomIn, onZoomOut, onReset, onFit }: FloatingZoomProps) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-800 hover:text-ink-50";
  // Stop pointerdown from bubbling to the stage — the stage calls
  // setPointerCapture, which redirects subsequent pointerup events away from
  // our buttons and prevents them from firing a click.
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  return (
    <div
      onPointerDown={stop}
      onMouseDown={stop}
      className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 select-none items-center gap-0.5 rounded-full border border-ink-800/80 bg-ink-925/95 p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur">
      <button type="button" onClick={onZoomOut} className={btn} title="Zoom out" aria-label="Zoom out">
        <IconMinus />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="h-7 min-w-[4rem] rounded-full px-2 font-mono text-[11.5px] tabular-nums text-ink-200 transition hover:bg-ink-800 hover:text-ink-50"
        title="Reset to 100%"
      >
        {zoomPercent}%
      </button>
      <button type="button" onClick={onZoomIn} className={btn} title="Zoom in" aria-label="Zoom in">
        <IconPlus />
      </button>
      <div className="mx-1 h-4 w-px bg-ink-800" />
      <button type="button" onClick={onFit} className={btn} title="Fit to window" aria-label="Fit to window">
        <IconMaximize />
      </button>
    </div>
  );
}
