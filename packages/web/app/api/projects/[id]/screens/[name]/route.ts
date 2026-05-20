import { NextRequest, NextResponse } from "next/server";
import { readScreen, writeScreen } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  const source = await readScreen(id, name);
  if (source == null) return new NextResponse("not found", { status: 404 });
  return new NextResponse(source, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  const source = await req.text();
  try {
    await writeScreen(id, name, source);
  } catch (err) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
