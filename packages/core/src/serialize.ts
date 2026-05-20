// AST → .screen source serializer.
//
// Used by the editor when an inspector edit changes an AST attribute and we
// need to round-trip the result back to disk. The output is stable and
// human-readable: 2-space indent, attributes one-per-line when an element has
// more than two, self-closing when there are no children.

import type { ElementNode, Node, ScreenDocument } from "./ast.js";

export interface SerializeOptions {
  /** Indent string. Default: two spaces. */
  indent?: string;
  /** Max attributes on a single line before breaking onto multiple lines. */
  inlineAttrLimit?: number;
}

export function serializeDocument(doc: ScreenDocument, options: SerializeOptions = {}): string {
  return serializeElement(doc.root, 0, options) + "\n";
}

export function serializeElement(node: ElementNode, depth: number, options: SerializeOptions = {}): string {
  const indent = options.indent ?? "  ";
  const inlineLimit = options.inlineAttrLimit ?? 2;
  const pad = indent.repeat(depth);

  const attrEntries = Object.entries(node.attrs);
  const attrString = renderAttrs(attrEntries, depth, indent, inlineLimit);
  const hasChildren = node.children.length > 0;
  const textOnly = hasChildren && node.children.every((c) => c.type === "text");

  if (!hasChildren) {
    return `${pad}<${node.tag}${attrString} />`;
  }

  const open = `${pad}<${node.tag}${attrString}>`;
  const close = `${pad}</${node.tag}>`;

  if (textOnly) {
    const text = node.children
      .filter((c): c is { type: "text"; value: string } => c.type === "text")
      .map((c) => c.value)
      .join("")
      .trim();
    if (text.length === 0) return `${pad}<${node.tag}${attrString} />`;
    // Keep short text on the same line; wrap longer text.
    const inline = `${open}${escapeText(text)}</${node.tag}>`;
    if (inline.length <= 100) return inline;
    return `${open}\n${pad}${indent}${escapeText(text)}\n${close}`;
  }

  const body = node.children
    .map((child) => serializeChild(child, depth + 1, options))
    .filter(Boolean)
    .join("\n");
  return `${open}\n${body}\n${close}`;
}

function serializeChild(child: Node, depth: number, options: SerializeOptions): string {
  if (child.type === "text") {
    const indent = options.indent ?? "  ";
    const pad = indent.repeat(depth);
    const text = child.value.trim();
    if (!text) return "";
    return `${pad}${escapeText(text)}`;
  }
  return serializeElement(child, depth, options);
}

function renderAttrs(
  entries: [string, string][],
  depth: number,
  indent: string,
  inlineLimit: number,
): string {
  if (entries.length === 0) return "";
  if (entries.length <= inlineLimit) {
    return " " + entries.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(" ");
  }
  const pad = indent.repeat(depth + 1);
  return "\n" + entries.map(([k, v]) => `${pad}${k}="${escapeAttr(v)}"`).join("\n");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}
