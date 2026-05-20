// Build a Yoga tree from the AST and compute the layout.
//
// Each element in the document becomes a Yoga node. Yoga handles flexbox
// positioning, sizing, gaps, margins, padding, alignment, etc. Text nodes are
// given a measure function so Yoga can wrap text within available widths.
//
// Devices get an automatic aspect-ratio constraint matching their native bezel
// proportions — so writing `<Device model="..." width="900" />` produces the
// correct height without forcing the author to compute it.

import Yoga, { type Node as YogaNode } from "yoga-layout";
import type { ElementNode, ScreenDocument } from "@screendeck/core";
import { parseSize } from "@screendeck/core";
import { applyStyle } from "./style.js";
import type { RenderContext, Rect } from "./types.js";
import { measureText } from "./components/text.js";
import { deviceAspectRatio } from "./components/device.js";

export interface LaidOutNode {
  ast: ElementNode;
  yoga: YogaNode;
  rect: Rect;
  children: LaidOutNode[];
}

export function buildAndComputeLayout(
  doc: ScreenDocument,
  ctx: RenderContext,
): LaidOutNode {
  const sizeAttr = doc.root.attrs.size;
  if (!sizeAttr) {
    throw new Error(`<Screen> requires a size="WxH" attribute`);
  }
  const [w, h] = parseSize(sizeAttr);

  const root = buildNode(doc.root, ctx);
  // Make sure root has explicit dimensions.
  root.yoga.setWidth(w);
  root.yoga.setHeight(h);

  root.yoga.calculateLayout(w, h, Yoga.DIRECTION_LTR);
  hydrateRects(root, 0, 0);
  return root;
}

function buildNode(ast: ElementNode, ctx: RenderContext): LaidOutNode {
  const yoga = Yoga.Node.create();

  // Default tag-specific styles applied first so user attrs can override.
  if (ast.tag === "Screen") {
    yoga.setOverflow(Yoga.OVERFLOW_HIDDEN);
  }
  if (ast.tag === "Background" || ast.tag === "Gradient") {
    // Background-style elements default to full-bleed: absolutely positioned,
    // pinned to all four edges of their parent. They opt out of flex flow so
    // siblings keep their natural arrangement on top.
    yoga.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
    yoga.setPosition(Yoga.EDGE_TOP, 0);
    yoga.setPosition(Yoga.EDGE_LEFT, 0);
    yoga.setPosition(Yoga.EDGE_RIGHT, 0);
    yoga.setPosition(Yoga.EDGE_BOTTOM, 0);
  }
  if (ast.tag === "Device") {
    try {
      const model = ast.attrs.model ?? ast.attrs.device;
      if (model && ctx.devices) {
        const profile = ctx.devices.resolve(model);
        yoga.setAspectRatio(deviceAspectRatio(profile));
      }
    } catch {
      // ignore — error will surface at paint time with a clearer message
    }
  }

  applyStyle(yoga, ast.tag, ast.attrs);

  if (ast.tag === "Text") {
    yoga.setMeasureFunc((width) => measureText(ctx, ast, width));
  }

  const children: LaidOutNode[] = [];
  let childIndex = 0;
  for (const child of ast.children) {
    if (child.type !== "element") continue;
    // Text content children are handled by the Text measure function; if the
    // element is itself a Text element, we still walk into it because nested
    // styling could be added later.
    const built = buildNode(child, ctx);
    yoga.insertChild(built.yoga, childIndex++);
    children.push(built);
  }

  return { ast, yoga, rect: { x: 0, y: 0, width: 0, height: 0 }, children };
}

function hydrateRects(node: LaidOutNode, ox: number, oy: number) {
  const layout = node.yoga.getComputedLayout();
  node.rect = {
    x: layout.left + ox,
    y: layout.top + oy,
    width: layout.width,
    height: layout.height,
  };
  for (const child of node.children) {
    hydrateRects(child, node.rect.x, node.rect.y);
  }
}

export function freeLayout(root: LaidOutNode): void {
  for (const child of root.children) freeLayout(child);
  root.yoga.free();
}
