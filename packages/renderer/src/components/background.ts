import type { Painter } from "../types.js";
import { gradientEndpoints, loadCachedImage, parseGradientCss, roundRectPath } from "../util.js";

export const paintBackground: Painter = async (node, rect, ctx) => {
  const { color, image, opacity, radius } = node.attrs;
  const c = ctx.ctx;
  c.save();
  if (opacity != null) c.globalAlpha = Number(opacity);

  const r = radius ? Number.parseFloat(radius) : 0;
  if (r > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
    c.clip();
  }

  if (color) {
    c.fillStyle = color;
    c.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  if (image) {
    const img = await loadCachedImage(image, ctx);
    c.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  }
  c.restore();
};

export const paintGradient: Painter = (node, rect, ctx) => {
  const { from, to, direction, css } = node.attrs;
  const c = ctx.ctx;
  let parsed = css ? parseGradientCss(css) : null;
  if (!parsed && from && to) {
    const angleDeg = direction ? parseAngle(direction) : 180;
    parsed = { angleDeg, stops: [{ offset: 0, color: from }, { offset: 1, color: to }] };
  }
  if (!parsed || parsed.stops.length === 0) return;
  const { x0, y0, x1, y1 } = gradientEndpoints(
    { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    parsed.angleDeg,
  );
  const grad = c.createLinearGradient(x0, y0, x1, y1);
  for (const s of parsed.stops) grad.addColorStop(s.offset, s.color);
  c.fillStyle = grad;
  c.fillRect(rect.x, rect.y, rect.width, rect.height);
};

function parseAngle(value: string): number {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*deg$/);
  return m ? Number.parseFloat(m[1]!) : 180;
}
