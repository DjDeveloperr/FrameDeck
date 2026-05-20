// Layout helpers: unit parsing, attribute coercion, alignment resolution.
//
// The .screen format intentionally keeps positioning explicit and predictable:
// every element accepts numeric x/y plus optional `align` / "center" shortcuts.
// All units resolve to integer pixels relative to the parent's content box.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parse a length value (e.g. "40", "40px", "20%") against a parent dimension. */
export function parseLength(
  value: string | undefined,
  parent: number,
  fallback = 0,
): number {
  if (value == null || value === "") return fallback;
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const pct = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(pct) ? (parent * pct) / 100 : fallback;
  }
  if (trimmed.endsWith("px")) {
    const n = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a coordinate that may be "center", "start", "end", or a length. */
export function parseCoord(
  value: string | undefined,
  parentLength: number,
  ownLength: number,
  fallback = 0,
): number {
  if (value == null || value === "") return fallback;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "center") return Math.round((parentLength - ownLength) / 2);
  if (trimmed === "start" || trimmed === "left" || trimmed === "top") return 0;
  if (trimmed === "end" || trimmed === "right" || trimmed === "bottom") {
    return parentLength - ownLength;
  }
  return parseLength(value, parentLength, fallback);
}

/** Parse a "1290x2796" string into [w, h]. Accepts whitespace and 'x' or '×'. */
export function parseSize(value: string): [number, number] {
  const m = value.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) throw new Error(`Invalid size: "${value}" (expected e.g. "1290x2796")`);
  return [Number.parseInt(m[1]!, 10), Number.parseInt(m[2]!, 10)];
}

/** Parse a CSS-style color or return undefined if it's not present. */
export function parseColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim();
}

/** Parse a number, returning fallback if missing or invalid. */
export function parseNumber(value: string | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a boolean attribute. Treats empty string as true. */
export function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  if (value === "" || value === "true" || value === "yes") return true;
  if (value === "false" || value === "no") return false;
  return fallback;
}
