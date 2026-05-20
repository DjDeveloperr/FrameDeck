"use client";

// Overlay for one screen — scoped by `screenName`. Renders:
//   • A clickable hit-test region per element (drives selection).
//   • A persistent selection ring + 8 resize handles + drag-to-move body.
//   • An inline <textarea> Text editor (canvas hides that element via skipPath).
//   • Forwards screenshot-picker requests on <Device> double-click.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  pathEquals,
  pathStartsWith,
  resolvePath,
  type ElementPath,
  type ScreenDocument,
} from "@framedeck/core";
import type { ElementBox } from "@framedeck/renderer";
import { useEditor } from "../EditorContext";

interface Props {
  screenName: string;
  isFocused: boolean;
  layout: ElementBox | null;
  /** Current view scale; handles draw at the inverse scale to stay constant on screen. */
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  editingPath: ElementPath | null;
  onBeginEdit: (path: ElementPath) => void;
  onEndEdit: () => void;
  onOpenScreenshotPicker: (path: ElementPath) => void;
}

type DragKind = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface DragState {
  kind: DragKind;
  path: ElementPath;
  startRect: { x: number; y: number; width: number; height: number };
  parentOffset: { x: number; y: number };
  startPointer: { x: number; y: number };
  moved: boolean;
  /** When non-null, resizes lock to this aspect ratio (width / height).
   * Devices use their native bezel ratio so they never get squished. */
  aspectLock: number | null;
}

const DRAG_THRESHOLD = 4;

