// Resolve the canonical paths inside this workspace. The web app discovers
// projects from <repo>/projects and reads bezel assets from <repo>/assets.

import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";

let cachedRepoRoot: string | null = null;

export function repoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;
  // Walk up from cwd looking for the workspace package.json.
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "packages", "core")) && existsSync(join(dir, "package.json"))) {
      cachedRepoRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedRepoRoot = process.cwd();
  return cachedRepoRoot;
}

export function projectsRoot(): string {
  return process.env.FRAMEDECK_PROJECTS ?? join(repoRoot(), "projects");
}

export function assetsRoot(): string {
  return process.env.FRAMEDECK_ASSETS ?? join(repoRoot(), "assets", "device-bezels");
}

export function safeResolve(base: string, rel: string): string {
  const root = resolve(base);
  const target = resolve(root, rel);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new Error("Path escapes base directory");
  }
  return target;
}
