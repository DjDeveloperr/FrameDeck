// Render orchestrator: parses (if needed), builds layout, paints.

import type { ScreenDocument } from "@framedeck/core";
import { parseScreen } from "@framedeck/core";
import { buildAndComputeLayout, freeLayout, type LaidOutNode } from "./layout.js";
import { paintBackground, paintGradient } from "./components/background.js";
import { paintText } from "./components/text.js";
import { paintImage } from "./components/image.js";
import { paintShape } from "./components/shape.js";
import { paintDevice } from "./components/device.js";
import type { Painter, RenderContext, RenderOptions } from "./types.js";

const PAINTERS: Record<string, Painter> = {
  Background: paintBackground,
  Gradient: paintGradient,
  Text: paintText,
  Image: paintImage,
  Shape: paintShape,
  Device: paintDevice,
  // Screen, VStack, HStack are containers — they have no paint of their own.
};

export async function renderDocument(
  doc: ScreenDocument,
  options: RenderOptions,
): Promise<RenderContext["canvas"]> {
  const ctx = await initContext(doc, options);
  let laidOut: LaidOutNode | null = null;
  try {
    laidOut = buildAndComputeLayout(doc, ctx);
    await paint(laidOut, ctx, [], options.skipPath);
  } finally {
    if (laidOut) freeLayout(laidOut);
  }
  return ctx.canvas;
}

export async function renderSource(
  source: string,
  options: RenderOptions & { sourcePath?: string },
) {
  const doc = parseScreen(source, options.sourcePath);
  return renderDocument(doc, options);
}

async function initContext(doc: ScreenDocument, options: RenderOptions): Promise<RenderContext> {
  const sizeAttr = doc.root.attrs.size;
  if (!sizeAttr) throw new Error(`<Screen> requires a size="WxH" attribute`);
  const [w, h] = parseSizeStrict(sizeAttr);
  const scale = options.scale ?? 1;
  const pixelWidth = Math.round(w * scale);
  const pixelHeight = Math.round(h * scale);
  let canvas: typeof options.backend extends never ? never : ReturnType<typeof options.backend.createCanvas>;
  if (options.canvas) {
    canvas = options.canvas as typeof canvas;
    // Honor caller-set dimensions; they may have already done DPR sizing.
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  } else {
    canvas = options.backend.createCanvas(pixelWidth, pixelHeight) as typeof canvas;
  }
  const ctx = canvas.getContext("2d");
  // Clear any prior frame so re-renders aren't stacked.
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  if (scale !== 1) ctx.scale(scale, scale);
  return {
    backend: options.backend,
    canvas,
    ctx,
    baseDir: options.baseDir,
    devices: options.devices,
    scale,
    doc,
    images: options.images ?? new Map(),
  };
}

function parseSizeStrict(value: string): [number, number] {
  const m = value.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) throw new Error(`Invalid size: "${value}"`);
  return [Number.parseInt(m[1]!, 10), Number.parseInt(m[2]!, 10)];
}

async function paint(
  node: LaidOutNode,
  ctx: RenderContext,
  path: number[],
  skipPath?: readonly number[],
): Promise<void> {
  const skipped = !!skipPath && pathsEqual(path, skipPath);
  if (!skipped) {
    const painter = PAINTERS[node.ast.tag];
    if (painter) {
      try {
        await painter(node.ast, node.rect, ctx);
      } catch (err) {
        // A single misbehaving element shouldn't black out the whole screen.
        if (typeof console !== "undefined") {
          console.warn(`[framedeck] paint failed for <${node.ast.tag}> at [${path.join(",")}]:`, err);
        }
      }
    }
  }
  for (let i = 0; i < node.children.length; i++) {
    await paint(node.children[i]!, ctx, [...path, i], skipPath);
  }
}

function pathsEqual(a: number[] | readonly number[], b: number[] | readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
