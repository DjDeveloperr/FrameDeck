// Render a single screen to PNG using the Node renderer.
//
//   GET /api/projects/[id]/render/<name>.png
//     → image/png (Content-Disposition: attachment)
//
//   Query params:
//     scale=N   pixel multiplier (default 1; e.g. 2 for HiDPI)

import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { DeviceRegistry, parseScreen } from "framedeck-core";
import { loadDeviceIndexFromFs } from "framedeck-core/fs";
import { renderDocumentNode } from "framedeck-renderer/node";
import { findProject, readScreen } from "@/lib/projects";
import { assetsRoot } from "@/lib/paths";

let cachedDevices: DeviceRegistry | null = null;
function getDevices(): DeviceRegistry {
  if (cachedDevices) return cachedDevices;
  const root = assetsRoot();
  cachedDevices = new DeviceRegistry(root, loadDeviceIndexFromFs(root));
  return cachedDevices;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;
  const project = findProject(id);
  if (!project) return new NextResponse("not found", { status: 404 });
  const screenName = name.replace(/\.png$/i, "");
  const source = await readScreen(id, screenName);
  if (source == null) return new NextResponse("not found", { status: 404 });

  const scaleParam = req.nextUrl.searchParams.get("scale");
  const scale = scaleParam ? Math.max(0.25, Math.min(4, Number.parseFloat(scaleParam))) : 1;

  const doc = parseScreen(source);
  const canvas = await renderDocumentNode(doc, {
    baseDir: join(project.root, "screens"),
    devices: getDevices(),
    scale,
  });
  const buf = (canvas as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer("image/png");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${screenName}.png"`,
      "cache-control": "private, no-store, max-age=0",
    },
  });
}
