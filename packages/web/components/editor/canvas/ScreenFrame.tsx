"use client";

// One screen's frame on the multi-screen canvas.
//
// Each ScreenFrame owns its own <canvas>, layout, and SelectionLayer. The
// SelectionLayer is always mounted; when its screen isn't the focused one a
// pointerdown inside an element focuses the screen and selects the element
// in a single tap.
//
// To reposition a frame on the board, drag its header label (above the
// artwork). This is reachable regardless of focus state and never conflicts
// with element interactions.

import { useEffect, useRef, useState } from "react";
import { type DeviceRegistry, type ElementPath } from "framedeck-core";
import { renderDocument, layoutDocument, type ElementBox, type ImageLike } from "framedeck-renderer";
import { webBackend } from "framedeck-renderer/web";
import { useEditor } from "../EditorContext";
import { SelectionLayer } from "./SelectionLayer";
import { IconDuplicate, IconTrash } from "../icons";

interface Props {
  boardId: string;
  screenName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  devices: DeviceRegistry | null;
  baseUrl: string;
  editingPath: ElementPath | null;
  onBeginEdit: (path: ElementPath) => void;
  onEndEdit: () => void;
  onOpenScreenshotPicker: (path: ElementPath) => void;
  onExport: (name: string) => void;
}

const DRAG_THRESHOLD = 4;

export function ScreenFrame({
  boardId,
  screenName,
  x,
  y,
  width,
  height,
  scale,
  devices,
  baseUrl,
  editingPath,
  onBeginEdit,
  onEndEdit,
  onOpenScreenshotPicker,
  onExport,
}: Props) {
  const {
    state,
    loadScreen,
    moveScreenInBoard,
    duplicateScreen,
    removeScreenFromBoard,
  } = useEditor();
  const screen = state.screens[screenName];
  const assetRevision = state.assetRevision;
  const isFocused = state.focusedScreen === screenName;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, ImageLike>>(new Map());
  const lastAssetRevisionRef = useRef(assetRevision);
  const renderVersionRef = useRef(0);
  const [layout, setLayout] = useState<ElementBox | null>(null);

  useEffect(() => {
    let cancelled = false;
    const version = ++renderVersionRef.current;
    if (!screen?.doc || !devices) return;
    if (lastAssetRevisionRef.current !== assetRevision) {
      imageCacheRef.current.clear();
      lastAssetRevisionRef.current = assetRevision;
    }
    (async () => {
      try {
        const rendered = await renderDocument(screen.doc!, {
          backend: webBackend,
          baseDir: baseUrl,
          devices,
          skipPath: isFocused && editingPath ? editingPath : undefined,
          images: imageCacheRef.current,
        });
        if (cancelled || version !== renderVersionRef.current) return;
        const box = await layoutDocument(screen.doc!, {
          backend: webBackend,
          baseDir: baseUrl,
          devices,
        });
        if (cancelled || version !== renderVersionRef.current) return;

        const canvas = canvasRef.current;
        const target = canvas?.getContext("2d");
        if (!canvas || !target) return;
        if (canvas.width !== rendered.width) canvas.width = rendered.width;
        if (canvas.height !== rendered.height) canvas.height = rendered.height;
        target.clearRect(0, 0, canvas.width, canvas.height);
        target.drawImage(rendered as unknown as CanvasImageSource, 0, 0);
        setLayout(box);
      } catch {
        /* ignored */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen?.doc, devices, baseUrl, isFocused, editingPath, assetRevision]);

  useEffect(() => {
    if (!screen || screen.loaded) return;
    loadScreen(screenName).catch(() => {});
  }, [screen, screenName, loadScreen]);

  if (!screen) return null;

  return (
    <div className="absolute" style={{ left: x, top: y, width, height }} data-screen={screenName}>
      <FrameHeader
        boardId={boardId}
        screenName={screenName}
        x={x}
        y={y}
        dirty={screen.dirty}
        scale={scale}
        onExport={() => onExport(screenName)}
        onDuplicate={async () => {
          await duplicateScreen(screenName, boardId);
        }}
        onRemove={() => removeScreenFromBoard(boardId, screenName)}
        onMove={(nx, ny) => moveScreenInBoard(boardId, screenName, nx, ny)}
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          contain: "layout size",
          boxShadow: isFocused
            ? "0 60px 120px -40px rgba(0,0,0,0.75)"
            : "0 30px 60px -30px rgba(0,0,0,0.55)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block h-full w-full bg-white"
          style={{
            // Tell the GPU compositor the canvas is a discrete pixel layer so
            // its right/bottom edges never anti-alias into a hairline at
            // sub-integer transforms.
            imageRendering: "pixelated",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
          }}
        />

        <SelectionLayer
          screenName={screenName}
          isFocused={isFocused}
          layout={layout}
          scale={scale}
          canvasWidth={width}
          canvasHeight={height}
          editingPath={isFocused ? editingPath : null}
          onBeginEdit={onBeginEdit}
          onEndEdit={onEndEdit}
          onOpenScreenshotPicker={onOpenScreenshotPicker}
        />

        {isFocused && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ outline: `${2 / scale}px solid #ffffff`, outlineOffset: `${4 / scale}px` }}
          />
        )}
      </div>
    </div>
  );
}

interface HeaderProps {
  boardId: string;
  screenName: string;
  x: number;
  y: number;
  dirty: boolean;
  scale: number;
  onExport: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (x: number, y: number) => void;
}

function FrameHeader({
  screenName,
  x,
  y,
  dirty,
  scale,
  onExport,
  onDuplicate,
  onRemove,
  onMove,
}: HeaderProps) {
  // Scale the label proportionally to a clamp window: between 0.4× and 1.4×
  // the canvas scale. This keeps labels readable when zoomed out and
  // proportionate when zoomed in (no enormous label spam at fit-to-window).
  const labelScale = clamp(1 / scale, 0.7, 2.5);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dxs = e.clientX - d.sx;
    const dys = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dxs, dys) < DRAG_THRESHOLD) return;
    d.moved = true;
    onMove(Math.round(d.ox + dxs / scale), Math.round(d.oy + dys / scale));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div
      className="absolute left-0"
      style={{
        top: 0,
        transform: `translateY(calc(-100% - ${8 * labelScale}px)) scale(${labelScale})`,
        transformOrigin: "bottom left",
      }}
    >
      <div className="group flex items-center gap-2">
        <span
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="cursor-grab select-none font-mono text-[24px] text-ink-400 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          title="Drag to reposition this screen"
        >
          {screenName}
          {dirty && <span className="ml-2 text-ink-500">•</span>}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onExport}
            className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-ink-300 transition hover:bg-ink-825 hover:text-ink-50"
            title="Export PNG"
          >
            Export
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDuplicate}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-ink-825 hover:text-ink-100"
            title="Duplicate screen"
          >
            <IconDuplicate size={11} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-red-950 hover:text-red-200"
            title="Remove from board"
          >
            <IconTrash size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
