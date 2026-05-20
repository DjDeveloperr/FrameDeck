import { NextRequest, NextResponse } from "next/server";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve } from "node:path";
import {
  createProject,
  registerProject,
  registryProjectsRoot,
  toSlug,
} from "framedeck-core/fs";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export function GET() {
  const projects = listProjects().map((p) => ({
    manifest: p.manifest,
    root: p.root,
    appRoot: p.appRoot,
    subdir: p.subdir,
    screens: p.screens.map((s) => s.name),
  }));
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  let body: {
    name?: unknown;
    directory?: unknown;
    subdir?: unknown;
    device?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return new NextResponse("name is required", { status: 400 });

  const directory = typeof body.directory === "string" ? body.directory.trim() : "";
  let subdir: string | undefined;
  try {
    subdir = normalizeSubdir(typeof body.subdir === "string" ? body.subdir : "");
  } catch (err) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
  const device = typeof body.device === "string" && body.device.trim() ? body.device.trim() : undefined;

  const appRoot = directory ? expandUserPath(directory) : undefined;
  const root = appRoot
    ? (subdir ? resolve(appRoot, subdir) : appRoot)
    : resolve(registryProjectsRoot(), toSlug(name));

  try {
    const project = createProject(root, {
      name,
      id: toSlug(name),
      appRoot,
      subdir,
      device,
    });
    const registered = registerProject(project.root, { appRoot, subdir });
    return NextResponse.json({
      project: {
        manifest: registered.manifest,
        root: registered.root,
        appRoot: registered.appRoot,
        subdir: registered.subdir,
        screens: registered.screens.map((s) => s.name),
      },
    }, { status: 201 });
  } catch (err) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

function expandUserPath(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return isAbsolute(path) ? normalize(path) : resolve(path);
}

function normalizeSubdir(value: string): string | undefined {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return undefined;
  const normalized = normalize(trimmed);
  if (normalized === "." || normalized.startsWith("..") || isAbsolute(normalized)) {
    throw new Error("subdir must stay inside the selected directory");
  }
  return normalized;
}
