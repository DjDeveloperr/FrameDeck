import type { Painter } from "../types.js";
import { loadCachedImage } from "../util.js";

export const paintImage: Painter = async (node, rect, ctx) => {
  const src = node.attrs.src;
  if (!src) return;
  const img = await loadCachedImage(src, ctx);
  const fit = node.attrs.fit ?? "cover"; // contain | cover | fill | none
  const c = ctx.ctx;
  c.save();
  if (node.attrs.opacity != null) c.globalAlpha = Number(node.attrs.opacity);

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
