import type { Painter } from "../types.js";
import { loadCachedImage, roundRectPath } from "../util.js";

export const paintImage: Painter = async (node, rect, ctx) => {
  const src = node.attrs.src;
  if (!src) return;
  const img = await loadCachedImage(src, ctx);
  const fit = node.attrs.fit ?? "cover";
  const c = ctx.ctx;
  c.save();
  if (node.attrs.opacity != null) c.globalAlpha = Number(node.attrs.opacity);

  const shadowColor = node.attrs.shadowColor;
  const shadowBlur = node.attrs.shadowBlur;
  const hasShadow = !!(shadowColor || shadowBlur !== undefined || node.attrs.shadowOffsetX !== undefined || node.attrs.shadowOffsetY !== undefined);

  const radiusAttr = node.attrs.radius;
  const r = radiusAttr ? Math.max(0, Number.parseFloat(radiusAttr)) : 0;

  // Phase 1: Render shadow before clipping so it extends outside the rect
  if (hasShadow) {
    c.shadowColor = shadowColor ?? "rgba(0,0,0,0.5)";
    c.shadowBlur = shadowBlur ? Number(shadowBlur) : 0;
    c.shadowOffsetX = node.attrs.shadowOffsetX ? Number(node.attrs.shadowOffsetX) : 0;
    c.shadowOffsetY = node.attrs.shadowOffsetY ? Number(node.attrs.shadowOffsetY) : 0;

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

  // Phase 2: Clip content to rounded rect
  if (r > 0) {
    roundRectPath(c, rect.x, rect.y, rect.width, rect.height, r);
    c.clip();
  }

  // Phase 3: Draw actual image content
  const ar = img.width / img.height;
  const slotAR = rect.width / rect.height;
  let dx = rect.x, dy = rect.y, dw = rect.width, dh = rect.height;

  if (fit === "contain") {
    if (ar > slotAR) {
      dw = rect.width;
      dh = rect.width / ar;
      dy = rect.y + (rect.height - dh) / 2;
    } else {
      dh = rect.height;
      dw = rect.height * ar;
      dx = rect.x + (rect.width - dw) / 2;
    }
  } else if (fit === "cover") {
    if (ar > slotAR) {
      dh = rect.height;
      dw = rect.height * ar;
      dx = rect.x + (rect.width - dw) / 2;
    } else {
      dw = rect.width;
      dh = rect.width / ar;
      dy = rect.y + (rect.height - dh) / 2;
    }
  } else if (fit === "none") {
    dw = img.width;
    dh = img.height;
    dx = rect.x;
    dy = rect.y;
  }
  c.drawImage(img, dx, dy, dw, dh);
  c.restore();
};
