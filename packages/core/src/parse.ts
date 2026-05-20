import { Parser } from "htmlparser2";
import type { Attrs, ElementNode, Node, ScreenDocument } from "./ast.js";

export class ScreenParseError extends Error {
  constructor(message: string, public readonly line: number, public readonly column: number) {
    super(`${message} (line ${line}, col ${column})`);
    this.name = "ScreenParseError";
  }
}

// Parse a .screen source string into a ScreenDocument.
//
// The format is JSX-ish: case-sensitive tag names, self-closing OK, attributes
// are double-quoted strings. The parser is intentionally lenient — only one
// rule is enforced: the document must have a single <Screen> root element.
export function parseScreen(source: string, sourcePath?: string): ScreenDocument {
  const stack: ElementNode[] = [];
  let root: ElementNode | null = null;
  let line = 1;
  let column = 1;
  let cursor = 0;

  const advanceLineColTo = (index: number) => {
    while (cursor < index && cursor < source.length) {
      if (source.charCodeAt(cursor) === 10 /* \n */) {
        line++;
        column = 1;
      } else {
        column++;
      }
      cursor++;
    }
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        advanceLineColTo(parser.startIndex);
        const node: ElementNode = {
          type: "element",
          tag: name, // htmlparser2 in xmlMode preserves case
          attrs: attribs as Attrs,
          children: [],
          line,
          column,
        };
        if (stack.length === 0) {
          if (root) {
            throw new ScreenParseError(
              `Multiple root elements found; .screen documents must have exactly one <Screen> root`,
              line,
              column,
            );
          }
          root = node;
        } else {
          stack[stack.length - 1]!.children.push(node);
        }
        stack.push(node);
      },
      onclosetag() {
        stack.pop();
      },
      ontext(text) {
        const trimmed = text.replace(/\s+/g, " ");
        if (!trimmed.trim()) return;
        const parent = stack[stack.length - 1];
        if (!parent) return;
        const last = parent.children[parent.children.length - 1];
        if (last && last.type === "text") {
          last.value += trimmed;
        } else {
          parent.children.push({ type: "text", value: trimmed });
        }
      },
      onerror(err) {
        throw new ScreenParseError(err.message, line, column);
      },
    },
    {
      xmlMode: true,
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
      recognizeSelfClosing: true,
    },
  );

  parser.write(source);
  parser.end();

  if (!root) {
    throw new ScreenParseError("Empty .screen document (expected a <Screen> root)", 1, 1);
  }
  if ((root as ElementNode).tag !== "Screen") {
    throw new ScreenParseError(
      `Root element must be <Screen>, got <${(root as ElementNode).tag}>`,
      (root as ElementNode).line,
      (root as ElementNode).column,
    );
  }

  return { root, source: sourcePath };
}

// Walk an AST top-down. Returning false from visit stops descending into children.
export function walk(node: Node, visit: (node: Node) => boolean | void): void {
  const shouldDescend = visit(node);
  if (shouldDescend === false) return;
  if (node.type === "element") {
    for (const child of node.children) walk(child, visit);
  }
}