export function SelectionLayer({
  screenName,
  isFocused,
  layout,
  scale,
  canvasWidth,
  canvasHeight,
  editingPath,
  onBeginEdit,
  onEndEdit,
  onOpenScreenshotPicker,
}: Props) {
  const {
    state,
    select,
    selectMany,
    clearSelection,
    focusScreen,
    setAttrs,
    setText,
    beginTransaction,
    commitTransaction,
  } = useEditor();
  const screen = state.screens[screenName];
  const [hover, setHover] = useState<ElementPath | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragHint, setDragHint] = useState<{ w: number; h: number } | null>(null);
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    addMode: boolean;
    initialPaths: ElementPath[];
  } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Alignment guides that should be visible during the current drag.
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
    vertical: [],
    horizontal: [],
  });

  // Hoist every hook above any early return so React sees a stable call order.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const boxes = useMemo(() => (layout ? flatten(layout) : []), [layout]);
  // Snapshot the selection lists with safe fallbacks; final visibility is
  // gated on `isFocused` and on `screen` existing.
  const screenPaths: ElementPath[] = screen?.selectedPaths ?? [];
  const screenPrimary: ElementPath = screen?.selectedPath ?? ([] as ElementPath);
  const selectedKeys = useMemo(
    () => new Set(screenPaths.map((p) => p.join("."))),
    [screenPaths],
  );

  if (!screen || !layout) return null;
  const selectedPaths = isFocused ? screenPaths : [];
  const primary = isFocused ? screenPrimary : ([] as ElementPath);
  const primaryBox = boxes.find((b) => pathEquals(b.path, primary));

  function lookupParentRect(path: ElementPath): { x: number; y: number; width: number; height: number } {
    if (path.length === 0) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    const parentPath = path.slice(0, -1);
    const parent = boxes.find((b) => pathEquals(b.path, parentPath));
    return parent?.rect ?? { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  }

  const beginInteraction = (e: React.PointerEvent, box: ElementBox) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (!isFocused) focusScreen(screenName);
    const start = { ...box.rect };
    const parent = lookupParentRect(box.path);
    dragRef.current = {
      kind: "move",
      path: box.path,
      startRect: start,
      parentOffset: { x: parent.x, y: parent.y },
      startPointer: { x: e.clientX, y: e.clientY },
      moved: false,
      aspectLock: aspectLockFor(box),
    };
  };

  const onPointerMoveBox = (e: React.PointerEvent, box: ElementBox) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startPointer.x;
    const dy = e.clientY - drag.startPointer.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      if (!pathEquals(drag.path, primary)) {
        select(screenName, drag.path);
        dragRef.current = null;
        return;
      }
      beginTransaction(screenName);
    }
    applyDrag(drag, dx, dy, e.shiftKey);
    void box;
  };

  const onPointerUpBox = (e: React.PointerEvent, box: ElementBox) => {
    const drag = dragRef.current;
    if (!drag) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (!drag.moved) {
      // ⌘/Ctrl click toggles; Shift click adds (Figma convention).
      const mode = e.metaKey || e.ctrlKey ? "toggle" : e.shiftKey ? "add" : "replace";
      select(screenName, box.path, mode);
    } else {
      commitTransaction(screenName);
    }
    dragRef.current = null;
    setDragHint(null);
    setGuides({ vertical: [], horizontal: [] });
  };

  const onDoubleClickBox = (e: React.MouseEvent, box: ElementBox) => {
    if (box.tag === "Text") {
      e.stopPropagation();
      e.preventDefault();
      select(screenName, box.path);
      onBeginEdit(box.path);
    } else if (box.tag === "Device") {
      e.stopPropagation();
      e.preventDefault();
      select(screenName, box.path);
      onOpenScreenshotPicker(box.path);
    }
  };

  const startHandleDrag = (e: React.PointerEvent, kind: DragKind) => {
    if (!primaryBox || primary.length === 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const start = { ...primaryBox.rect };
    const parent = lookupParentRect(primary);
    dragRef.current = {
      kind,
      path: primary,
      startRect: start,
      parentOffset: { x: parent.x, y: parent.y },
      startPointer: { x: e.clientX, y: e.clientY },
      moved: true,
      aspectLock: aspectLockFor(primaryBox),
    };
    beginTransaction(screenName);
    setDragHint({ w: Math.round(start.width), h: Math.round(start.height) });
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startPointer.x;
    const dy = e.clientY - drag.startPointer.y;
    applyDrag(drag, dx, dy, e.shiftKey);
  };

  const onHandleUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    commitTransaction(screenName);
    dragRef.current = null;
    setDragHint(null);
    setGuides({ vertical: [], horizontal: [] });
  };

  function applyDrag(drag: DragState, dxScreen: number, dyScreen: number, shiftKey = false) {
    const dx = dxScreen / scale;
    const dy = dyScreen / scale;
    let next = transformedRect(drag, dx, dy);

    // Aspect-lock resizes: Devices (and Shape kind="circle") always lock to
    // their starting ratio so a phone never gets squished. Holding Shift
    // engages the same lock on any element.
    if (drag.kind !== "move") {
      const aspect =
        drag.aspectLock ??
        (shiftKey ? drag.startRect.width / Math.max(1, drag.startRect.height) : null);
      if (aspect != null && Number.isFinite(aspect) && aspect > 0) {
        next = lockAspect(drag, next, aspect);
      }
    }

    if (drag.kind === "move") {
      const snapPx = Math.max(2, 6 / scale);
      const targetsX = collectVerticalTargets(boxes, drag.path, canvasWidth);
      const targetsY = collectHorizontalTargets(boxes, drag.path, canvasHeight);
      const snap = applySnap(next, targetsX, targetsY, snapPx);
      next = snap.rect;
      setGuides({ vertical: snap.guidesX, horizontal: snap.guidesY });
    } else {
      setGuides({ vertical: [], horizontal: [] });
    }

    setDragHint({ w: Math.round(next.width), h: Math.round(next.height) });
    const rel = {
      x: Math.round(next.x - drag.parentOffset.x),
      y: Math.round(next.y - drag.parentOffset.y),
      width: Math.round(next.width),
      height: Math.round(next.height),
    };
    if (drag.kind === "move") {
      setAttrs(screenName, drag.path, {
        position: "absolute",
        x: String(rel.x),
        y: String(rel.y),
        left: undefined, top: undefined, right: undefined, bottom: undefined,
      }, { transient: true });
    } else {
      const patch: Record<string, string | undefined> = {
        width: String(rel.width),
        height: String(rel.height),
      };
      if (drag.kind.includes("n") || drag.kind.includes("w")) {
        patch.position = "absolute";
        patch.x = String(rel.x);
        patch.y = String(rel.y);
        patch.left = undefined;
        patch.top = undefined;
      }
      setAttrs(screenName, drag.path, patch, { transient: true });
    }
  }

  // ── Screen-root catch (handles empty-area clicks + marquee drags) ────────
  function clientToArtwork(e: React.PointerEvent | PointerEvent): { x: number; y: number } {
    const c = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  const onRootDown = (e: React.PointerEvent) => {
    if (!isFocused) {
      focusScreen(screenName);
      return;
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = clientToArtwork(e);
    marqueeRef.current = {
      startX: p.x,
      startY: p.y,
      addMode: e.metaKey || e.ctrlKey || e.shiftKey,
      initialPaths: screen.selectedPaths,
    };
  };

  const onRootMove = (e: React.PointerEvent) => {
    const m = marqueeRef.current;
    if (!m) return;
    const p = clientToArtwork(e);
    const x = Math.min(m.startX, p.x);
    const y = Math.min(m.startY, p.y);
    const w = Math.abs(p.x - m.startX);
    const h = Math.abs(p.y - m.startY);
    setMarquee({ x, y, w, h });
  };

  const onRootUp = (e: React.PointerEvent) => {
    const m = marqueeRef.current;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (!m) return;
    const drew = marquee != null && (marquee.w > 4 || marquee.h > 4);
    if (!drew) {
      // Tap on empty area: clear selection on this screen (unless adding).
      if (!m.addMode) clearSelection(screenName);
    } else {
      // Pick all content elements whose bbox intersects the marquee rect.
      const sel = collectMarqueeHits(boxes, marquee!);
      const next = m.addMode
        ? mergePaths(m.initialPaths, sel)
        : sel;
      selectMany(screenName, next);
    }
    marqueeRef.current = null;
    setMarquee(null);
  };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {/* Screen-root catch — rendered first so element hit boxes paint on top. */}
      <div
        onPointerDown={onRootDown}
        onPointerMove={onRootMove}
        onPointerUp={onRootUp}
        onPointerCancel={onRootUp}
        className="pointer-events-auto absolute inset-0"
        style={{
          background: "rgba(255,255,255,0.001)",
          cursor: isFocused ? "default" : "pointer",
          touchAction: "none",
        }}
      />

      {boxes.map((box) => {
        if (pathEquals(box.path, [])) return null;
        if (box.rect.width < 1 || box.rect.height < 1) return null;
        const isSelected = isFocused && selectedKeys.has(box.path.join("."));
        const isPrimary = isFocused && pathEquals(box.path, primary);
        const isHovered = isFocused && !!hover && pathEquals(hover, box.path);
        const isAncestorOfSelected =
          isFocused && selectedPaths.some((sp) => pathStartsWith(sp, box.path) && !pathEquals(sp, box.path));
        const isEditing = editingPath ? pathEquals(editingPath, box.path) : false;
        if (isEditing) return null;
        return (
          <div
            key={box.path.join(".")}
            data-path={box.path.join(".")}
            data-tag={box.tag}
            onPointerDown={(e) => beginInteraction(e, box)}
            onPointerMove={(e) => onPointerMoveBox(e, box)}
            onPointerUp={(e) => onPointerUpBox(e, box)}
            onPointerCancel={(e) => onPointerUpBox(e, box)}
            onPointerEnter={() => setHover(box.path)}
            onPointerLeave={() => setHover((p) => (p && pathEquals(p, box.path) ? null : p))}
            onDoubleClick={(e) => onDoubleClickBox(e, box)}
            className="pointer-events-auto absolute"
            style={{
              left: box.rect.x,
              top: box.rect.y,
              width: box.rect.width,
              height: box.rect.height,
              background: "rgba(255,255,255,0.001)",
              outline:
                isSelected
                  ? `${2 / scale}px solid #ffffff`
                  : isHovered && !isAncestorOfSelected
                    ? `${1.5 / scale}px solid rgba(255,255,255,0.55)`
                    : "none",
              outlineOffset: 0,
              cursor: box.tag === "Text" ? "text" : isSelected ? "move" : "pointer",
              touchAction: "none",
            }}
          />
        );
      })}

      {isFocused && editingPath && screen.doc && (
        <TextEditor
          key={editingPath.join(".")}
          screenName={screenName}
          path={editingPath}
          box={boxes.find((b) => pathEquals(b.path, editingPath)) ?? null}
          doc={screen.doc}
          scale={scale}
          onCommit={(value) => {
            setText(screenName, editingPath, value);
            onEndEdit();
          }}
          onCancel={onEndEdit}
        />
      )}

      {isFocused && primaryBox && selectedPaths.length === 1 && (
        <Handles
          box={primaryBox}
          scale={scale}
          onPointerDownHandle={startHandleDrag}
          onPointerMoveHandle={onHandleMove}
          onPointerUpHandle={onHandleUp}
        />
      )}

      {/* Alignment guides — thin red lines while dragging. */}
      {guides.vertical.map((x, i) => (
        <div
          key={`gv-${i}-${x}`}
          className="pointer-events-none absolute"
          style={{
            left: x - 0.5 / scale,
            top: 0,
            width: 1 / scale,
            height: canvasHeight,
            background: "#ff3b30",
            opacity: 0.9,
          }}
        />
      ))}
      {guides.horizontal.map((y, i) => (
        <div
          key={`gh-${i}-${y}`}
          className="pointer-events-none absolute"
          style={{
            left: 0,
            top: y - 0.5 / scale,
            width: canvasWidth,
            height: 1 / scale,
            background: "#ff3b30",
            opacity: 0.9,
          }}
        />
      ))}

      {/* Live marquee rectangle. */}
      {marquee && (marquee.w > 1 || marquee.h > 1) && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            background: "rgba(120, 170, 255, 0.12)",
            outline: `${1 / scale}px solid rgba(120, 170, 255, 0.9)`,
            outlineOffset: 0,
          }}
        />
      )}

      {primaryBox && dragHint && (
        <div
          className="pointer-events-none absolute rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink-950 shadow"
          style={{
            left: primaryBox.rect.x,
            top: primaryBox.rect.y,
            transform: `scale(${1 / scale}) translateY(-110%)`,
            transformOrigin: "top left",
          }}
        >
          {dragHint.w} × {dragHint.h}
        </div>
      )}
    </div>
  );
}

