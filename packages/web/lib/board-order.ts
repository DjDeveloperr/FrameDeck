import "server-only";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseScreen, type Board, type BoardScreen, type BoardsManifest, type Project } from "@framedeck/core";
import { loadBoardsFromFs, saveBoardsToFs } from "@framedeck/core/fs";

const BOARD_GAP = 160;
const DEFAULT_SCREEN_WIDTH = 1284;

export interface BoardOrderResult {
  boards: Board[];
  renames: Record<string, string>;
}

export async function normalizeProjectBoards(project: Project): Promise<Board[]> {
  await recoverRenameJournals(project.root);
  let manifest = loadBoardsFromFs(project.root, project.screens.map((s) => s.name));
  const existingNames = listScreenNames(project.root);
  const reconciled = reconcileBoardsToFiles(manifest.boards, existingNames);
  const changedBoards = new Set<string>();
  for (const board of reconciled) {
    const original = manifest.boards.find((b) => b.id === board.id);
    if (!sameBoardScreens(original?.screens ?? [], board.screens)) changedBoards.add(board.id);
  }
  if (changedBoards.size > 0) manifest = { boards: reconciled };

  for (const board of manifest.boards) {
    if (!changedBoards.has(board.id) && !needsBoardNormalization(project.root, board)) continue;
    const result = await applyBoardOrder(project, board.id, board.screens.map((s) => s.name));
    if (!result) continue;
    manifest = { boards: result.boards };
  }
  return manifest.boards;
}

export async function sanitizeBoardsManifest(project: Project, manifest: BoardsManifest): Promise<BoardsManifest> {
  await recoverRenameJournals(project.root);
  return { boards: reconcileBoardsToFiles(manifest.boards, listScreenNames(project.root)) };
}

export async function applyBoardOrder(
  project: Project,
  boardId: string,
  names: string[],
): Promise<BoardOrderResult | null> {
  await recoverRenameJournals(project.root);
  const manifest = loadBoardsFromFs(project.root, project.screens.map((s) => s.name));
  const allNames = listScreenNames(project.root);
  const resolvedBoards = reconcileBoardsToFiles(manifest.boards, allNames);
  const board = resolvedBoards.find((b) => b.id === boardId);
  if (!board) return null;

  const current = new Map(board.screens.map((s) => [s.name, s]));
  const orderedNames = resolveOrderedNames(names, allNames).filter((name) => current.has(name));
  const orderedScreens = orderedNames.map((name) => current.get(name)!);
  let boards = resolvedBoards.map((b) =>
    b.id === boardId ? { ...b, screens: compactScreens(project.root, orderedScreens) } : b,
  );

  const renames = buildNumericRenameMap(allNames, orderedNames);
  if (Object.keys(renames).length > 0) {
    await renameScreenFiles(project.root, renames);
    boards = boards.map((b) => ({
      ...b,
      screens: b.screens.map((s) => ({
        ...s,
        name: renames[s.name] ?? s.name,
      })),
    }));
  }

  boards = boards.map((b) =>
    b.id === boardId ? { ...b, screens: compactScreens(project.root, b.screens) } : b,
  );
  saveBoardsToFs(project.root, { boards });
  return { boards, renames };
}

function needsBoardNormalization(projectRoot: string, board: Board): boolean {
  if (board.screens.length <= 1) return false;

  const numbered = board.screens.map((s) => parseNumberedName(s.name));
  if (numbered.every(Boolean)) {
    for (let i = 0; i < numbered.length; i++) {
      if (numbered[i]!.n !== i + 1) return true;
    }
  }

  const isSingleRow = board.screens.every((s) => Math.abs(s.y - board.screens[0]!.y) <= 1);
  const isAlreadyOrderedByX = board.screens.every((s, i) => i === 0 || s.x >= board.screens[i - 1]!.x);
  if (!isSingleRow || !isAlreadyOrderedByX) return false;

  const compacted = compactScreens(projectRoot, board.screens);
  return board.screens.some((s, i) => Math.abs(s.x - compacted[i]!.x) > BOARD_GAP / 2);
}

function compactScreens(projectRoot: string, screens: BoardScreen[]): BoardScreen[] {
  let x = 0;
  return screens.map((screen) => {
    const next = { ...screen, x, y: 0 };
    x += screenWidth(projectRoot, screen.name) + BOARD_GAP;
    return next;
  });
}

function screenWidth(projectRoot: string, name: string): number {
  try {
    const source = readFileSync(join(projectRoot, "screens", `${name}.screen`), "utf8");
    const size = parseScreen(source).root.attrs.size;
    const m = size?.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!m) return DEFAULT_SCREEN_WIDTH;
    return Number.parseInt(m[1]!, 10);
  } catch {
    return DEFAULT_SCREEN_WIDTH;
  }
}

function listScreenNames(projectRoot: string): string[] {
  const dir = join(projectRoot, "screens");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".screen") && !f.startsWith(".renaming-"))
    .map((f) => f.slice(0, -".screen".length));
}

