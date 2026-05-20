import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { assetsRoot } from "@/lib/paths";

// Streams a file from <repo>/assets/device-bezels/<...path>. Used by the
// web renderer's image loader to fetch bezels, masks, and any user-provided
// shots stored alongside the project.

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  json: "application/json",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = normalize(path.join("/"));
  if (rel.split(sep).some((segment) => segment === "..")) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const abs = join(assetsRoot(), rel);
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
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