/**
 * Pick an aspect ratio (width / height) that the element should never break
 * during a resize drag.
 *   • Device  — uses the box's current ratio (which Yoga has already
 *               clamped to the native bezel ratio via setAspectRatio).
 *   • Shape kind="circle"/"ellipse" — 1:1.
 *   • everything else — free, unless the user holds Shift mid-drag.
 */
function aspectLockFor(box: ElementBox): number | null {
  if (box.tag === "Device") {
    return box.rect.width / Math.max(1, box.rect.height);
  }
  return null;
}

function lockAspect(
  drag: DragState,
  next: { x: number; y: number; width: number; height: number },
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  const { kind, startRect } = drag;
  const horizontal = kind.includes("e") || kind.includes("w");
  const vertical = kind.includes("n") || kind.includes("s");
  let { x, y, width, height } = next;

  if (horizontal && vertical) {
    // Corner — anchor the OPPOSITE corner. The axis with the larger relative
    // delta drives; the other follows the aspect ratio.
    const dW = Math.abs(width - startRect.width);
    const dH = Math.abs(height - startRect.height) * aspect;
    if (dW >= dH) height = width / aspect;
    else width = height * aspect;
    x = kind.includes("w") ? startRect.x + startRect.width - width : startRect.x;
    y = kind.includes("n") ? startRect.y + startRect.height - height : startRect.y;
  } else if (horizontal) {
    // E or W edge — derive height, keep midline Y stable so the locked
    // dimension grows symmetrically about the original center.
    const midY = startRect.y + startRect.height / 2;
    height = width / aspect;
    y = midY - height / 2;
  } else if (vertical) {
    const midX = startRect.x + startRect.width / 2;
    width = height * aspect;
    x = midX - width / 2;
  }

  return { x, y, width, height };
}

