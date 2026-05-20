// Stream a file from inside a project directory.
// Used by the web renderer as its baseDir for relative image paths.

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { findProject } from "@/lib/projects";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });
  const rel = normalize(path.join("/"));
  if (rel.split(sep).some((segment) => segment === "..")) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const abs = join(project.root, rel);
  try {
    await stat(abs);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  const buf = await readFile(abs);
  const ext = abs.split(".").pop()!.toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}
