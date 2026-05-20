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
  const c = ctx.ctx;
  c.save();
  if (opacity != null) c.globalAlpha = Number(opacity);
  if (blur) c.filter = `blur(${blur}px)`;
  c.beginPath();
  if (kind === "circle" || kind === "ellipse") {
    c.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  } else if (radius > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, radius);
  } else {
    c.rect(rect.x, rect.y, rect.width, rect.height);
  }
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = strokeWidth;
    c.stroke();
  }
  c.restore();
};
