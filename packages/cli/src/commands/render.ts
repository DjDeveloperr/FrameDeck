// `screendeck render <input> [--out <path>] [--scale 2] [--assets <dir>]`
//
// `<input>` is either a single .screen file or a directory. When a directory
// is passed, every .screen file inside `screens/` is rendered.

import { readFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve, basename, isAbsolute } from "node:path";
import { DeviceRegistry, parseScreen } from "@screendeck/core";
import { listScreens, loadDeviceIndexFromFs } from "@screendeck/core/fs";
import { renderDocumentNode, nodeBackend } from "@screendeck/renderer/node";
import { resolveAssetsRoot } from "../assets.js";
import { flag, type ParsedArgs } from "../args.js";

export function createDeviceRegistry(assets?: string): DeviceRegistry {
  const assetsRoot = resolveAssetsRoot(assets);
  return new DeviceRegistry(assetsRoot, loadDeviceIndexFromFs(assetsRoot));
}

export async function renderCommand(args: ParsedArgs): Promise<void> {
  const input = args.positional[1];
  if (!input) {
    console.error("usage: screendeck render <file-or-dir> [--out <path>] [--scale N]");
    process.exit(2);
    return;
  }
  const inputPath = resolve(input);
  const scale = Number.parseFloat(flag(args, "scale", "s") ?? "1") || 1;
  const devices = createDeviceRegistry(flag(args, "assets"));

  const out = flag(args, "out", "o");
  const stats = await stat(inputPath);

  if (stats.isDirectory()) {
    const screens = listScreens(inputPath);
    if (screens.length === 0) {
      console.error(`No .screen files found under ${join(inputPath, "screens")}`);
      process.exit(1);
    }
    const outDir = out ? resolve(out) : join(inputPath, "out");
    await mkdir(outDir, { recursive: true });
    for (const screen of screens) {
      const target = join(outDir, `${screen.name}.png`);
      await renderOne(screen.path, target, scale, devices);
      console.log(`  ${screen.name}.screen → ${target}`);
    }
    return;
  }

  const target = out
    ? (isAbsolute(out) ? out : resolve(out))
    : inputPath.replace(/\.screen$/, ".png");
  await renderOne(inputPath, target, scale, devices);
  console.log(target);
}

export async function renderOne(
  source: string,
  outPath: string,
  scale: number,
  devices: DeviceRegistry,
): Promise<void> {
  const text = await readFile(source, "utf8");
  const doc = parseScreen(text, source);
  const canvas = await renderDocumentNode(doc, {
    baseDir: dirname(source),
    devices,
    scale,
    backend: nodeBackend,
  });
  await mkdir(dirname(outPath), { recursive: true });
  const buf = (canvas as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer("image/png");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outPath, buf);
  // Surface a hint about which device/size was used.
  const size = doc.root.attrs.size ?? "?";
  if (process.env.SCREENDECK_DEBUG) {
    console.error(`  rendered ${basename(source)} @ ${size} ×${scale}`);
  }
}
