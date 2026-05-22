import { parseColor, parseLength, parseNumber } from "framedeck-core";
import type { Painter } from "../types.js";
import { roundRectPath } from "../util.js";

export const paintShape: Painter = (node, rect, ctx) => {
  const kind = (node.attrs.kind ?? "rect").toLowerCase();
  const fill = parseColor(node.attrs.fill);
  const stroke = parseColor(node.attrs.stroke);
  const strokeWidth = parseNumber(node.attrs.strokeWidth, 1);
  const blur = parseNumber(node.attrs.blur, 0);
  const radius = parseLength(node.attrs.radius, Math.min(rect.width, rect.height), 0);
  const opacity = node.attrs.opacity;
  const shadowColorAttr = node.attrs.shadowColor;
  const shadowBlurAttr = node.attrs.shadowBlur;
  const shadowOffsetXAttr = node.attrs.shadowOffsetX;
  const shadowOffsetYAttr = node.attrs.shadowOffsetY;

  const c = ctx.ctx;
  c.save();
  if (opacity != null) c.globalAlpha = Number(opacity);

  // Drop shadow support.
  if (shadowColorAttr || shadowBlurAttr !== undefined) {
    c.shadowColor = shadowColorAttr ?? "rgba(0,0,0,0.5)";
    c.shadowBlur = Number(shadowBlurAttr ?? 0);
    c.shadowOffsetX = shadowOffsetXAttr ? Number(shadowOffsetXAttr) : 0;
    c.shadowOffsetY = shadowOffsetYAttr ? Number(shadowOffsetYAttr) : 0;
  }

  // Also apply the `blur` attribute for backward-compatible blur support
  // when no shadow attributes are explicitly set.
  if (blur && !shadowColorAttr && shadowBlurAttr === undefined) {
    c.filter = `blur(${blur}px)`;
  }

  const r = radius > 0 ? radius : 0;

  c.beginPath();
  if (kind === "circle" || kind === "ellipse") {
    c.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  } else if (r > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
  } else {
    c.rect(rect.x, rect.y, rect.width, rect.height);
  }
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    const sw = strokeWidth;
    c.save();
    c.strokeStyle = stroke;
    c.lineWidth = sw;
    if (kind === "circle" || kind === "ellipse") {
      c.beginPath();
      c.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(0, rect.width / 2 - sw / 2), Math.max(0, rect.height / 2 - sw / 2), 0, 0, Math.PI * 2);
    } else if (r > 0) {
      roundRectPath(c, rect.x + sw / 2, rect.y + sw / 2, Math.max(0, rect.width - sw), Math.max(0, rect.height - sw), Math.max(0, r - sw / 2));
    } else {
      c.beginPath();
      c.rect(rect.x + sw / 2, rect.y + sw / 2, Math.max(0, rect.width - sw), Math.max(0, rect.height - sw));
    }
    c.stroke();
    c.restore();
  }
  c.restore();
};
