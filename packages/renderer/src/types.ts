import type { ElementNode, ScreenDocument, DeviceRegistry } from "framedeck-core";
import type { Backend, CanvasLike, Context2DLike, ImageLike } from "./backend.js";

export interface RenderOptions {
  /** Backend providing canvas + image loading. Use node()/web() helpers. */
  backend: Backend;
  /** Base directory for resolving relative image paths. */
  baseDir: string;
  /** Device registry. Required when <Device> tags are present. */
  devices?: DeviceRegistry;
  /** Output pixel scale (default 1). */
  scale?: number;
  /**
   * Optional pre-allocated output canvas. When provided, the renderer paints
   * directly into this canvas instead of asking the backend for a fresh one.
   * Useful in the browser where the canvas is a DOM node owned by React.
   */
  canvas?: CanvasLike;
  /**
   * If set, the element at this AST element-index path is not painted
   * (children of skipped containers still paint). Used by the editor to
   * hide a <Text> while it's being edited inline via a textarea overlay.
   */
  skipPath?: readonly number[];
  /** Optional cache reused across renders so browser canvases don't reload every image on each repaint. */
  images?: Map<string, ImageLike>;
}

export interface RenderContext {
  backend: Backend;
  canvas: CanvasLike;
  ctx: Context2DLike;
  baseDir: string;
  devices?: DeviceRegistry;
  scale: number;
  doc: ScreenDocument;
  /** Image cache keyed by resolved src. */
  images: Map<string, ImageLike>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Painter = (
  node: ElementNode,
  rect: Rect,
  ctx: RenderContext,
) => Promise<void> | void;
