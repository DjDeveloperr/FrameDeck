// Web backend — uses the DOM's HTMLCanvasElement and Image. Importable from
// browser bundlers (Next.js client components, Vite, etc.).

import type { Backend, CanvasLike } from "./backend.js";
import type { RenderOptions } from "./types.js";
import { renderDocument, renderSource } from "./render.js";

declare const document: { createElement(tag: "canvas"): HTMLCanvasElementLike };

interface HTMLCanvasElementLike {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
}

export const webBackend: Backend = {
  createCanvas(width, height) {
    const el = document.createElement("canvas");
    el.width = width;
    el.height = height;
    return el as unknown as CanvasLike;
  },
  loadImage(src) {
    return new Promise((resolve, reject) => {
      // @ts-expect-error — Image is a browser global.
      const img: { width: number; height: number; onload: () => void; onerror: (e: Event) => void; src: string; crossOrigin: string } = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  },
  /**
   * Resolve a relative image path against the project's base URL.
   *
   *   • Absolute URLs / paths pass through untouched (so device-bezel paths
   *     like "/api/assets/..." aren't double-prefixed).
   *   • Otherwise, the path is normalized in pure JS — "./" segments are
   *     stripped, "../" segments fold against accumulated parts but never
   *     escape the baseDir. Browsers normalize "../" on their own before
   *     fetching, which would otherwise route the request away from
   *     /api/projects/<id>/files/ entirely.
   */
  resolvePath(src, baseDir) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith("/")) return src;
    const stack: string[] = [];
    for (const seg of src.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        if (stack.length > 0) stack.pop();
        // else: silently absorb so paths that meant "up from screens/" still
        // land at the project root.
        continue;
      }
      stack.push(seg);
    }
    const base = baseDir.replace(/\/+$/, "");
    return `${base}/${stack.join("/")}`;
  },
};

export type WebRenderOptions = Omit<RenderOptions, "backend"> & { backend?: Backend };

export async function renderDocumentWeb(doc: Parameters<typeof renderDocument>[0], opts: WebRenderOptions) {
  return renderDocument(doc, { ...opts, backend: opts.backend ?? webBackend });
}

export async function renderSourceWeb(source: string, opts: WebRenderOptions & { sourcePath?: string }) {
  return renderSource(source, { ...opts, backend: opts.backend ?? webBackend });
}
