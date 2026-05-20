// Node-only helpers for locating and loading the bundled device index.
// Importing this module from a browser bundle will fail — keep it server-side.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DeviceIndex } from "./devices.js";
import { synthesizeBoardsForScreens, type BoardsManifest } from "./boards.js";

export function loadDeviceIndexFromFs(assetsRoot: string, indexPath?: string): DeviceIndex {
  const idx = indexPath ?? join(assetsRoot, "index.json");
  if (!existsSync(idx)) {
    throw new Error(`Device index not found at ${idx}`);
  }
  return JSON.parse(readFileSync(idx, "utf8")) as DeviceIndex;
}

/**
 * Load boards.json from a project, or synthesize a default board containing
 * every screen name in `fallbackScreens`.
 */
export function loadBoardsFromFs(projectRoot: string, fallbackScreens: string[]): BoardsManifest {
  const path = join(projectRoot, "boards.json");
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as BoardsManifest;
      if (Array.isArray(data.boards) && data.boards.length > 0) return data;
    } catch {
      // fall through to synthesis
    }
  }
  return synthesizeBoardsForScreens(fallbackScreens);
}

export function saveBoardsToFs(projectRoot: string, manifest: BoardsManifest): void {
  writeFileSync(join(projectRoot, "boards.json"), JSON.stringify(manifest, null, 2) + "\n");
}

/** Walk up from `start` looking for assets/device-bezels/index.json. */
export function findDefaultAssetsRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "assets", "device-bezels");
    if (existsSync(join(candidate, "index.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}
