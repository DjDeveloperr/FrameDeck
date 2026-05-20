// Persist an ordered board, compact its screen positions, and keep numeric
// filename prefixes in board order. Renames are reflected across every board
// reference, but only screens in the submitted board order are renamed.

import { NextRequest, NextResponse } from "next/server";
import { applyBoardOrder } from "@/lib/board-order";
import { findProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

interface Body {
  names?: string[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; boardId: string }> },
) {
  const { id, boardId } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }
  if (!Array.isArray(body.names)) {
    return new NextResponse("expected { names: [] }", { status: 400 });
  }

  const result = await applyBoardOrder(project, boardId, body.names);
  if (!result) return new NextResponse("board not found", { status: 404 });
  return NextResponse.json(result);
}
