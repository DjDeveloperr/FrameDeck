// Project boards manifest.
//
//   GET /api/projects/[id]/boards
//     → { boards: [...] }
//
//   PUT /api/projects/[id]/boards
//     body: { boards: [...] }   — replaces the entire manifest on disk.

import { NextRequest, NextResponse } from "next/server";
import { loadBoardsFromFs, saveBoardsToFs } from "framedeck-core/fs";
import type { BoardsManifest } from "framedeck-core";
import { sanitizeBoardsManifest } from "@/lib/board-order";
import { findProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });
  const manifest = loadBoardsFromFs(project.root, project.screens.map((s) => s.name));
  return NextResponse.json(manifest);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });
  let body: BoardsManifest;
  try {
    body = (await req.json()) as BoardsManifest;
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }
  if (!body || !Array.isArray(body.boards)) {
    return new NextResponse("expected { boards: [] }", { status: 400 });
  }
  const safeManifest = await sanitizeBoardsManifest(project, body);
  saveBoardsToFs(project.root, safeManifest);
  return new NextResponse(null, { status: 204 });
}