// Elements eligible for marquee selection — exclude bare containers so the
// user gets useful targets, not the parent VStack that contains everything.
const CONTENT_TAGS = new Set(["Text", "Image", "Device", "Shape"]);

function collectMarqueeHits(
  boxes: ElementBox[],
  rect: { x: number; y: number; w: number; h: number },
): ElementPath[] {
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const out: ElementPath[] = [];
  for (const box of boxes) {
    if (!CONTENT_TAGS.has(box.tag)) continue;
    const bx2 = box.rect.x + box.rect.width;
    const by2 = box.rect.y + box.rect.height;
    const intersects = !(x2 < box.rect.x || rect.x > bx2 || y2 < box.rect.y || rect.y > by2);
    if (intersects) out.push(box.path);
  }
  return out;
}

interface SnapTarget {
  /** Axis position in artwork coords. */
  value: number;
  /** Where on the dragged rect this target applies: left/center/right (for X)
   * or top/center/bottom (for Y). */
  edge: "start" | "center" | "end";
}

function collectVerticalTargets(
  boxes: ElementBox[],
  draggedPath: ElementPath,
  canvasWidth: number,
): SnapTarget[] {
  const draggedKey = draggedPath.join(".");
  const out: SnapTarget[] = [
    { value: 0, edge: "start" },
    { value: canvasWidth / 2, edge: "center" },
    { value: canvasWidth, edge: "end" },
  ];
  for (const b of boxes) {
    if (b.path.length === 0) continue;
    if (b.path.join(".") === draggedKey) continue;
    // Skip ancestors of the dragged element — snapping against your own
    // container would feel sticky.
    if (pathStartsWith(draggedPath, b.path)) continue;
    const left = b.rect.x;
    const right = b.rect.x + b.rect.width;
    out.push({ value: left, edge: "start" });
    out.push({ value: right, edge: "end" });
    out.push({ value: (left + right) / 2, edge: "center" });
  }
  return out;
}

