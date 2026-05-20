// `framedeck watch <project-dir>` — re-renders any .screen file when it
// changes. Great for live iteration alongside the web editor.

import { resolve, join, dirname } from "node:path";
import { stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { DeviceRegistry, parseScreen } from "framedeck-core";
import { loadDeviceIndexFromFs } from "framedeck-core/fs";
import { renderDocumentNode } from "framedeck-renderer/node";
import { resolveAssetsRoot } from "../assets.js";
import { flag, type ParsedArgs } from "../args.js";

export async function watchCommand(args: ParsedArgs): Promise<void> {
  const input = args.positional[1] ?? ".";
  const dir = resolve(input);
  const stats = await stat(dir);
  if (!stats.isDirectory()) {
    console.error(`watch expects a directory (got ${dir})`);
    process.exit(2);
  }
  const assetsRoot = resolveAssetsRoot(flag(args, "assets"));
  const devices = new DeviceRegistry(assetsRoot, loadDeviceIndexFromFs(assetsRoot));
  const scale = Number.parseFloat(flag(args, "scale") ?? "1") || 1;
  const outDir = flag(args, "out") ? resolve(flag(args, "out")!) : join(dir, "out");

  const chokidar = await import("chokidar");
  const watcher = chokidar.watch([join(dir, "screens/**/*.screen"), join(dir, "shots/**/*")], {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
  });

  console.log(`Watching ${dir}\n  out → ${outDir}\n  scale ×${scale}\n`);
  watcher.on("all", async (event, path) => {
    if (!path.endsWith(".screen")) {
      // A shot changed — re-render every screen (cheap for small projects).
      const { listScreens } = await import("framedeck-core/fs");
      for (const s of listScreens(dir)) {
        await safeRender(s.path, outDir, scale, devices);
      }
      return;
    }
    if (event === "unlink") return;
    await safeRender(path, outDir, scale, devices);
  });
}

async function safeRender(source: string, outDir: string, scale: number, devices: DeviceRegistry) {
  try {
    const text = await readFile(source, "utf8");
    const doc = parseScreen(text, source);
    const canvas = await renderDocumentNode(doc, {
      baseDir: dirname(source),
      devices,
      scale,
    });
    const buf = (canvas as unknown as { toBuffer: (m: string) => Buffer }).toBuffer("image/png");
    const target = join(outDir, source.split("/").pop()!.replace(/\.screen$/, ".png"));
    await mkdir(outDir, { recursive: true });
    await writeFile(target, buf);
    console.log(`  ✓ ${source.split("/").pop()} → ${target}`);
  } catch (err) {
    console.error(`  ✗ ${source}: ${(err as Error).message}`);
  }
}
