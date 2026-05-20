import { NextResponse } from "next/server";
import { loadDeviceIndexFromFs } from "@screendeck/core/fs";
import { assetsRoot } from "@/lib/paths";

export const dynamic = "force-static";

// Mirrors index.json one-for-one so the client can build its own DeviceRegistry.
export function GET() {
  const index = loadDeviceIndexFromFs(assetsRoot());
  return NextResponse.json(index, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
