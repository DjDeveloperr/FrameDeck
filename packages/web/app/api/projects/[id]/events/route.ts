// SSE endpoint streaming project file changes.
//
//   data: {"kind":"screen","event":"change","name":"01-hero"}
//   data: {"kind":"boards","event":"change"}
//   data: {"kind":"project","event":"change"}
//   data: {"kind":"shots","event":"add","name":"foo.png"}

import { NextRequest } from "next/server";
import { basename } from "node:path";
import { acquireWatcher, releaseWatcher } from "@/lib/watchers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await acquireWatcher(id);
  if (!entry) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* ignore stream errors after close */
        }
      };

      const onChange = (event: { event: string; path: string }) => {
        const path = event.path;
        if (path.endsWith(".screen") && path.includes("/screens/")) {
          const name = basename(path, ".screen");
          if (name.startsWith(".renaming-")) return;
          send({ kind: "screen", event: event.event, name });
        } else if (path.endsWith("boards.json")) {
          send({ kind: "boards", event: event.event });
        } else if (path.endsWith("project.json")) {
          send({ kind: "project", event: event.event });
        } else if (path.includes("/shots/")) {
          send({ kind: "shots", event: event.event, name: basename(path) });
        }
      };
      entry.emitter.on("change", onChange);

      // Open with a hello, so the client knows the stream is alive.
      send({ kind: "hello", project: id });

      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignored */
        }
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        entry.emitter.off("change", onChange);
        releaseWatcher(id);
        try {
          controller.close();
        } catch {
          /* ignore close errors */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
