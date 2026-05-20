// Per-project file watchers, shared across SSE clients.
//
// Each project gets at most one chokidar instance; SSE handlers subscribe to
// a small EventEmitter that mirrors the watcher's events. The watcher is
// torn down when the last subscriber disconnects.

import "server-only";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { findProject } from "./projects";

type ChokidarLike = {
  on(event: string, fn: (event: string, path: string) => void): unknown;
  close(): Promise<unknown> | void;
};

interface ProjectWatcher {
  emitter: EventEmitter;
  watcher: ChokidarLike;
  refCount: number;
}

const watchers = new Map<string, ProjectWatcher>();

export async function acquireWatcher(projectId: string): Promise<ProjectWatcher | null> {
  const project = findProject(projectId);
  if (!project) return null;
  let entry = watchers.get(projectId);
  if (!entry) {
    const { default: chokidar } = await import("chokidar");
    const watcher = chokidar.watch(project.root, {
      ignored: (path: string) => path.includes(`${join(project.root, "dist")}/`),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
      ignorePermissionErrors: true,
    }) as ChokidarLike;
    const emitter = new EventEmitter();
    watcher.on("all", (event, path) => {
      emitter.emit("change", { event, path });
    });
    entry = { emitter, watcher, refCount: 0 };
    watchers.set(projectId, entry);
  }
  entry.refCount++;
  return entry;
}

export function releaseWatcher(projectId: string): void {
  const entry = watchers.get(projectId);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    Promise.resolve(entry.watcher.close()).catch(() => {});
    watchers.delete(projectId);
  }
}