function collectHorizontalTargets(
  boxes: ElementBox[],
  draggedPath: ElementPath,
  canvasHeight: number,
): SnapTarget[] {
  const draggedKey = draggedPath.join(".");
  const out: SnapTarget[] = [
    { value: 0, edge: "start" },
    { value: canvasHeight / 2, edge: "center" },
    { value: canvasHeight, edge: "end" },
  ];
  for (const b of boxes) {
    if (b.path.length === 0) continue;
    if (b.path.join(".") === draggedKey) continue;
    if (pathStartsWith(draggedPath, b.path)) continue;
    const top = b.rect.y;
    const bottom = b.rect.y + b.rect.height;
    out.push({ value: top, edge: "start" });
    out.push({ value: bottom, edge: "end" });
    out.push({ value: (top + bottom) / 2, edge: "center" });
  }
  return out;
}

interface SnapResult {
  rect: { x: number; y: number; width: number; height: number };
  guidesX: number[];
  guidesY: number[];
}

function applySnap(
  rect: { x: number; y: number; width: number; height: number },
  targetsX: SnapTarget[],
  targetsY: SnapTarget[],
  threshold: number,
): SnapResult {
  // For each axis we try snapping any of the rect's three reference points
  // (start / center / end) to any candidate target. The closest match within
  // the threshold wins; ties break toward the strongest signal (center > edge).
  const sx = pickBestSnap(rect.x, rect.x + rect.width / 2, rect.x + rect.width, targetsX, threshold);
  const sy = pickBestSnap(rect.y, rect.y + rect.height / 2, rect.y + rect.height, targetsY, threshold);

  return {
    rect: {
      x: rect.x + (sx?.delta ?? 0),
      y: rect.y + (sy?.delta ?? 0),
      width: rect.width,
      height: rect.height,
    },
    guidesX: sx ? [sx.guide] : [],
    guidesY: sy ? [sy.guide] : [],
  };
}

