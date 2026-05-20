"use client";

// Viewport transform hook.
//
// Manages pan + zoom for the Figma-style canvas. Wheel + Safari gesture
// listeners are attached natively (not via React synthetic events) so we can
// pass `{ passive: false }` and actually preventDefault on the browser's
// page-zoom and page-scroll defaults.
//
// Bindings:
//   • wheel                    → pan (Figma convention).
//   • ctrl/⌘+wheel             → zoom around cursor (Chrome's trackpad pinch
//                                also delivers itself here).
//   • gesturestart/change      → zoom around the gesture midpoint (Safari).
//   • single pointer drag      → pan.
//   • two-pointer drag         → pinch zoom.

import { useCallback, useEffect, useRef, useState } from "react";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface PointerInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTransform: Transform;
}

export interface UseViewportApi {
  transform: Transform;
  setTransform: (t: Transform) => void;
  /** Snap to the fit target instantly. */
  fitInstant: (artworkW: number, artworkH: number, padding?: number) => void;
  /** Tween to the fit target over ~250ms with an ease-out curve. */
  fit: (artworkW: number, artworkH: number, padding?: number) => void;
  /** Snap so a specific artwork rect occupies `fraction` of the viewport. */
  frameRect: (rect: { x: number; y: number; w: number; h: number }, fraction?: number) => void;
  zoomBy: (factor: number, around?: { x: number; y: number }) => void;
  zoomBySmooth: (factor: number, around?: { x: number; y: number }) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  isPanning: boolean;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

type GestureEventLike = Event & { scale?: number; clientX?: number; clientY?: number };

export function useViewport(containerRef: React.RefObject<HTMLElement | null>): UseViewportApi {
  const [transform, setTransformState] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const pointers = useRef<Map<number, PointerInfo>>(new Map());
  const [isPanning, setIsPanning] = useState(false);
  const localCursor = useRef<{ x: number; y: number } | null>(null);
  const tweenHandle = useRef<number | null>(null);

  const containerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, [containerRef]);

  const cancelTween = () => {
    if (tweenHandle.current != null) {
      cancelAnimationFrame(tweenHandle.current);
      tweenHandle.current = null;
    }
  };

  const setTransform = useCallback((t: Transform) => {
    cancelTween();
    const clamped = { ...t, scale: clampScale(t.scale) };
    transformRef.current = clamped;
    setTransformState(clamped);
  }, []);

