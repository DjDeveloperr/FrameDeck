// Locate the bundled device-bezel assets. Walks up from the cwd looking for
// `assets/device-bezels/index.json`; falls back to the location relative to
// this CLI package inside the monorepo.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findDefaultAssetsRoot } from "@screendeck/core/fs";

export function resolveAssetsRoot(explicit?: string): string {
  if (explicit) {
    const r = resolve(explicit);
    if (!existsSync(join(r, "index.json"))) {
      throw new Error(`No device index at ${r}/index.json`);
    }
    return r;
  }
  const fromCwd = findDefaultAssetsRoot(process.cwd());
  if (fromCwd) return fromCwd;
  const here = dirname(fileURLToPath(import.meta.url));
  const fromInstall = findDefaultAssetsRoot(here);
  if (fromInstall) return fromInstall;
  throw new Error(
    "Could not locate device-bezels assets. Pass --assets <path> or run from a directory under the ScreenDeck repo.",
  );
}
