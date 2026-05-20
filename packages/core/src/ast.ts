// AST types for the .screen format.
//
// A .screen file is a single JSX-like document with one root <Screen> element.
// All elements are nodes with a tag name, attributes, and optional children.
// Attributes are typed loosely as strings during parsing and resolved by the
// renderer/layout pipeline. Text nodes carry plain string content.

export type Attrs = Record<string, string>;

export interface ElementNode {
  type: "element";
  tag: string;
  attrs: Attrs;
  children: Node[];
  /** 1-based line number where the tag opened. */
  line: number;
  column: number;
}

export interface TextNode {
  type: "text";
  value: string;
}

export type Node = ElementNode | TextNode;

export interface ScreenDocument {
  root: ElementNode;
  /** The source path the document was loaded from, if any. */
  source?: string;
}

export const KNOWN_TAGS = [
  "Screen",
  "Background",
  "Gradient",
  "Text",
  "Device",
  "Image",
  "Shape",
  "VStack",
  "HStack",
] as const;

export type KnownTag = (typeof KNOWN_TAGS)[number];

export function isKnownTag(tag: string): tag is KnownTag {
  return (KNOWN_TAGS as readonly string[]).includes(tag);
}
