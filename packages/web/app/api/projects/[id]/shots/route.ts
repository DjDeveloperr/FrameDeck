// List existing screenshots, or upload a new one.
//
//   GET  → { shots: [{ name, url, path }, ...] }
//   POST → multipart `file` field; saved under projects/<id>/shots/<safeName>

import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });

  const dir = join(project.root, "shots");
  if (!existsSync(dir)) return NextResponse.json({ shots: [] });
  const entries = (await readdir(dir)).filter((f) => IMAGE_RE.test(f));
  return NextResponse.json({
    shots: entries.map((name) => ({
      name,
      path: `shots/${name}`,
      url: `/api/projects/${id}/files/shots/${encodeURIComponent(name)}`,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new NextResponse('expected "file" field', { status: 400 });
  }
  if (!IMAGE_RE.test(file.name)) {
    return new NextResponse("file must be png/jpg/webp/gif", { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = join(project.root, "shots");
  await mkdir(dir, { recursive: true });
  const safe = uniqueSafeName(file.name, dir);
  await writeFile(join(dir, safe), buf);
  return NextResponse.json({
    name: safe,
    path: `shots/${safe}`,
    url: `/api/projects/${id}/files/shots/${encodeURIComponent(safe)}`,
  });
}

function uniqueSafeName(input: string, dir: string): string {
  const base = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!existsSync(join(dir, base))) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot >= 0 ? base.slice(0, dot) : base;
  const ext = dot >= 0 ? base.slice(dot) : "";
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}
