import type { DeviceGeometry, DeviceProfile } from "framedeck-core";
import { parseBool } from "framedeck-core";
import type { Painter, RenderContext } from "../types.js";
import { loadCachedImage, roundRectPath } from "../util.js";

// Bezeled device frame.
//
// Layout:
//   The element's outer Rect (computed by yoga) IS the device's outer box.
//   Aspect ratio should normally be locked at the layout stage via the
//   `aspectRatio` attribute (we provide a sensible default during layout
//   build — see layout.ts).
//
// Paint:
//   1. Determine pixel-scale factor relative to the device's native bezel pt.
//   2. Compose the embedded screenshot inside the device's screen rectangle,
//      clipped by the device's screen-mask (or rounded-rect fallback).
//   3. Overlay the bezel PNG on top.
export const paintDevice: Painter = async (node, rect, ctx) => {
  if (!ctx.devices) {
    throw new Error("Device registry not provided — pass `devices` to render()");
  }
  const model = node.attrs.model ?? node.attrs.device;
  if (!model) throw new Error("<Device> requires a `model` attribute");
  const profile = ctx.devices.resolve(model);
  const geom = profile.geometry;
  const showButtons = parseBool(node.attrs.buttons, true);
  const opacity = node.attrs.opacity;
  const shadowColorAttr = node.attrs.shadowColor;
  const shadowBlurAttr = node.attrs.shadowBlur;
  const shadowOffsetXAttr = node.attrs.shadowOffsetX;
  const shadowOffsetYAttr = node.attrs.shadowOffsetY;

  // Honor the layout rect; rebase coordinates from the device's native pt grid.
  const scale = rect.width / geom.totalWidth;
  const screenRect = {
    x: rect.x + geom.screenX * scale,
    y: rect.y + geom.screenY * scale,
    width: geom.screenWidth * scale,
    height: geom.screenHeight * scale,
  };

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

  // Don't let a failed screenshot load kill the whole frame — paint the
  // bezel regardless, log the failure to the console for the author.
  if (node.attrs.screenshot || node.attrs.screen) {
    try {
      await drawClippedScreen(ctx, profile, geom, screenRect, node.attrs.screenshot ?? node.attrs.screen!);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn(`[framedeck] failed to load screenshot for <Device model="${profile.slug}">: ${node.attrs.screenshot ?? node.attrs.screen}`, err);
      }
    }
  } else if (node.attrs.screenColor) {
    try {
      await drawClippedFill(ctx, profile, geom, screenRect, node.attrs.screenColor);
    } catch {
      /* ignore */
    }
  }

  const bezelPath = ctx.devices.imagePath(profile, showButtons ? "bezel" : "bezelNoButtons");
  const bezel = await loadCachedImage(bezelPath, ctx);
  c.drawImage(bezel, rect.x, rect.y, rect.width, rect.height);
  c.restore();
};

/** Native aspect ratio (width / height) for a given device model. */
export function deviceAspectRatio(profile: DeviceProfile): number {
  return profile.geometry.totalWidth / profile.geometry.totalHeight;
}

async function drawClippedScreen(
  ctx: RenderContext,
  profile: DeviceProfile,
  geom: DeviceGeometry,
  screenRect: { x: number; y: number; width: number; height: number },
  shotSrc: string,
) {
  const shot = await loadCachedImage(shotSrc, ctx);
  const dest = bleedScreenRect(screenRect);
  const off = ctx.backend.createCanvas(Math.ceil(dest.width), Math.ceil(dest.height));
  const oc = off.getContext("2d");

  const shotAR = shot.width / shot.height;
  const slotAR = off.width / off.height;
  let dw = off.width, dh = off.height, dx = 0, dy = 0;
  if (shotAR > slotAR) {
    dh = off.height;
    dw = off.height * shotAR;
    dx = (off.width - dw) / 2;
  } else {
    dw = off.width;
    dh = off.width / shotAR;
    dy = (off.height - dh) / 2;
  }
  oc.drawImage(shot, dx, dy, dw, dh);

  await applyScreenMask(ctx, profile, geom, oc, off.width, off.height);
  ctx.ctx.drawImage(off, dest.x, dest.y, dest.width, dest.height);
}

async function drawClippedFill(
  ctx: RenderContext,
  profile: DeviceProfile,
  geom: DeviceGeometry,
  screenRect: { x: number; y: number; width: number; height: number },
  color: string,
) {
  const dest = bleedScreenRect(screenRect);
  const off = ctx.backend.createCanvas(Math.ceil(dest.width), Math.ceil(dest.height));
  const oc = off.getContext("2d");
  oc.fillStyle = color;
  oc.fillRect(0, 0, off.width, off.height);
  await applyScreenMask(ctx, profile, geom, oc, off.width, off.height);
  ctx.ctx.drawImage(off, dest.x, dest.y, dest.width, dest.height);
}

async function applyScreenMask(
  ctx: RenderContext,
  profile: DeviceProfile,
  geom: DeviceGeometry,
  oc: import("../backend.js").Context2DLike,
  sw: number,
  sh: number,
) {
  if (geom.hasScreenMask && profile.images.screenMask && ctx.devices) {
    const maskPath = ctx.devices.imagePath(profile, "screenMask");
    const mask = await loadCachedImage(maskPath, ctx);
    oc.globalCompositeOperation = "destination-in";
    oc.drawImage(mask, 0, 0, sw, sh);
  } else {
    // Rounded-rect fallback using destination-in.
    oc.globalCompositeOperation = "destination-in";
    oc.fillStyle = "#fff";
    roundRectPath(oc, 0, 0, sw, sh, geom.cornerRadius * (sw / geom.screenWidth));
    oc.fill();
  }
}

function bleedScreenRect(rect: { x: number; y: number; width: number; height: number }) {
  // Let the screenshot/fill tuck just under the bezel. Fractional screen rects
  // can otherwise anti-alias into a visible one-pixel seam at some sizes.
  const bleed = 1;
  return {
    x: rect.x - bleed,
    y: rect.y - bleed,
    width: rect.width + bleed * 2,
    height: rect.height + bleed * 2,
  };
}
