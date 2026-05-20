// Public layout API — exposes the laid-out rect tree without painting.
//
// The web editor uses this to render a transparent overlay of clickable boxes
// over the canvas so users can tap an element to select it. Paths track the
// AST element-index hierarchy and align with @framedeck/core's path helpers.

import type { ElementNode, ScreenDocument, DeviceRegistry } from "@framedeck/core";
import type { Backend } from "./backend.js";
import type { Rect } from "./types.js";
import { buildAndComputeLayout, freeLayout, type LaidOutNode } from "./layout.js";

export interface ElementBox {
  /** AST element-index path, matching `pathFromString`/`pathToString` in core. */
  path: number[];
  tag: string;
  rect: Rect;
  children: ElementBox[];
}

export interface LayoutOptions {
  backend: Backend;
  baseDir: string;
  devices?: DeviceRegistry;
}

export async function layoutDocument(
  doc: ScreenDocument,
  options: LayoutOptions,
): Promise<ElementBox> {
  // Build a throwaway 1×1 canvas so text measurement has a 2D context.
  const measureCanvas = options.backend.createCanvas(1, 1);
  const measureCtx = measureCanvas.getContext("2d");
  const ctx = {
    backend: options.backend,
    canvas: measureCanvas,
    ctx: measureCtx,
    baseDir: options.baseDir,
    devices: options.devices,
    scale: 1,
    doc,
    images: new Map(),
  };

  const root = buildAndComputeLayout(doc, ctx);
  try {
    return toElementBox(root, []);
  } finally {
    freeLayout(root);
  }
}

function toElementBox(node: LaidOutNode, path: number[]): ElementBox {
  return {
    path,
    tag: node.ast.tag,
    rect: { ...node.rect },
    children: node.children.map((child, i) => toElementBox(child, [...path, i])),
  };
}
