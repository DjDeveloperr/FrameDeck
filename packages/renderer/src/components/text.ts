import { parseColor, parseLength, parseNumber } from "@framedeck/core";
import type { Painter, RenderContext, Rect } from "../types.js";
import type { ElementNode } from "@framedeck/core";

const DEFAULT_FONT_STACK =
  "'SF Pro Display', 'SF Pro Text', -apple-system, 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif";

interface ResolvedStyle {
  fontSpec: string;
  size: number;
  color: string;
  align: CanvasTextAlign;
  lineHeight: number;
  tracking: number;
  maxWidth: number;
}

function resolveStyle(node: ElementNode, rect: Rect): ResolvedStyle {
  const a = node.attrs;
  const size = parseLength(a.size, rect.width, 48);
  const weight = a.weight ?? "400";
  const font = a.font ?? DEFAULT_FONT_STACK;
  return {
    fontSpec: `${weight} ${size}px ${font}`,
    size,
    color: parseColor(a.color) ?? "#ffffff",
    align: (a.align as CanvasTextAlign) ?? "left",
    lineHeight: parseNumber(a.lineHeight, 1.18),
    tracking: parseNumber(a.tracking, 0),
    maxWidth: a.maxWidth ? parseLength(a.maxWidth, rect.width, rect.width) : rect.width,
  };
}

export function getTextContent(node: ElementNode): string {
  return node.children
    .filter((c): c is { type: "text"; value: string } => c.type === "text")
    .map((c) => c.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export const paintText: Painter = (node, rect, ctx) => {
  const style = resolveStyle(node, rect);
  const text = getTextContent(node);
  if (!text) return;
  const c = ctx.ctx;
  c.save();
  c.font = style.fontSpec;
  c.fillStyle = style.color;
  c.textBaseline = "top";
  if (style.tracking) c.letterSpacing = `${style.tracking}px`;

  const lines = wrapLines(c, text, style.maxWidth);

  let anchorX: number;
  if (style.align === "center") {
    c.textAlign = "center";
    anchorX = rect.x + rect.width / 2;
  } else if (style.align === "right" || style.align === "end") {
    c.textAlign = "right";
    anchorX = rect.x + rect.width;
  } else {
    c.textAlign = "left";
    anchorX = rect.x;
  }

  let y = rect.y;
  for (const line of lines) {
    c.fillText(line, anchorX, y);
    y += style.size * style.lineHeight;
  }
  c.restore();
};

/**
 * Measure helper used by the layout phase. Yoga calls this to compute the
 * intrinsic text size given a width constraint.
 */
export function measureText(
  ctx: RenderContext,
  node: ElementNode,
  availableWidth: number,
): { width: number; height: number } {
  const text = getTextContent(node);
  if (!text) return { width: 0, height: 0 };
  const a = node.attrs;
  const size = parseLength(a.size, availableWidth || 1000, 48);
  const weight = a.weight ?? "400";
  const font = a.font ?? DEFAULT_FONT_STACK;
  const lineHeight = parseNumber(a.lineHeight, 1.18);
  const maxWidth = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : Number.POSITIVE_INFINITY;

  ctx.ctx.save();
  ctx.ctx.font = `${weight} ${size}px ${font}`;
  const lines = wrapLines(ctx.ctx, text, maxWidth);
  let maxLineWidth = 0;
  for (const line of lines) {
    const w = ctx.ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }
  ctx.ctx.restore();

  return { width: Math.ceil(maxLineWidth), height: Math.ceil(lines.length * size * lineHeight) };
}

function wrapLines(c: { measureText: (s: string) => { width: number } }, text: string, maxWidth: number): string[] {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return text.split(/\\n|\n/);
  const out: string[] = [];
  const paras = text.split(/\\n|\n/);
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`;
      if (c.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        out.push(line);
        line = words[i]!;
      }
    }
    out.push(line);
  }
  return out;
}
