import type { ImageLike } from "./backend.js";
import type { RenderContext } from "./types.js";

export async function loadCachedImage(src: string, ctx: RenderContext): Promise<ImageLike> {
  const key = ctx.backend.resolvePath ? ctx.backend.resolvePath(src, ctx.baseDir) : src;
  const cached = ctx.images.get(key);
  if (cached) return cached;
  const img = await ctx.backend.loadImage(key);
  ctx.images.set(key, img);
  return img;
}

export interface ParsedGradient {
  angleDeg: number;
  stops: { offset: number; color: string }[];
}

export function parseGradientCss(value: string): ParsedGradient | null {
  const m = value.match(/^linear-gradient\(\s*([^)]+)\)\s*$/i);
  if (!m) return null;
  const parts = splitTopLevelCommas(m[1]!);
  let angleDeg = 180;
  const stops: ParsedGradient["stops"] = [];
  for (const part of parts) {
    const p = part.trim();
    const deg = p.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (deg) {
      angleDeg = Number.parseFloat(deg[1]!);
      continue;
    }
    const stop = p.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)%)?$/);
    if (stop) {
      const color = stop[1]!;
      const pct = stop[2] != null ? Number.parseFloat(stop[2]) / 100 : -1;
      stops.push({ offset: pct, color });
    }
  }
  const total = stops.length;
  stops.forEach((s, i) => {
    if (s.offset < 0) s.offset = total === 1 ? 0 : i / (total - 1);
  });
  return { angleDeg, stops };
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function gradientEndpoints(
  box: { x: number; y: number; w: number; h: number },
  angleDeg: number,
): { x0: number; y0: number; x1: number; y1: number } {
  // CSS: 0deg = bottom→top, 90deg = left→right, 180deg = top→bottom.
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const halfLen = (Math.abs(box.w * Math.sin(rad)) + Math.abs(box.h * Math.cos(rad))) / 2;
  const dx = Math.sin(rad) * halfLen;
  const dy = -Math.cos(rad) * halfLen;
  return { x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy };
}

export function roundRectPath(
  c: import("./backend.js").Context2DLike,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}
