// Node backend — uses @napi-rs/canvas. Exports the renderer entrypoints
// preconfigured with this backend so CLI users don't have to wire it up.

import { createCanvas as createSkCanvas, loadImage as loadSkImage } from "@napi-rs/canvas";
import { isAbsolute, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import type { Backend, CanvasLike } from "./backend.js";
import type { RenderOptions } from "./types.js";
import { renderDocument, renderSource } from "./render.js";
import type { ScreenDocument } from "@framedeck/core";

export const nodeBackend: Backend = {
  createCanvas(width, height) {
    return createSkCanvas(width, height) as unknown as CanvasLike;
  },
  async loadImage(src) {
    return (await loadSkImage(src)) as unknown as { width: number; height: number };
  },
  resolvePath(src, baseDir) {
    return isAbsolute(src) ? src : resolve(baseDir, src);
  },
};

export type NodeRenderOptions = Omit<RenderOptions, "backend"> & { backend?: Backend };

export async function renderDocumentNode(doc: ScreenDocument, opts: NodeRenderOptions) {
  return renderDocument(doc, { ...opts, backend: opts.backend ?? nodeBackend });
}

export async function renderSourceNode(source: string, opts: NodeRenderOptions & { sourcePath?: string }) {
  return renderSource(source, { ...opts, backend: opts.backend ?? nodeBackend });
}

/** Render a source string and write PNG bytes to outPath. Returns absolute path. */
export async function renderSourceToFile(
  source: string,
  outPath: string,
  opts: NodeRenderOptions & { sourcePath?: string },
): Promise<string> {
  const canvas = await renderSourceNode(source, opts);
  // @napi-rs/canvas Canvas has toBuffer; the structural type doesn't expose it.
  const buf = (canvas as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer("image/png");
  await writeFile(outPath, buf);
  return outPath;
}
