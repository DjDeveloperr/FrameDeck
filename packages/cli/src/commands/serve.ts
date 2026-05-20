// `screendeck` (no args) or `screendeck editor` — boot the editor web app.
//
// We spawn Next.js (`next dev`) inside the workspace's @screendeck/web
// package, with environment variables pointing to the user's projects/assets
// directories. Once Next reports ready we print friendly URLs (localhost +
// every non-loopback IPv4 the machine exposes).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PROJECT_SUBDIR,
  detectProjectRoot,
  ensureProject,
  registerProject,
  registryProjectsRoot,
  type Project,
} from "@screendeck/core/fs";
import { resolveAssetsRoot } from "../assets.js";
import { flag, type ParsedArgs } from "../args.js";

interface ServeOptions {
  mode: "project" | "editor";
}

export async function serveCommand(args: ParsedArgs, options: ServeOptions): Promise<void> {
  const port = (flag(args, "port", "p") ?? "4242").toString();
  const verbose = !!flag(args, "verbose");
  const webDir = findWebDir();
  if (!webDir) {
    console.error(
      "Could not find the @screendeck/web package. Run `screendeck serve` from\n" +
      "within the ScreenDeck workspace, or pass --web-dir <path>.",
    );
    process.exit(1);
  }

  const appRoot = resolve(flag(args, "cwd") ?? process.cwd());
  const projectsDir = resolveDir(flag(args, "projects"), registryProjectsRoot());
  const assetsDir = resolveDir(flag(args, "assets"), defaultAssetsDir());
  const activeProject = options.mode === "project"
    ? prepareActiveProject(args, appRoot)
    : null;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: port,
    HOSTNAME: flag(args, "host") ?? "0.0.0.0",
  };
  if (projectsDir) env.SCREENDECK_PROJECTS = projectsDir;
  if (assetsDir) env.SCREENDECK_ASSETS = assetsDir;
  if (activeProject) {
    env.SCREENDECK_ACTIVE_PROJECT_ID = activeProject.manifest.id;
    env.SCREENDECK_ACTIVE_PROJECT_ROOT = activeProject.root;
    if (activeProject.appRoot) env.SCREENDECK_ACTIVE_APP_ROOT = activeProject.appRoot;
  } else {
    delete env.SCREENDECK_ACTIVE_PROJECT_ID;
    delete env.SCREENDECK_ACTIVE_PROJECT_ROOT;
    delete env.SCREENDECK_ACTIVE_APP_ROOT;
  }

  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

  process.stdout.write(dim("  starting ScreenDeck…\r"));

  const child = spawn("npx", ["next", "dev", "-p", port], {
    cwd: webDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  const printBannerOnce = () => {
    if (ready) return;
    ready = true;
    // Clear the "starting…" line and draw the banner.
    process.stdout.write("\r\x1b[2K");
    const targetPath = activeProject ? `/projects/${encodeURIComponent(activeProject.manifest.id)}` : "";
    const local = `http://localhost:${port}${targetPath}`;
    process.stdout.write(`\n  ${bold("ScreenDeck")}  ${dim("· " + local)}\n\n`);
    if (activeProject) {
      process.stdout.write(`    ${"Project".padEnd(8)}${activeProject.manifest.name} ${dim(activeProject.root)}\n`);
    }
    process.stdout.write(`    ${"Local".padEnd(8)}${dim(local)}\n`);
    for (const ip of getLanIps()) {
      process.stdout.write(`    ${"Network".padEnd(8)}${dim("http://" + ip + ":" + port + targetPath)}\n`);
    }
    process.stdout.write(`\n  ${dim("Press Ctrl-C to stop.")}\n\n`);
  };

  // Buffer Next's stdout silently. Once it reports ready, draw the banner.
  // Compile-time issues are surfaced via stderr (always passed through).
  // `--verbose` opts in to the full Next output stream.
  child.stdout.on("data", (chunk: Buffer) => {
    const s = chunk.toString();
    if (verbose) process.stdout.write(s);
    if (!ready && /Ready in|started server|✓ Ready/i.test(s)) {
      printBannerOnce();
    }
    // Surface compile errors / fatal messages even in quiet mode.
    if (!verbose && /^\s*(⨯|Error|error -|FATAL)/m.test(s)) {
      process.stdout.write("\n" + s);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk));

  const forwardSignal = (sig: NodeJS.Signals) => {
    try {
      child.kill(sig);
    } catch {
      /* ignored */
    }
  };
  process.on("SIGINT", () => {
    process.stdout.write(`\n  ${dim("stopping…")}\n`);
    forwardSignal("SIGINT");
  });
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code) => process.exit(code ?? 0));
}

function prepareActiveProject(args: ParsedArgs, appRoot: string): Project {
  const explicit = flag(args, "project", "project-dir")
    ?? process.env.SCREENDECK_PROJECT
    ?? process.env.SCREENDECK_PROEJCT;
  const root = detectProjectRoot(appRoot, explicit);
  const subdir = inferSubdir(appRoot, root);
  const project = ensureProject(root, {
    appRoot,
    subdir: subdir ?? DEFAULT_PROJECT_SUBDIR,
    name: flag(args, "display-name", "name"),
    device: flag(args, "device"),
  });
  return registerProject(project.root, { appRoot, subdir });
}

/** Walk up from this file looking for `packages/web` (workspace install). */
function findWebDir(): string | null {
  const explicit = process.env.SCREENDECK_WEB_DIR;
  if (explicit && existsSync(join(explicit, "package.json"))) return explicit;
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "packages", "web");
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const sibling = join(dir, "..", "web");
    if (existsSync(join(sibling, "package.json"))) return resolve(sibling);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function defaultProjectsDir(): string | null {
  return registryProjectsRoot();
}

function defaultAssetsDir(): string | null {
  try {
    return resolveAssetsRoot();
  } catch {
    const candidate = join(process.cwd(), "assets", "device-bezels");
    if (existsSync(candidate)) return resolve(candidate);
    return null;
  }
}

function resolveDir(explicit: string | undefined, fallback: string | null): string | null {
  if (explicit) return resolve(explicit);
  return fallback;
}

function inferSubdir(appRoot: string, projectRoot: string): string | undefined {
  const rel = relative(resolve(appRoot), resolve(projectRoot));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return rel;
}

function getLanIps(): string[] {
  const ifaces = networkInterfaces();
  const ips: string[] = [];
  for (const name in ifaces) {
    for (const addr of ifaces[name] ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}
