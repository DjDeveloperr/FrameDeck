// `framedeck build` — render the current app repo's FrameDeck project.
//
// From an app workspace this resolves screenshots/ by default, then writes all
// screen exports into screenshots/dist/.

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, isAbsolute, relative, resolve } from "node:path";
import {
  DEFAULT_PROJECT_SUBDIR,
  detectProjectRoot,
  listScreens,
  loadProject,
  registerProject,
} from "framedeck-core/fs";
import { flag, type ParsedArgs } from "../args.js";
import { createDeviceRegistry, renderOne } from "./render.js";

export async function buildCommand(args: ParsedArgs): Promise<void> {
  const appRoot = resolve(flag(args, "cwd") ?? process.cwd());
  const explicitProject = args.positional[1]
    ?? flag(args, "project", "project-dir")
    ?? process.env.FRAMEDECK_PROJECT
    ?? process.env.FRAMEDECK_PROEJCT;
  const projectRoot = detectProjectRoot(appRoot, explicitProject);
  const manifestPath = join(projectRoot, "project.json");

  if (!existsSync(manifestPath)) {
    console.error(
      `No FrameDeck project found at ${projectRoot}\n` +
      `Run \`framedeck\` once from the app workspace to create ${DEFAULT_PROJECT_SUBDIR}/, ` +
      "or pass a project directory.",
    );
    process.exit(1);
    return;
  }

  const project = loadProject(projectRoot);
  const screens = listScreens(projectRoot);
  if (screens.length === 0) {
    console.error(`No .screen files found under ${join(projectRoot, "screens")}`);
    process.exit(1);
    return;
  }

  const out = flag(args, "out", "o");
  const outDir = out ? (isAbsolute(out) ? out : resolve(out)) : join(projectRoot, "dist");
  const scale = Number.parseFloat(flag(args, "scale", "s") ?? "1") || 1;
  const devices = createDeviceRegistry(flag(args, "assets"));

  await mkdir(outDir, { recursive: true });
  for (const screen of screens) {
    const target = join(outDir, `${screen.name}.png`);
    await renderOne(screen.path, target, scale, devices);
    console.log(`  ${screen.name}.screen -> ${target}`);
  }

  registerProject(projectRoot, {
    appRoot,
    subdir: inferSubdir(appRoot, projectRoot) ?? DEFAULT_PROJECT_SUBDIR,
  });
  console.log(`\n${project.manifest.name}: exported ${screens.length} screenshots to ${outDir}`);
}

function inferSubdir(appRoot: string, projectRoot: string): string | undefined {
  const rel = relative(resolve(appRoot), resolve(projectRoot));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return rel;
}
