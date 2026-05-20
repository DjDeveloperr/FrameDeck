// `screendeck init <name>` — scaffold a new project directory with project.json
// and a starter screen file. Friendly to both humans and agents.

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createProject, registerProject, toSlug } from "@screendeck/core/fs";
import { flag, type ParsedArgs } from "../args.js";

export async function initCommand(args: ParsedArgs): Promise<void> {
  const name = args.positional[1];
  if (!name) {
    console.error("usage: screendeck init <project-name>");
    process.exit(2);
  }
  const dir = resolve(name);
  const folderName = basename(dir);
  if (existsSync(dir) && (await readdir(dir)).length > 0) {
    console.error(`Directory ${dir} already exists and is not empty.`);
    process.exit(1);
  }
  const displayName = flag(args, "display-name") ?? toDisplayName(folderName);
  const device = flag(args, "device") ?? "iphone-16-pro-max";

  const project = createProject(dir, {
    name: displayName,
    id: toSlug(folderName),
    description: "Screenshots project for " + displayName,
    device,
  });
  registerProject(project.root);

  console.log(`Created project at ${dir}\n`);
  console.log("Next steps:");
  console.log(`  cd ${name}`);
  console.log(`  screendeck render screens/hero.screen`);
}

function toDisplayName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
