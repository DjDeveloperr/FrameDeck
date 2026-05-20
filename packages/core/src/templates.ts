// Element factories with sensible defaults — used when inserting new elements
// from the editor. Keep attribute lists short so the inserted nodes look
// presentable but don't impose strong visual opinions.

import type { ElementNode, KnownTag } from "./ast.js";

type Factory = (children?: ElementNode["children"]) => ElementNode;

const make = (tag: string, attrs: Record<string, string>, children: ElementNode["children"] = []): ElementNode => ({
  type: "element",
  tag,
  attrs,
  children,
  line: 0,
  column: 0,
});

const text = (value: string): ElementNode["children"][number] => ({ type: "text", value });

export const ELEMENT_TEMPLATES: Record<string, Factory> = {
  Text: () => make("Text", { size: "48", weight: "500", color: "#ffffff", align: "center" }, [text("New text")]),
  Background: () => make("Background", { color: "#0a0a0a" }),
  Gradient: () => make("Gradient", { css: "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)" }),
  Device: () => make("Device", { model: "iphone-16-pro", width: "700", alignSelf: "center" }),
  Image: () => make("Image", { src: "./shots/your-shot.png", fit: "cover" }),
  Shape: () => make("Shape", { kind: "rect", fill: "#ffffff", radius: "16", width: "320", height: "120" }),
  VStack: () => make("VStack", { gap: "24", padding: "32", alignItems: "center" }),
  HStack: () => make("HStack", { gap: "24", padding: "32", alignItems: "center" }),
};

export interface ElementMenuEntry {
  tag: KnownTag;
  label: string;
  description: string;
  group: "Layout" | "Surface" | "Content";
}

export const ELEMENT_MENU: ElementMenuEntry[] = [
  { tag: "Text",       label: "Text",       description: "Headline, body, or caption", group: "Content" },
  { tag: "Device",     label: "Device",     description: "Bezeled phone/tablet/watch", group: "Content" },
  { tag: "Image",      label: "Image",      description: "Raster image",               group: "Content" },
  { tag: "Shape",      label: "Shape",      description: "Rectangle or circle",        group: "Content" },
  { tag: "VStack",     label: "VStack",     description: "Vertical flex container",    group: "Layout" },
  { tag: "HStack",     label: "HStack",     description: "Horizontal flex container",  group: "Layout" },
  { tag: "Background", label: "Background", description: "Full-bleed solid fill",      group: "Surface" },
  { tag: "Gradient",   label: "Gradient",   description: "Full-bleed gradient fill",   group: "Surface" },
];

export function createElement(tag: string): ElementNode {
  const factory = ELEMENT_TEMPLATES[tag];
  if (!factory) throw new Error(`Unknown element template: ${tag}`);
  return factory();
}