function reconcileBoardsToFiles(boards: Board[], existingNames: string[]): Board[] {
  const resolver = createNameResolver(existingNames);
  return boards.map((board) => {
    const used = new Set<string>();
    const screens: BoardScreen[] = [];
    for (const screen of board.screens) {
      const name = resolver(screen.name, used);
      if (!name) continue;
      used.add(name);
      screens.push(name === screen.name ? screen : { ...screen, name });
    }
    return { ...board, screens };
  });
}

function resolveOrderedNames(names: string[], existingNames: string[]): string[] {
  const resolver = createNameResolver(existingNames);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    const resolved = resolver(name, seen);
    if (!resolved) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function createNameResolver(existingNames: string[]): (name: string, used: Set<string>) => string | null {
  const existing = new Set(existingNames);
  const byTail = new Map<string, string[]>();
  for (const name of existingNames) {
    const key = screenIdentity(name);
    const matches = byTail.get(key) ?? [];
    matches.push(name);
    byTail.set(key, matches);
  }
  return (name, used) => {
    if (existing.has(name) && !used.has(name)) return name;
    const matches = byTail.get(screenIdentity(name)) ?? [];
    return matches.find((candidate) => !used.has(candidate)) ?? null;
  };
}

function screenIdentity(name: string): string {
  return parseNumberedName(name)?.tail ?? name;
}

function sameBoardScreens(a: BoardScreen[], b: BoardScreen[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((screen, index) => {
    const other = b[index];
    return other != null && screen.name === other.name && screen.x === other.x && screen.y === other.y;
  });
}

function buildNumericRenameMap(allNames: string[], orderedNames: string[]): Record<string, string> {
  const parsed = orderedNames
    .map((name) => ({ name, parsed: parseNumberedName(name) }))
    .filter((entry): entry is { name: string; parsed: { width: number; tail: string; n: number } } => entry.parsed != null);
  if (parsed.length === 0) return {};

  const width = Math.max(2, ...parsed.map((entry) => entry.parsed.width));
  const orderedSet = new Set(orderedNames);
  const used = new Set(allNames.filter((name) => !orderedSet.has(name)));
  const renames: Record<string, string> = {};

  orderedNames.forEach((name, index) => {
    const info = parseNumberedName(name);
    if (!info) return;
    const prefix = String(index + 1).padStart(width, "0");
    let target = `${prefix}-${info.tail}`;
    let suffix = 2;
    while (used.has(target)) target = `${prefix}-${info.tail}-${suffix++}`;
    used.add(target);
    if (target !== name) renames[name] = target;
  });

  return renames;
}

function parseNumberedName(name: string): { width: number; tail: string; n: number } | null {
  const m = name.match(/^(\d+)[-_\s]+(.+)$/);
  if (!m) return null;
  return { width: m[1]!.length, tail: m[2]!, n: Number.parseInt(m[1]!, 10) };
}

interface RenamePlanEntry {
  from: string;
  temp: string;
  to: string;
}

async function renameScreenFiles(projectRoot: string, renames: Record<string, string>): Promise<void> {
  const dir = join(projectRoot, "screens");
  const token = `.renaming-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const plan: RenamePlanEntry[] = Object.entries(renames).map(([from, to]) => ({
    from: join(dir, `${from}.screen`),
    temp: join(dir, `${token}-${to}.screen`),
    to: join(dir, `${to}.screen`),
  }));
  const journal = join(dir, `${token}.json`);
  await writeFile(journal, JSON.stringify(plan, null, 2), "utf8");

  try {
    for (const entry of plan) {
      if (existsSync(entry.from)) await rename(entry.from, entry.temp);
    }
    for (const entry of plan) {
      if (existsSync(entry.temp)) await rename(entry.temp, entry.to);
    }
    await rm(journal, { force: true });
  } catch (err) {
    await rollbackRenamePlan(plan, journal);
    throw err;
  }
}

async function recoverRenameJournals(projectRoot: string): Promise<void> {
  const dir = join(projectRoot, "screens");
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (!file.startsWith(".renaming-") || !file.endsWith(".json")) continue;
    const journal = join(dir, file);
    try {
      const plan = JSON.parse(readFileSync(journal, "utf8")) as RenamePlanEntry[];
      for (const entry of plan) {
        if (existsSync(entry.temp) && !existsSync(entry.to)) await rename(entry.temp, entry.to);
      }
      await rm(journal, { force: true });
    } catch {
      // Leave unreadable journals alone; manual recovery is safer than guessing.
    }
  }
}

async function rollbackRenamePlan(plan: RenamePlanEntry[], journal: string): Promise<void> {
  for (const entry of plan) {
    if (existsSync(entry.temp) && !existsSync(entry.from)) {
      await rename(entry.temp, entry.from);
    }
  }
  await rm(journal, { force: true });
}
