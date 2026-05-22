// Backend abstraction so the renderer runs in Node (via @napi-rs/canvas) or in
// the browser (via HTMLCanvasElement) with the exact same paint code.
//
// We rely on the Canvas2D API being mutually compatible — both contexts expose
// the same methods we touch: fillRect, drawImage, createLinearGradient, ellipse,
// quadraticCurveTo, measureText, globalCompositeOperation, etc.

export interface ImageLike {
  width: number;
  height: number;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): Context2DLike;
}

export interface Context2DLike {
    // We list every method/property the renderer actually uses so backend types
    // are checked at the boundary, not via blanket `any`.
  fillStyle: string | CanvasGradient | unknown;
  strokeStyle: string | unknown;
  globalAlpha: number;
  globalCompositeOperation: string;
  filter?: string;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  letterSpacing?: string;
  lineWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  clip(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(angle: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  drawImage(image: unknown, dx: number, dy: number, dw?: number, dh?: number): void;
}

export interface Backend {
  createCanvas(width: number, height: number): CanvasLike;
  /** Load an image. The src may be a file path (node) or URL (web). */
  loadImage(src: string): Promise<ImageLike>;
  /** Optional: resolve a relative path against a base directory (no-op on web). */
  resolvePath?(src: string, baseDir: string): string;
}
