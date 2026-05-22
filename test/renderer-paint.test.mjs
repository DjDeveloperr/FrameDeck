import assert from "node:assert/strict";
import test from "node:test";
import { renderSource } from "../../ScreenDeck/packages/renderer/dist/render.js";

// Create a proper mock canvas context.
function makeMockCanvas(w, h) {
  const calls = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "rgba(0,0,0,0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: "48px 'SF Pro Display', sans-serif",
    textAlign: "left",
    textBaseline: "top",
    letterSpacing: undefined,

    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    fillRect(x, y, width, height) { calls.push(["fillRect", x, y, width, height]); },
    clearRect() { calls.push("clearRect"); },
    fill() { calls.push("fill"); },
    stroke() { calls.push("stroke"); },
    rect() { calls.push("rect"); },
    beginPath() { calls.push("beginPath"); },
    closePath() { calls.push("closePath"); },
    moveTo() { calls.push("moveTo"); },
    lineTo() { calls.push("lineTo"); },
    quadraticCurveTo() { calls.push("quadraticCurveTo"); },
    ellipse() { calls.push("ellipse"); },
    clip() { calls.push("clip"); },
    translate() { calls.push("translate"); },
    scale() { calls.push("scale"); },
    rotate() { calls.push("rotate"); },
    measureText(t) { return { width: t.length * 10 }; },
    createLinearGradient() { const g = { stops: [] }; g.addColorStop = () => {}; return g; },
    drawImage() { calls.push("drawImage"); },

    _calls() { return calls; },
    getCallTrace() { return calls.map(c => Array.isArray(c) ? c[0] : c); },
  };
  return { width: w, height: h, getContext: () => ctx };
}

function makeBackend(canvas) {
  return {
    createCanvas(w, h) { return canvas; },
    loadImage: async () => ({ width: 100, height: 100 }),
  };
}

// ─── Background painter tests ──────────────────────────────────────

test("background fills rect", async () => {
  const canvas = makeMockCanvas(800, 600);
  await renderSource(`<Screen size="80x60"><Background color="#ff0000" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });
  const trace = canvas.getContext("2d").getCallTrace();
  assert.ok(trace.includes("fillRect"), "background should call fillRect");
});

test("background respects radius", async () => {
  const canvas = makeMockCanvas(800, 600);
  await renderSource(`<Screen size="80x60"><Background color="#ff0000" radius="10" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });
  const trace = canvas.getContext("2d").getCallTrace();
  assert.ok(trace.includes("clip"), "background with radius should clip");
});

test("background opacity sets globalAlpha", async () => {
  const alphaVals = [];
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "globalAlpha", {
    set(v) { alphaVals.push(v); },
    get() { return 1; },
    configurable: true,
  });

  try {
    await renderSource(`<Screen size="80x60"><Background color="#ff0000" opacity="0.5" /></Screen>`, {
      backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
    });
    assert.ok(alphaVals.includes(0.5), `globalAlpha should be 0.5`);
  } finally {
    Object.defineProperty(ctx, "globalAlpha", { value: 1, writable: true, configurable: true });
  }
});

test("background stroke sets stroke properties", async () => {
  const strokeStyles = [];
  const lineWidths = [];
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "strokeStyle", { set(v) { strokeStyles.push(v); }, configurable: true });
  Object.defineProperty(ctx, "lineWidth", {
    get() { return lineWidths[lineWidths.length - 1] || 0; },
    set(v) { lineWidths.push(v); },
    configurable: true,
  });

  await renderSource(`<Screen size="80x60"><Background color="#ddd" stroke="#333" strokeWidth="2" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });

  assert.ok(strokeStyles.includes("#333"), "background stroke color should be set");
});

// ─── Shape painter tests ──────────────────────────────────────────

test("shape paints with shadow via canvas properties", async () => {
  const canvas = makeMockCanvas(800, 600);
  let capturedShadowColor, capturedShadowBlur;
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "shadowColor", { set(v) { capturedShadowColor = v; }, configurable: true });
  Object.defineProperty(ctx, "shadowBlur", { set(v) { capturedShadowBlur = v; }, configurable: true });

  await renderSource(`<Screen size="80x60"><Shape width="50" height="30" x="10" y="10" fill="#f00" shadowColor="#00f" shadowBlur="8" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });

  assert.equal(capturedShadowColor, "#00f", "shadow color should be set on canvas");
  assert.equal(capturedShadowBlur, 8, "shadow blur should be set on canvas");
});

test("shape with opacity sets globalAlpha", async () => {
  const alphaVals = [];
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "globalAlpha", { set(v) { alphaVals.push(v); }, configurable: true });

  try {
    await renderSource(`<Screen size="80x60"><Shape width="50" height="30" x="10" y="10" fill="#f00" opacity="0.3" /></Screen>`, {
      backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
    });
    assert.ok(alphaVals.includes(0.3), "opacity should set globalAlpha");
  } finally {
    Object.defineProperty(ctx, "globalAlpha", { value: 1, writable: true, configurable: true });
  }
});

test("shape with radius and shadow renders natural drop shadow", async () => {
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  let capturedShadowBlur;
  Object.defineProperty(ctx, "shadowBlur", { set(v) { capturedShadowBlur = v; }, configurable: true });

  await renderSource(`<Screen size="80x60"><Shape width="50" height="30" x="10" y="10" fill="#f00" radius="8" shadowBlur="4" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });

  assert.equal(capturedShadowBlur, 4, "shape with radius+shadow should set shadowBlur for natural drop shadow");
});

// ─── Gradient painter tests ──────────────────────────────────────

test("gradient with shadow sets canvas shadow properties", async () => {
  const canvas = makeMockCanvas(800, 600);
  const shadowColors = [];
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "shadowColor", { set(v) { shadowColors.push(v); }, configurable: true });

  await renderSource(`<Screen size="80x60"><Gradient from="#ff0000" to="#00ff00" shadowColor="#ffff00" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });

  assert.ok(shadowColors.includes("#ffff00"), "gradient shadow color should be set to #ffff00 at some point");
});

test("gradient with opacity sets globalAlpha", async () => {
  const alphaVals = [];
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  Object.defineProperty(ctx, "globalAlpha", { set(v) { alphaVals.push(v); }, configurable: true });

  try {
    await renderSource(`<Screen size="80x60"><Gradient from="#ff0000" to="#00ff00" opacity="0.4" /></Screen>`, {
      backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
    });
    assert.ok(alphaVals.includes(0.4), "gradient opacity should set globalAlpha");
  } finally {
    Object.defineProperty(ctx, "globalAlpha", { value: 1, writable: true, configurable: true });
  }
});

test("gradient with radius clips to rounded rect", async () => {
  const clipCalls = [];
  const canvas = makeMockCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  ctx.clip = function() { clipCalls.push("clip"); };

  await renderSource(`<Screen size="80x60"><Gradient from="#ff0000" to="#00ff00" radius="12" /></Screen>`, {
    backend: makeBackend(canvas), baseDir: process.cwd(), scale: 1,
  });

  assert.ok(clipCalls.length > 0, "gradient with radius should clip");
});