interface Pick {
  delta: number;
  guide: number;
}

function pickBestSnap(
  start: number,
  center: number,
  end: number,
  targets: SnapTarget[],
  threshold: number,
): Pick | null {
  let best: { delta: number; abs: number; guide: number; priority: number } | null = null;
  for (const t of targets) {
    const candidates: { edgeValue: number; priority: number }[] = [
      { edgeValue: start, priority: 1 },
      { edgeValue: center, priority: 2 }, // center > edge
      { edgeValue: end, priority: 1 },
    ];
    for (const c of candidates) {
      const delta = t.value - c.edgeValue;
      const abs = Math.abs(delta);
      if (abs > threshold) continue;
      if (
        !best ||
        c.priority > best.priority ||
        (c.priority === best.priority && abs < best.abs)
      ) {
        best = { delta, abs, guide: t.value, priority: c.priority };
      }
    }
  }
  return best ? { delta: best.delta, guide: best.guide } : null;
}

function mergePaths(existing: ElementPath[], add: ElementPath[]): ElementPath[] {
  const seen = new Set(existing.map((p) => p.join(".")));
  const out = existing.slice();
  for (const p of add) {
    const k = p.join(".");
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

function flatten(box: ElementBox): ElementBox[] {
  const out: ElementBox[] = [];
  function walk(b: ElementBox) {
    out.push(b);
    for (const c of b.children) walk(c);
  }
  walk(box);
  return out;
}

function transformedRect(
  drag: DragState,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  const { kind, startRect } = drag;
  if (kind === "move") {
    return { ...startRect, x: startRect.x + dx, y: startRect.y + dy };
  }
  let { x, y, width, height } = startRect;
  if (kind.includes("e")) width = Math.max(1, startRect.width + dx);
  if (kind.includes("w")) {
    width = Math.max(1, startRect.width - dx);
    x = startRect.x + (startRect.width - width);
  }
  if (kind.includes("s")) height = Math.max(1, startRect.height + dy);
  if (kind.includes("n")) {
    height = Math.max(1, startRect.height - dy);
    y = startRect.y + (startRect.height - height);
  }
  return { x, y, width, height };
}

interface TextEditorProps {
  screenName: string;
  path: ElementPath;
  box: ElementBox | null;
  doc: ScreenDocument;
  scale: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function TextEditor({ path, box, doc, scale, onCommit, onCancel }: TextEditorProps) {
  const node = resolvePath(doc, path);
  // Show real newlines in the textarea: the .screen source uses the literal
  // "\\n" escape, but the editor should feel like a normal multi-line input.
  // On commit we convert real newlines back to "\\n" before writing the AST.
  const initial = useMemo(() => {
    if (!node) return "";
    const raw = node.children
      .filter((c): c is { type: "text"; value: string } => c.type === "text")
      .map((c) => c.value)
      .join(" ");
    return raw.replace(/\\n/g, "\n");
  }, [node]);

  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const committedRef = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      if (committedRef.current) return;
      committedRef.current = true;
      onCommitRef.current(encodeTextValue(valueRef.current));
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, []);

  if (!node || !box) return null;

  const fontSize = Number.parseFloat(node.attrs.size ?? "48") || 48;
  const fontWeight = node.attrs.weight ?? "400";
  const color = node.attrs.color ?? "#ffffff";
  const align = (node.attrs.align ?? "left") as React.CSSProperties["textAlign"];
  const lineHeight = Number.parseFloat(node.attrs.lineHeight ?? "1.18") || 1.18;
  const tracking = Number.parseFloat(node.attrs.tracking ?? "0") || 0;
  const font =
    node.attrs.font ??
    `'SF Pro Display', 'SF Pro Text', -apple-system, 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif`;

  const commitOnce = (v: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(encodeTextValue(v));
  };
  const cancelOnce = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };
  const insertAtCursor = (text: string) => {
    const el = ref.current;
    if (!el) return;
    el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
    const next = el.value;
    valueRef.current = next;
    setValue(next);
  };
  const leadingPad = ((lineHeight - 1) * fontSize) / 2;

  return (
    <textarea
      ref={ref}
      value={value}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commitOnce(valueRef.current)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelOnce();
          return;
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          insertAtCursor("\n");
        }
      }}
      className="pointer-events-auto absolute resize-none overflow-hidden bg-transparent outline-none"
      style={{
        left: box.rect.x,
        top: box.rect.y - leadingPad,
        width: box.rect.width,
        minHeight: box.rect.height + leadingPad,
        fontSize,
        fontWeight,
        color,
        textAlign: align,
        lineHeight,
        letterSpacing: tracking,
        fontFamily: font,
        padding: 0,
        margin: 0,
        border: 0,
        boxShadow: `0 0 0 ${2 / scale}px #ffffff, 0 0 0 ${(2 + 4) / scale}px rgba(0,0,0,0.45)`,
        caretColor: color,
        userSelect: "text",
        WebkitUserSelect: "text",
      }}
    />
  );
}