  const tweenTo = useCallback((target: Transform, durationMs = 260) => {
    cancelTween();
    const start = { ...transformRef.current };
    const begin = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / durationMs);
      const k = easeOutCubic(t);
      const next: Transform = {
        x: lerp(start.x, target.x, k),
        y: lerp(start.y, target.y, k),
        scale: lerp(start.scale, target.scale, k),
      };
      transformRef.current = next;
      setTransformState(next);
      if (t < 1) {
        tweenHandle.current = requestAnimationFrame(step);
      } else {
        tweenHandle.current = null;
      }
    };
    tweenHandle.current = requestAnimationFrame(step);
  }, []);

  const fitTarget = useCallback(
    (artworkW: number, artworkH: number, padding: number): Transform | null => {
      const rect = containerRect();
      if (!rect || rect.width < 2 || rect.height < 2) return null;
      const availW = Math.max(1, rect.width - padding * 2);
      const availH = Math.max(1, rect.height - padding * 2);
      const scale = clampScale(Math.min(availW / artworkW, availH / artworkH));
      const x = (rect.width - artworkW * scale) / 2;
      const y = (rect.height - artworkH * scale) / 2;
      return { x, y, scale };
    },
    [containerRect],
  );

  const fitInstant = useCallback(
    (artworkW: number, artworkH: number, padding = 64) => {
      const t = fitTarget(artworkW, artworkH, padding);
      if (t) setTransform(t);
    },
    [fitTarget, setTransform],
  );

  const fit = useCallback(
    (artworkW: number, artworkH: number, padding = 64) => {
      const t = fitTarget(artworkW, artworkH, padding);
      if (t) tweenTo(t, 280);
    },
    [fitTarget, tweenTo],
  );

  const frameRect = useCallback(
    (rect: { x: number; y: number; w: number; h: number }, fraction = 0.9) => {
      const r = containerRect();
      if (!r || r.width < 2 || r.height < 2) return;
      const fr = Math.max(0.1, Math.min(fraction, 1));
      const scale = clampScale(Math.min((r.width * fr) / rect.w, (r.height * fr) / rect.h));
      const x = r.width / 2 - (rect.x + rect.w / 2) * scale;
      const y = r.height / 2 - (rect.y + rect.h / 2) * scale;
      setTransform({ x, y, scale });
    },
    [containerRect, setTransform],
  );

  const zoomTarget = useCallback(
    (factor: number, around?: { x: number; y: number }): Transform | null => {
      const rect = containerRect();
      if (!rect) return null;
      const anchor =
        around ?? localCursor.current ?? { x: rect.width / 2, y: rect.height / 2 };
      const t = transformRef.current;
      const newScale = clampScale(t.scale * factor);
      const k = newScale / t.scale;
      const newX = anchor.x - (anchor.x - t.x) * k;
      const newY = anchor.y - (anchor.y - t.y) * k;
      return { x: newX, y: newY, scale: newScale };
    },
    [containerRect],
  );

  const zoomBy = useCallback(
    (factor: number, around?: { x: number; y: number }) => {
      const target = zoomTarget(factor, around);
      if (target) setTransform(target);
    },
    [setTransform, zoomTarget],
  );

  const zoomBySmooth = useCallback(
    (factor: number, around?: { x: number; y: number }) => {
      const target = zoomTarget(factor, around);
      if (target) tweenTo(target, 180);
    },
    [tweenTo, zoomTarget],
  );

  // Native wheel + Safari gesture listeners with `passive: false`.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      localCursor.current = local;

      // Normalize delta into pixels regardless of deltaMode (some mice send
      // lines or pages instead of pixels).
      const lineToPx = 16;
      const pageToPx = rect.height || 800;
      const factorMode = e.deltaMode === 1 ? lineToPx : e.deltaMode === 2 ? pageToPx : 1;
      const dx = e.deltaX * factorMode;
      const dy = e.deltaY * factorMode;

      if (e.ctrlKey || e.metaKey) {
        // Pinch (delivered as ctrl+wheel by Chrome) or ⌘+wheel zoom.
        // Sensitivity ~0.01 per normalized pixel → smooth ramp.
        const factor = Math.exp(-dy * 0.012);
        zoomBy(factor, local);
      } else {
        setTransform({
          x: transformRef.current.x - dx,
          y: transformRef.current.y - dy,
          scale: transformRef.current.scale,
        });
      }
    };

    // Safari delivers trackpad pinch as gesturestart/change/end.
    let gestureStartScale = 1;
    let gestureAnchor: { x: number; y: number } = { x: 0, y: 0 };
    const handleGestureStart = (e: GestureEventLike) => {
      e.preventDefault();
      gestureStartScale = transformRef.current.scale;
      const rect = node.getBoundingClientRect();
      gestureAnchor = {
        x: (e.clientX ?? rect.width / 2 + rect.left) - rect.left,
        y: (e.clientY ?? rect.height / 2 + rect.top) - rect.top,
      };
    };
    const handleGestureChange = (e: GestureEventLike) => {
      e.preventDefault();
      const targetScale = clampScale(gestureStartScale * (e.scale ?? 1));
      const factor = targetScale / transformRef.current.scale;
      zoomBy(factor, gestureAnchor);
    };
    const handleGestureEnd = (e: GestureEventLike) => {
      e.preventDefault();
    };

    const mouseMove = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      localCursor.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    node.addEventListener("gesturestart", handleGestureStart as EventListener, { passive: false });
    node.addEventListener("gesturechange", handleGestureChange as EventListener, { passive: false });
    node.addEventListener("gestureend", handleGestureEnd as EventListener, { passive: false });
    node.addEventListener("mousemove", mouseMove, { passive: true });

    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("gesturestart", handleGestureStart as EventListener);
      node.removeEventListener("gesturechange", handleGestureChange as EventListener);
      node.removeEventListener("gestureend", handleGestureEnd as EventListener);
      node.removeEventListener("mousemove", mouseMove);
    };
  }, [containerRef, setTransform, zoomBy]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRect();
      if (!rect) return;
      const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      pointers.current.set(e.pointerId, {
        id: e.pointerId,
        x: local.x,
        y: local.y,
        startX: local.x,
        startY: local.y,
        startTransform: transformRef.current,
      });
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setIsPanning(true);
    },
    [containerRect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRect();
      if (!rect) return;
      const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      localCursor.current = local;
      const info = pointers.current.get(e.pointerId);
      if (!info) return;
      info.x = local.x;
      info.y = local.y;

      const ps = [...pointers.current.values()];
      if (ps.length === 1) {
        const p = ps[0]!;
        setTransform({
          x: p.startTransform.x + (p.x - p.startX),
          y: p.startTransform.y + (p.y - p.startY),
          scale: p.startTransform.scale,
        });
      } else if (ps.length >= 2) {
        const [a, b] = ps;
        const startCenter = midpoint(a!.startX, a!.startY, b!.startX, b!.startY);
        const startDist = distance(a!.startX, a!.startY, b!.startX, b!.startY);
        const curCenter = midpoint(a!.x, a!.y, b!.x, b!.y);
        const curDist = distance(a!.x, a!.y, b!.x, b!.y);
        if (startDist < 1) return;
        const k = clampScale((a!.startTransform.scale * curDist) / startDist) / a!.startTransform.scale;
        const tx = curCenter.x - (startCenter.x - a!.startTransform.x) * k;
        const ty = curCenter.y - (startCenter.y - a!.startTransform.y) * k;
        setTransform({ x: tx, y: ty, scale: a!.startTransform.scale * k });
      }
    },
    [containerRect, setTransform],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setIsPanning(false);
  }, []);

  return {
    transform,
    setTransform,
    fitInstant,
    fit,
    frameRect,
    zoomBy,
    zoomBySmooth,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isPanning,
  };
}

function clampScale(s: number): number {
  return Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);
}

function midpoint(ax: number, ay: number, bx: number, by: number) {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
