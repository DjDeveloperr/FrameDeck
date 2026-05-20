import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages", "cli");
const assetsSource = join(repoRoot, "assets", "device-bezels");
const assetsTarget = join(packageRoot, "assets", "device-bezels");
const webSource = join(repoRoot, "packages", "web");
const webTarget = join(packageRoot, "web");

await rm(assetsTarget, { recursive: true, force: true });
await mkdir(dirname(assetsTarget), { recursive: true });
await cp(assetsSource, assetsTarget, { recursive: true });

await rm(webTarget, { recursive: true, force: true });
await cp(webSource, webTarget, {
  recursive: true,
  filter: (sourcePath) => {
    const rel = relative(webSource, sourcePath);
    if (!rel) return true;
    return rel.split(sep).every((part) => {
      if (part === "node_modules" || part === "out" || part === "coverage") return false;
      if (part === ".turbo" || part === ".vercel") return false;
      if (part.startsWith(".next")) return false;
      return !part.endsWith(".tsbuildinfo");
    });
  },
});
