import assert from "node:assert/strict";
import test from "node:test";
import { parseColor, parseLength, parseNumber, parseBool, parseCoord } from "framedeck-core";

// ─── parseLength helpers ──────────────────────────────────────────────

test("parseLength handles pixels (px suffix)", () => {
  assert.equal(parseLength("100px", 500), 100);
  assert.equal(parseLength("48.5px", 500), 48.5);
});

test("parseLength handles percentages", () => {
  assert.equal(parseLength("50%", 400), 200);
  assert.equal(parseLength("25%", 300), 75);
  assert.equal(parseLength("100%", 800), 800);
});

test("parseLength handles bare numbers", () => {
  assert.equal(parseLength("64", 1000), 64);
  assert.equal(parseLength("3.14", 1000), 3.14);
});

test("parseLength falls back when value is null/undefined/empty", () => {
  assert.equal(parseLength(undefined, 500, 10), 10);
  assert.equal(parseLength(null, 500, 20), 20);
  assert.equal(parseLength("", 500, 5), 5);
});

test("parseLength returns fallback for invalid values", () => {
  assert.equal(parseLength("notanumber", 100, -1), -1);
});

// ─── parseColor helpers ──────────────────────────────────────────────

test("parseColor returns color string or undefined", () => {
  assert.equal(parseColor("#ffffff"), "#ffffff");
  assert.equal(parseColor("rgb(255,0,0)"), "rgb(255,0,0)");
  assert.equal(parseColor(undefined), undefined);
  assert.equal(parseColor(""), undefined);
});

// ─── parseNumber helpers ──────────────────────────────────────────────

test("parseNumber handles valid numbers", () => {
  assert.equal(parseNumber("48"), 48);
  assert.equal(parseNumber("1.5"), 1.5);
  assert.equal(parseNumber("-3"), -3);
});

test("parseNumber falls back on missing/invalid values", () => {
  assert.equal(parseNumber(undefined, 10), 10);
  assert.equal(parseNumber(null, 20), 20);
  assert.equal(parseNumber("abc", 5), 5);
});

// ─── parseBool helpers ──────────────────────────────────────────────

test("parseBool returns true for truthy values", () => {
  assert.ok(parseBool("true"));
  assert.ok(parseBool("yes"));
  assert.ok(parseBool("")); // empty string = true
});

test("parseBool returns false for falsy values", () => {
  assert.ok(!parseBool("false"));
  assert.ok(!parseBool("False"));
  assert.ok(!parseBool("no"));
  assert.ok(!parseBool(undefined, false));
});

// ─── parseCoord helpers ──────────────────────────────────────────────

test("parseCoord handles center/start/end", () => {
  assert.equal(parseCoord("center", 800, 200), 300);
  assert.equal(parseCoord("start", 800, 200), 0);
  assert.equal(parseCoord("left", 800, 200), 0);
  assert.equal(parseCoord("top", 800, 200), 0);
  assert.equal(parseCoord("end", 800, 200), 600);
  assert.equal(parseCoord("right", 800, 200), 600);
  assert.equal(parseCoord("bottom", 800, 200), 600);
});

test("parseCoord falls back on invalid/missing values", () => {
  assert.equal(parseCoord(undefined, 800, 200, 10), 10);
  assert.equal(parseCoord("", 800, 200, 10), 10);
});
