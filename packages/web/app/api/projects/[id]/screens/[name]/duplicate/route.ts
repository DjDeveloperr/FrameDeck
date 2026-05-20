// POST /api/projects/[id]/screens/[name]/duplicate
//   Clones a .screen file, generating a unique new name (foo → foo-copy →
//   foo-copy-2, …). Responds with the new screen's name + source so the
//   editor can load it and add it to the active board.

import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findProject, readScreen } from "@/lib/projects";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });
  const source = await readScreen(id, name);
  if (source == null) return new NextResponse("not found", { status: 404 });

  const dir = join(project.root, "screens");
  const target = nextUniqueName(dir, name);
  await writeFile(join(dir, `${target}.screen`), source, "utf8");
  return NextResponse.json({ name: target, source });
}

function nextUniqueName(dir: string, baseName: string): string {
  const stem = baseName.replace(/-copy(-\d+)?$/, "");
  const candidate = (n: number) => (n === 1 ? `${stem}-copy` : `${stem}-copy-${n}`);
  for (let i = 1; i < 1000; i++) {
    const name = candidate(i);
    if (!existsSync(join(dir, `${name}.screen`))) return name;
  }
  return `${stem}-copy-${Date.now()}`;
}