function encodeTextValue(value: string): string {
  // Convert real newlines back to the "\\n" the format expects.
  return value.replace(/\r?\n/g, "\\n");
}

interface HandlesProps {
  box: ElementBox;
  scale: number;
  onPointerDownHandle: (e: React.PointerEvent, kind: DragKind) => void;
  onPointerMoveHandle: (e: React.PointerEvent) => void;
  onPointerUpHandle: (e: React.PointerEvent) => void;
}

function Handles({ box, scale, onPointerDownHandle, onPointerMoveHandle, onPointerUpHandle }: HandlesProps) {
  const inv = 1 / scale;
  const size = 10 * inv;
  const ringWidth = 2 * inv;
  const handleStyle = (left: number, top: number, cursor: string): React.CSSProperties => ({
    position: "absolute",
    left: left - size / 2,
    top: top - size / 2,
    width: size,
    height: size,
    background: "#ffffff",
    border: `${1 * inv}px solid #050505`,
    borderRadius: 2 * inv,
    cursor,
    pointerEvents: "auto",
    touchAction: "none",
  });
  const { x, y, width, height } = box.rect;
  const handles: { kind: DragKind; left: number; top: number; cursor: string }[] = [
    { kind: "nw", left: x,             top: y,              cursor: "nwse-resize" },
    { kind: "n",  left: x + width / 2, top: y,              cursor: "ns-resize" },
    { kind: "ne", left: x + width,     top: y,              cursor: "nesw-resize" },
    { kind: "e",  left: x + width,     top: y + height / 2, cursor: "ew-resize" },
    { kind: "se", left: x + width,     top: y + height,     cursor: "nwse-resize" },
    { kind: "s",  left: x + width / 2, top: y + height,     cursor: "ns-resize" },
    { kind: "sw", left: x,             top: y + height,     cursor: "nesw-resize" },
    { kind: "w",  left: x,             top: y + height / 2, cursor: "ew-resize" },
  ];
  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{ left: x, top: y, width, height, outline: `${ringWidth}px solid #ffffff`, outlineOffset: 0 }}
      />
      {handles.map((h) => (
        <div
          key={h.kind}
          style={handleStyle(h.left, h.top, h.cursor)}
          onPointerDown={(e) => onPointerDownHandle(e, h.kind)}
          onPointerMove={onPointerMoveHandle}
          onPointerUp={onPointerUpHandle}
          onPointerCancel={onPointerUpHandle}
        />
      ))}
    </>
  );
}
