import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages", "cli");

await rm(join(packageRoot, "assets"), { recursive: true, force: true });
await rm(join(packageRoot, "web"), { recursive: true, force: true });
