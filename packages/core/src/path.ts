// Stable index-based paths for selecting nodes in the AST.
// A path is an array of integers; "0.1" means root.children[0].children[1]
// (excluding text nodes — paths only ever address element children).

import type { ElementNode, Node, ScreenDocument } from "./ast.js";

export type ElementPath = readonly number[];

export const ROOT_PATH: ElementPath = [];

export function pathToString(path: ElementPath): string {
  return path.join(".");
}

export function pathFromString(s: string): ElementPath {
  if (!s) return [];
  return s.split(".").map((p) => Number.parseInt(p, 10));
}

export function pathEquals(a: ElementPath, b: ElementPath): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function pathStartsWith(path: ElementPath, prefix: ElementPath): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) if (path[i] !== prefix[i]) return false;
  return true;
}

/** Return the element children of a node, skipping text nodes. */
export function elementChildren(node: ElementNode): ElementNode[] {
  return node.children.filter((c): c is ElementNode => c.type === "element");
}

/** Resolve a path against a document, or null if it doesn't address an element. */
export function resolvePath(doc: ScreenDocument, path: ElementPath): ElementNode | null {
  let current: ElementNode = doc.root;
  for (const idx of path) {
    const kids = elementChildren(current);
    const next = kids[idx];
    if (!next) return null;
    current = next;
  }
  return current;
}

/**
 * Apply a transform to the node at `path`, returning a new document with
 * structural sharing everywhere except along the spine. We deep-clone the
 * spine so React change detection works.
 */
export function updateAtPath(
  doc: ScreenDocument,
  path: ElementPath,
  transform: (node: ElementNode) => ElementNode,
): ScreenDocument {
  const newRoot = mutateSpine(doc.root, path, 0, transform);
  return { ...doc, root: newRoot };
}

function mutateSpine(
  node: ElementNode,
  path: ElementPath,
  depth: number,
  transform: (node: ElementNode) => ElementNode,
): ElementNode {
  if (depth === path.length) {
    return transform(node);
  }
  const idx = path[depth]!;
  let elementCount = -1;
  const newChildren: Node[] = node.children.map((child) => {
    if (child.type !== "element") return child;
    elementCount++;
    if (elementCount !== idx) return child;
    return mutateSpine(child, path, depth + 1, transform);
  });
  return { ...node, children: newChildren };
}

/** Set, update, or delete attributes on the element at `path`. */
export function setAttrs(
  doc: ScreenDocument,
  path: ElementPath,
  patch: Record<string, string | undefined>,
): ScreenDocument {
  return updateAtPath(doc, path, (node) => {
    const attrs = { ...node.attrs };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") {
        delete attrs[key];
      } else {
        attrs[key] = value;
      }
    }
    return { ...node, attrs };
  });
}

/** Replace the text content of the element at `path`. */
export function setText(doc: ScreenDocument, path: ElementPath, text: string): ScreenDocument {
  return updateAtPath(doc, path, (node) => ({
    ...node,
    children: text ? [{ type: "text", value: text }] : [],
  }));
}

/**
 * Insert `child` as an element child of the node at `parentPath`. If `index`
 * is omitted (or out of range), the child is appended.
 */
export function insertChild(
  doc: ScreenDocument,
  parentPath: ElementPath,
  child: ElementNode,
  index?: number,
): ScreenDocument {
  return updateAtPath(doc, parentPath, (parent) => {
    // Find the splice point in the mixed-children array that matches the
    // requested element-index slot.
    const childNodes = parent.children.slice();
    if (index == null || index < 0) {
      childNodes.push(child);
      return { ...parent, children: childNodes };
    }
    let elementCount = 0;
    for (let i = 0; i < childNodes.length; i++) {
      if (childNodes[i]!.type !== "element") continue;
      if (elementCount === index) {
        childNodes.splice(i, 0, child);
        return { ...parent, children: childNodes };
      }
      elementCount++;
    }
    childNodes.push(child);
    return { ...parent, children: childNodes };
  });
}

/** Delete the element at `path`. Returns the document unchanged if path is root. */
export function removeAt(doc: ScreenDocument, path: ElementPath): ScreenDocument {
  if (path.length === 0) return doc;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1]!;
  return updateAtPath(doc, parentPath, (parent) => {
    const newChildren: Node[] = [];
    let elementCount = -1;
    for (const c of parent.children) {
      if (c.type === "element") {
        elementCount++;
        if (elementCount === idx) continue;
      }
      newChildren.push(c);
    }
    return { ...parent, children: newChildren };
  });
}

/** Insert a deep clone of the element at `path` immediately after it. */
export function duplicateAt(doc: ScreenDocument, path: ElementPath): ScreenDocument {
  if (path.length === 0) return doc; // Can't duplicate the root.
  const node = resolvePath(doc, path);
  if (!node) return doc;
  const clone = deepCloneElement(node);
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1]!;
  return insertChild(doc, parentPath, clone, idx + 1);
}

export function deepCloneElement(node: ElementNode): ElementNode {
  return {
    ...node,
    attrs: { ...node.attrs },
    children: node.children.map((c) =>
      c.type === "element" ? deepCloneElement(c) : { ...c },
    ),
  };
}
