import type { Painter } from "../types.js";
import { gradientEndpoints, loadCachedImage, parseGradientCss, roundRectPath } from "../util.js";

export const paintBackground: Painter = async (node, rect, ctx) => {
  const { color, image, opacity, radius, stroke, strokeWidth, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur } = node.attrs;
  const c = ctx.ctx;
  c.save();
  if (opacity != null) c.globalAlpha = Number(opacity);

  const r = radius ? Number.parseFloat(radius) : 0;
  const hasShadow = !!(shadowColor || shadowBlur !== undefined || shadowOffsetX !== undefined || shadowOffsetY !== undefined);

  // Phase 1: Render shadow (before clipping so it extends outside the rect)
  if (hasShadow) {
    c.shadowColor = shadowColor ?? "rgba(0,0,0,0.5)";
    c.shadowBlur = shadowBlur ? Number(shadowBlur) : 0;
    c.shadowOffsetX = shadowOffsetX ? Number(shadowOffsetX) : 0;
    c.shadowOffsetY = shadowOffsetY ? Number(shadowOffsetY) : 0;

    if (r > 0) {
      roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
      c.fillStyle = color ?? "#000";
      c.fill();
    } else {
      // fillRect works for non-rounded rects; Canvas2D shadow applies naturally
      c.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    // Reset shadow so content phase doesn't double-shadow
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
  }

  // Phase 2: Clip content to rounded rect
  if (r > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
    c.clip();
  }

  // Phase 3: Draw actual content (no shadow)
  if (color) {
    c.fillStyle = color;
    c.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  if (image) {
    const img = await loadCachedImage(image, ctx);
    c.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  }

  // Phase 4: Stroke (post-clip so it stays on top; uses own path so it respects radius)
  if (stroke) {
    const sw = strokeWidth ? Number.parseFloat(strokeWidth) : 1;
    c.save();
    c.strokeStyle = stroke;
    c.lineWidth = sw;
    roundRectPath(c, rect.x + sw / 2, rect.y + sw / 2, Math.max(0, rect.width - sw), Math.max(0, rect.height - sw), Math.max(0, r - sw / 2));
    c.stroke();
    c.restore();
  }

  c.restore();
};

export const paintGradient: Painter = (node, rect, ctx) => {
  const { from, to, direction, css, opacity, radius, stroke, strokeWidth, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur } = node.attrs;
  const c = ctx.ctx;
  let parsed = css ? parseGradientCss(css) : null;
  if (!parsed && from && to) {
    const angleDeg = direction ? parseAngle(direction) : 180;
    parsed = { angleDeg, stops: [{ offset: 0, color: from }, { offset: 1, color: to }] };
  }
  if (!parsed || parsed.stops.length === 0) return;

  c.save();
  if (opacity != null) c.globalAlpha = Number(opacity);

  const r = radius ? Number.parseFloat(radius) : 0;
  const hasShadow = !!(shadowColor || shadowBlur !== undefined || shadowOffsetX !== undefined || shadowOffsetY !== undefined);

  const { x0, y0, x1, y1 } = gradientEndpoints(
    { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    parsed.angleDeg,
  );

  // Phase 1: Shadow (before clipping)
  if (hasShadow) {
    c.shadowColor = shadowColor ?? "rgba(0,0,0,0.5)";
    c.shadowBlur = shadowBlur ? Number(shadowBlur) : 0;
    c.shadowOffsetX = shadowOffsetX ? Number(shadowOffsetX) : 0;
    c.shadowOffsetY = shadowOffsetY ? Number(shadowOffsetY) : 0;

    if (r > 0) {
      roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
      c.fillStyle = "#000";
      c.fill();
    } else {
      c.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
  }

  // Phase 2: Clip to rounded rect
  if (r > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
    c.clip();
  }

  // Phase 3: Draw gradient content
  const grad = c.createLinearGradient(x0, y0, x1, y1);
  for (const s of parsed.stops) grad.addColorStop(s.offset, s.color);
  c.fillStyle = grad;
  c.fillRect(rect.x, rect.y, rect.width, rect.height);

  // Phase 4: Stroke
  if (stroke) {
    const sw = strokeWidth ? Number.parseFloat(strokeWidth) : 1;
    c.save();
    c.strokeStyle = stroke;
    c.lineWidth = sw;
    roundRectPath(c, rect.x + sw / 2, rect.y + sw / 2, rect.width - sw, rect.height - sw, r);
    c.stroke();
    c.restore();
  }

  c.restore();
};

function parseAngle(value: string): number {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*deg$/);
  return m ? Number.parseFloat(m[1]!) : 180;
}
