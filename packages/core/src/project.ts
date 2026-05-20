// Project manifest helpers.
//
// A project lives in a directory containing project.json plus one or more
// .screen files under screens/. The shape is intentionally minimal so that
// users (and agents) can hand-edit it without ceremony.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

export interface ProjectExport {
  /** Output filename stem (e.g. "iphone-6.9"). */
  name: string;
  /** Output dimensions, e.g. "1290x2796". */
  size: string;
  /** Optional default device used when a screen omits `device=`. */
  device?: string;
}

export interface ProjectManifest {
  /** Human display name. */
  name: string;
  /** Stable id (folder-name slug). */
  id: string;
  /** Optional description. */
  description?: string;
  /** Output presets users can render to. Optional. */
  exports?: ProjectExport[];
}

export interface ProjectScreen {
  /** Stem of the file (e.g. "hero"). */
  name: string;
  /** Absolute path to the .screen file. */
  path: string;
}

export interface Project {
  manifest: ProjectManifest;
  /** Absolute path to the project root directory. */
  root: string;
  /** App/workspace root that owns this project, when known. */
  appRoot?: string;
  /** Project subdirectory below appRoot, when known. */
  subdir?: string;
  screens: ProjectScreen[];
}

export interface ProjectRegistryEntry {
  id: string;
  name: string;
  root: string;
  appRoot?: string;
  subdir?: string;
  updatedAt: string;
}

export interface ProjectRegistry {
  version: 1;
  projects: ProjectRegistryEntry[];
}

export interface CreateProjectOptions {
  name?: string;
  id?: string;
  description?: string;
  appRoot?: string;
  subdir?: string;
  device?: string;
}

export const DEFAULT_PROJECT_SUBDIR = "screenshots";

