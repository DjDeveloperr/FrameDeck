// Server-only utilities for projects: list, load, read/write screen sources.
import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverProjects, loadProject, loadRegisteredProjects } from "@framedeck/core/fs";
import type { Project } from "@framedeck/core";
import { projectsRoot, safeResolve } from "./paths";

export function listProjects(): Project[] {
  const projects: Project[] = [];
  const seenIds = new Set<string>();
  const seenRoots = new Set<string>();
  for (const project of [...loadRegisteredProjects(), ...discoverProjects(projectsRoot())]) {
    if (seenRoots.has(project.root) || seenIds.has(project.manifest.id)) continue;
    projects.push(project);
    seenRoots.add(project.root);
    seenIds.add(project.manifest.id);
  }
  return projects.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export function findProject(id: string): Project | null {
  for (const project of listProjects()) {
    if (project.manifest.id === id) return project;
  }
  // Allow folder-name fallback.
  try {
    return loadProject(safeResolve(projectsRoot(), id));
  } catch {
    return null;
  }
}

export async function readScreen(projectId: string, name: string): Promise<string | null> {
  const project = findProject(projectId);
  if (!project) return null;
  const path = join(project.root, "screens", `${name}.screen`);
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function writeScreen(projectId: string, name: string, source: string): Promise<void> {
  const project = findProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!/^[a-z0-9._-]+$/i.test(name)) {
    throw new Error(`Invalid screen name: ${name}`);
  }
  const path = join(project.root, "screens", `${name}.screen`);
  await writeFile(path, source, "utf8");
}