export function loadProject(root: string): Project {
  const projectRoot = resolve(root);
  const manifestPath = join(projectRoot, "project.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Not a FrameDeck project (no project.json at ${projectRoot})`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProjectManifest;
  const screens = listScreens(projectRoot);
  return { manifest, root: projectRoot, screens };
}

export function listScreens(root: string): ProjectScreen[] {
  const dir = join(root, "screens");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".screen"))
    .map((f) => ({ name: f.slice(0, -".screen".length), path: join(dir, f) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Discover projects under a directory (each subdir with project.json). */
export function discoverProjects(rootDir: string): Project[] {
  if (!existsSync(rootDir)) return [];
  const out: Project[] = [];
  for (const name of readdirSync(rootDir)) {
    const candidate = join(rootDir, name);
    if (!statSync(candidate).isDirectory()) continue;
    if (!existsSync(join(candidate, "project.json"))) continue;
    try {
      out.push(loadProject(candidate));
    } catch {
      // skip unreadable projects
    }
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export function framedeckHome(): string {
  return resolve(process.env.FRAMEDECK_HOME ?? join(homedir(), ".framedeck"));
}

export function registryProjectsRoot(): string {
  return join(framedeckHome(), "projects");
}

export function registryPath(): string {
  return join(framedeckHome(), "registry.json");
}

export function readProjectRegistry(): ProjectRegistry {
  const file = registryPath();
  if (!existsSync(file)) return { version: 1, projects: [] };
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<ProjectRegistry>;
    const projects = Array.isArray(raw.projects) ? raw.projects : [];
    return {
      version: 1,
      projects: projects
        .filter((entry): entry is ProjectRegistryEntry =>
          !!entry &&
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.root === "string",
        )
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          root: resolve(entry.root),
          appRoot: entry.appRoot ? resolve(entry.appRoot) : undefined,
          subdir: entry.subdir,
          updatedAt: entry.updatedAt ?? new Date(0).toISOString(),
        })),
    };
  } catch {
    return { version: 1, projects: [] };
  }
}

export function writeProjectRegistry(registry: ProjectRegistry): void {
  mkdirSync(framedeckHome(), { recursive: true });
  writeFileSync(registryPath(), JSON.stringify({ version: 1, projects: registry.projects }, null, 2) + "\n");
}

export function pruneProjectRegistry(): ProjectRegistry {
  const registry = readProjectRegistry();
  const projects = registry.projects.filter((entry) => existsSync(join(entry.root, "project.json")));
  if (projects.length !== registry.projects.length) {
    writeProjectRegistry({ version: 1, projects });
  }
  return { version: 1, projects };
}

export function registerProject(root: string, meta: { appRoot?: string; subdir?: string } = {}): Project {
  const project = loadProject(root);
  const entry: ProjectRegistryEntry = {
    id: project.manifest.id,
    name: project.manifest.name,
    root: project.root,
    appRoot: meta.appRoot ? resolve(meta.appRoot) : undefined,
    subdir: meta.subdir,
    updatedAt: new Date().toISOString(),
  };
  const registry = pruneProjectRegistry();
  const projects = [
    entry,
    ...registry.projects.filter((candidate) =>
      resolve(candidate.root) !== project.root && candidate.id !== project.manifest.id,
    ),
  ];
  writeProjectRegistry({ version: 1, projects });
  return { ...project, appRoot: entry.appRoot, subdir: entry.subdir };
}

export function loadRegisteredProjects(): Project[] {
  const registry = pruneProjectRegistry();
  const out: Project[] = [];
  for (const entry of registry.projects) {
    try {
      const project = loadProject(entry.root);
      out.push({ ...project, appRoot: entry.appRoot, subdir: entry.subdir });
    } catch {
      // pruneProjectRegistry removes stale entries on the next call.
    }
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export function createProject(root: string, options: CreateProjectOptions = {}): Project {
  const projectRoot = resolve(root);
  const displayName = options.name?.trim() || inferProjectName(projectRoot, options.appRoot);
  const id = toSlug(options.id?.trim() || displayName);
  const device = options.device ?? "iphone-16-pro-max";

  mkdirSync(join(projectRoot, "screens"), { recursive: true });
  mkdirSync(join(projectRoot, "shots"), { recursive: true });

  const manifestPath = join(projectRoot, "project.json");
  if (!existsSync(manifestPath)) {
    const manifest: ProjectManifest = {
      name: displayName,
      id,
      description: options.description ?? `Screenshots for ${displayName}`,
      exports: [
        { name: "iphone-6.9-portrait", size: "1284x2778", device },
        { name: "ipad-13-portrait", size: "2064x2752", device: "ipad-pro-13-m4" },
      ],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  const heroPath = join(projectRoot, "screens", "hero.screen");
  if (!existsSync(heroPath)) {
    writeFileSync(heroPath, sampleScreen(device));
  }

  return loadProject(projectRoot);
}

export function ensureProject(root: string, options: CreateProjectOptions = {}): Project {
  const projectRoot = resolve(root);
  if (!existsSync(join(projectRoot, "project.json"))) {
    return createProject(projectRoot, options);
  }
  return loadProject(projectRoot);
}

export function defaultProjectRootForApp(appRoot: string, subdir = DEFAULT_PROJECT_SUBDIR): string {
  return resolve(appRoot, subdir);
}

export function detectProjectRoot(appRoot: string, explicit?: string): string {
  const base = resolve(appRoot);
  if (explicit) return resolvePathFrom(base, explicit);
  if (existsSync(join(base, "project.json"))) return base;

  for (const candidate of [
    DEFAULT_PROJECT_SUBDIR,
    "framedeck",
    "frame-deck",
    ".framedeck",
  ]) {
    const root = resolve(base, candidate);
    if (existsSync(join(root, "project.json"))) return root;
    if (existsSync(root) && statSync(root).isDirectory()) return root;
  }

  try {
    for (const entry of readdirSync(base)) {
      const root = join(base, entry);
      if (statSync(root).isDirectory() && existsSync(join(root, "project.json"))) {
        return root;
      }
    }
  } catch {
    // fall through to default
  }

  return defaultProjectRootForApp(base);
}

export function toSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "screenshots";
}

function resolvePathFrom(base: string, value: string): string {
  if (value.startsWith("~")) return resolve(join(homedir(), value.slice(1)));
  return resolve(base, value);
}

function inferProjectName(projectRoot: string, appRoot?: string): string {
  const appName = appRoot ? basename(resolve(appRoot)) : "";
  const projectName = basename(projectRoot);
  if (appName && projectName === DEFAULT_PROJECT_SUBDIR) return toDisplayName(appName);
  return toDisplayName(projectName);
}

function toDisplayName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sampleScreen(device: string): string {
  return `<Screen size="1284x2778">
  <Background color="#0a0a0a" />

  <VStack padding="120" gap="32" alignItems="center">
    <Text size="118" weight="800" color="#ffffff" align="center" tracking="-2">
      Your app, framed.
    </Text>
    <Text size="40" weight="400" color="#a1a1aa" align="center" maxWidth="900">
      Edit this starter screen in FrameDeck.
    </Text>
    <Device model="${device}" width="820" alignSelf="center" />
  </VStack>
</Screen>
`;
}
