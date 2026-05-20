"use client";

// Central editor store, rewritten for boards.
//
//   State shape:
//     boards         — user-visible groupings of screens (see core/boards.ts)
//     activeBoardId  — which board's screens are shown on the canvas
//     screens        — flat map keyed by screen-name, holds source / AST /
//                      history / selection per loaded screen
//     focusedScreen  — the screen whose elements the tree + inspector target
//                      (also the screen receiving keyboard shortcuts and undo)
//     viewMode       — visual | code
//
//   Persistence:
//     • screen sources auto-save (debounced) per screen.
//     • boards manifest auto-saves on any structural mutation.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  createElement,
  duplicateAt,
  insertChild,
  newBoardId,
  nextUntitledName,
  parseScreen,
  removeAt,
  resolvePath,
  serializeDocument,
  setAttrs as astSetAttrs,
  setText as astSetText,
  type Board,
  type BoardScreen,
  type BoardsManifest,
  type ElementPath,
  type ScreenDocument,
} from "@screendeck/core";

export type ViewMode = "visual" | "code";

const HISTORY_LIMIT = 100;
const COALESCE_WINDOW_MS = 600;
const BOARD_GAP = 160;
const DEFAULT_SCREEN_SIZE = { w: 1284, h: 2778 };

export interface ScreenData {
  name: string;
  /** Whether this screen has actually been fetched (false = stub from a board). */
  loaded: boolean;
  savedSource: string;
  source: string;
  doc: ScreenDocument | null;
  parseError: string | null;
  /** All selected element paths, in the order they were added. */
  selectedPaths: ElementPath[];
  /** Primary selection — equal to selectedPaths[last] (or [] when nothing is
   * selected). Kept in sync by withSelection() for back-compat with code that
   * targets a single element. */
  selectedPath: ElementPath;
  past: string[];
  future: string[];
  lastTextEditAt: number;
  transactionStart: string | null;
  dirty: boolean;
  saving: boolean;
}

interface State {
  projectId: string;
  boards: Board[];
  activeBoardId: string | null;
  screens: Record<string, ScreenData>;
  focusedScreen: string | null;
  /** Name of the screen with the most recent mutation. Used as the keyboard-
   * shortcut target when nothing is currently focused (so ⌘Z keeps working
   * after the user clicks the void to deselect). */
  lastEditedScreen: string | null;
  viewMode: ViewMode;
  /** Bumped on every boards mutation to drive auto-save. */
  boardsRevision: number;
}

type Action =
  | { type: "load-screen"; name: string; source: string }
  | { type: "reload-screen"; name: string; source: string }
  | { type: "remove-screen"; name: string }
  | { type: "set-source"; name: string; source: string }
  | { type: "set-attrs"; name: string; path: ElementPath; patch: Record<string, string | undefined>; transient?: boolean }
  | { type: "set-text"; name: string; path: ElementPath; text: string; transient?: boolean }
  | { type: "insert-child"; name: string; parentPath: ElementPath; tag: string }
  | { type: "duplicate"; name: string; path: ElementPath }
  | { type: "delete-element"; name: string; path: ElementPath }
  | { type: "begin-transaction"; name: string }
  | { type: "commit-transaction"; name: string }
  | { type: "cancel-transaction"; name: string }
  | { type: "undo"; name: string }
  | { type: "redo"; name: string }
  | { type: "select"; name: string; path: ElementPath; mode?: "replace" | "toggle" | "add" }
  | { type: "select-many"; name: string; paths: ElementPath[] }
  | { type: "clear-selection"; name?: string }
  | { type: "focus-screen"; name: string | null }
  | { type: "mark-saving"; name: string; saving: boolean }
  | { type: "mark-saved"; name: string }
  // Boards
  | { type: "set-active-board"; id: string }
  | { type: "create-board" }
  | { type: "rename-board"; id: string; name: string }
  | { type: "remove-board"; id: string }
  | { type: "add-screen-to-board"; boardId: string; screenName: string; x?: number; y?: number }
  | { type: "remove-screen-from-board"; boardId: string; screenName: string }
  | { type: "move-screen-in-board"; boardId: string; screenName: string; x: number; y: number }
  | { type: "set-board-screen-order"; boardId: string; names: string[] }
  | { type: "replace-boards"; boards: Board[]; renames?: Record<string, string> }
  | { type: "view-mode"; mode: ViewMode };

function parseSafely(source: string): { doc: ScreenDocument | null; error: string | null } {
  try {
    return { doc: parseScreen(source), error: null };
  } catch (err) {
    return { doc: null, error: (err as Error).message };
  }
}

function makeScreen(name: string, source: string): ScreenData {
  const { doc, error } = parseSafely(source);
  return {
    name,
    loaded: true,
    savedSource: source,
    source,
    doc,
    parseError: error,
    selectedPaths: [],
    selectedPath: [],
    past: [],
    future: [],
    lastTextEditAt: 0,
    transactionStart: null,
    dirty: false,
    saving: false,
  };
}

function stubScreen(name: string): ScreenData {
  return {
    name,
    loaded: false,
    savedSource: "",
    source: "",
    doc: null,
    parseError: null,
    selectedPaths: [],
    selectedPath: [],
    past: [],
    future: [],
    lastTextEditAt: 0,
    transactionStart: null,
    dirty: false,
    saving: false,
  };
}

/** Replace a screen's selection list, derive the primary single-selection. */
function withSelection(s: ScreenData, paths: ElementPath[]): ScreenData {
  // Filter empty paths (the root <Screen> is not selectable) and dedupe.
  const seen = new Set<string>();
  const cleaned: ElementPath[] = [];
  for (const p of paths) {
    if (p.length === 0) continue;
    const key = p.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(p);
  }
  const primary = cleaned[cleaned.length - 1] ?? [];
  return { ...s, selectedPaths: cleaned, selectedPath: primary };
}

function withScreen(state: State, name: string, fn: (s: ScreenData) => ScreenData): State {
  const current = state.screens[name];
  if (!current) return state;
  return { ...state, screens: { ...state.screens, [name]: fn(current) } };
}

function withBoards(state: State, fn: (boards: Board[]) => Board[]): State {
  return { ...state, boards: fn(state.boards), boardsRevision: state.boardsRevision + 1 };
}

function withBoardsNoSave(state: State, fn: (boards: Board[]) => Board[]): State {
  return { ...state, boards: fn(state.boards) };
}

function screenSizeFromState(state: State, name: string): { w: number; h: number } {
  const size = state.screens[name]?.doc?.root.attrs.size;
  if (!size) return DEFAULT_SCREEN_SIZE;
  const m = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) return DEFAULT_SCREEN_SIZE;
  return { w: Number.parseInt(m[1]!, 10), h: Number.parseInt(m[2]!, 10) };
}

function arrangeScreens(state: State, screens: BoardScreen[]): BoardScreen[] {
  let x = 0;
  return screens.map((screen) => {
    const next = { ...screen, x, y: 0 };
    x += screenSizeFromState(state, screen.name).w + BOARD_GAP;
    return next;
  });
}

function arrangedFromNames(state: State, board: Board, names: string[]): BoardScreen[] {
  const current = new Map(board.screens.map((s) => [s.name, s]));
  return arrangeScreens(
    state,
    names.map((name) => current.get(name) ?? { name, x: 0, y: 0 }),
  );
}

function renameScreenState(screens: Record<string, ScreenData>, renames: Record<string, string> | undefined, boards: Board[]): Record<string, ScreenData> {
  const next: Record<string, ScreenData> = {};
  for (const [name, screen] of Object.entries(screens)) {
    const newName = renames?.[name] ?? name;
    next[newName] = { ...screen, name: newName };
  }
  for (const board of boards) {
    for (const screen of board.screens) {
      if (!next[screen.name]) next[screen.name] = stubScreen(screen.name);
    }
  }
  return next;
}

function pushHistory(s: ScreenData, kind: "discrete" | "text", now: number): ScreenData {
  if (s.transactionStart != null) return { ...s, future: [] };
  const coalesce = kind === "text" && now - s.lastTextEditAt < COALESCE_WINDOW_MS && s.past.length > 0;
  if (coalesce) return { ...s, future: [], lastTextEditAt: now };
  const past = [...s.past, s.source];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { ...s, past, future: [], lastTextEditAt: now };
}

function applySource(s: ScreenData, nextSource: string, parseEager = true): ScreenData {
  const { doc, error } = parseEager ? parseSafely(nextSource) : { doc: s.doc, error: s.parseError };
  return {
    ...s,
    source: nextSource,
    doc: doc ?? s.doc,
    parseError: error,
    dirty: nextSource !== s.savedSource,
  };
}

// Actions where (action as { name }).name identifies the screen the user
// is currently editing. The reducer post-processes these to keep
// state.lastEditedScreen up to date so keyboard shortcuts (⌘Z, etc.) still
// target a sensible screen after the user clicks away to deselect.
const TRACKING_TYPES: ReadonlySet<Action["type"]> = new Set([
  "set-source",
  "set-attrs",
  "set-text",
  "insert-child",
  "duplicate",
  "delete-element",
  "undo",
  "redo",
  "select",
  "select-many",
]);

function reducer(state: State, action: Action): State {
  const next = innerReducer(state, action);
  if (next === state) return state;
  if (TRACKING_TYPES.has(action.type)) {
    const name = (action as { name?: string }).name;
    if (name && next.screens[name]) {
      return { ...next, lastEditedScreen: name };
    }
  }
  if (action.type === "focus-screen") {
    // Focus snapped to a real screen → make that the keyboard target.
    // Focus cleared → keep whatever was the focused screen as the fallback.
    const stickName = action.name ?? state.focusedScreen ?? state.lastEditedScreen;
    if (stickName !== state.lastEditedScreen) {
      return { ...next, lastEditedScreen: stickName };
    }
  }
  return next;
}

function innerReducer(state: State, action: Action): State {
  switch (action.type) {
    case "load-screen":
      return { ...state, screens: { ...state.screens, [action.name]: makeScreen(action.name, action.source) } };

    case "reload-screen": {
      // External edit landed (CLI, another editor) — refresh source without
      // wiping the user's selection / history if it still resolves.
      const existing = state.screens[action.name];
      const fresh = makeScreen(action.name, action.source);
      if (!existing) {
        return { ...state, screens: { ...state.screens, [action.name]: fresh } };
      }
      const keep = fresh.doc != null
        ? existing.selectedPaths.filter((p) => resolvePath(fresh.doc!, p) != null)
        : [];
      const merged = withSelection(
        { ...fresh, past: existing.past, future: existing.future },
        keep,
      );
      return {
        ...state,
        screens: { ...state.screens, [action.name]: merged },
      };
    }

    case "remove-screen": {
      const { [action.name]: _, ...rest } = state.screens;
      void _;
      return {
        ...state,
        screens: rest,
        focusedScreen: state.focusedScreen === action.name ? null : state.focusedScreen,
      };
    }

    case "set-source":
      return withScreen(state, action.name, (s) => {
        if (action.source === s.source) return s;
        const h = pushHistory(s, "text", Date.now());
        return applySource(h, action.source);
      });

    case "set-attrs":
      return withScreen(state, action.name, (s) => {
        if (!s.doc) return s;
        const next = astSetAttrs(s.doc, action.path, action.patch);
        const source = serializeDocument(next);
        if (source === s.source) return s;
        const base = action.transient ? s : pushHistory(s, "discrete", Date.now());
        return { ...applySource(base, source, false), doc: next, parseError: null };
      });

    case "set-text":
      return withScreen(state, action.name, (s) => {
        if (!s.doc) return s;
        const next = astSetText(s.doc, action.path, action.text);
        const source = serializeDocument(next);
        if (source === s.source) return s;
        const base = action.transient ? s : pushHistory(s, "text", Date.now());
        return { ...applySource(base, source, false), doc: next, parseError: null };
      });

    case "insert-child":
      return withScreen(state, action.name, (s) => {
        if (!s.doc) return s;
        const child = createElement(action.tag);
        const parent = resolvePath(s.doc, action.parentPath);
        if (!parent) return s;
        const childCount = parent.children.filter((c) => c.type === "element").length;
        const next = insertChild(s.doc, action.parentPath, child);
        const source = serializeDocument(next);
        const h = pushHistory(s, "discrete", Date.now());
        return withSelection(
          { ...applySource(h, source, false), doc: next, parseError: null },
          [[...action.parentPath, childCount]],
        );
      });

    case "duplicate":
      return withScreen(state, action.name, (s) => {
        if (!s.doc || action.path.length === 0) return s;
        const next = duplicateAt(s.doc, action.path);
        const source = serializeDocument(next);
        const idx = action.path[action.path.length - 1]!;
        const parentPath = action.path.slice(0, -1);
        const h = pushHistory(s, "discrete", Date.now());
        return withSelection(
          { ...applySource(h, source, false), doc: next, parseError: null },
          [[...parentPath, idx + 1]],
        );
      });

    case "delete-element":
      return withScreen(state, action.name, (s) => {
        if (!s.doc || action.path.length === 0) return s;
        const next = removeAt(s.doc, action.path);
        const source = serializeDocument(next);
        const parentPath = action.path.slice(0, -1);
        const h = pushHistory(s, "discrete", Date.now());
        return withSelection(
          { ...applySource(h, source, false), doc: next, parseError: null },
          parentPath.length > 0 ? [parentPath] : [],
        );
      });

    case "begin-transaction":
      return withScreen(state, action.name, (s) => (s.transactionStart != null ? s : { ...s, transactionStart: s.source }));

    case "commit-transaction":
      return withScreen(state, action.name, (s) => {
        const snap = s.transactionStart;
        if (snap == null) return s;
        if (snap === s.source) return { ...s, transactionStart: null };
        const past = [...s.past, snap];
        if (past.length > HISTORY_LIMIT) past.shift();
        return { ...s, transactionStart: null, past, future: [], lastTextEditAt: Date.now() };
      });

    case "cancel-transaction":
      return withScreen(state, action.name, (s) => {
        const snap = s.transactionStart;
        if (snap == null) return s;
        return { ...applySource(s, snap), transactionStart: null };
      });

    case "undo":
      return withScreen(state, action.name, (s) => {
        if (s.past.length === 0) return s;
        const past = s.past.slice();
        const previous = past.pop()!;
        const future = [...s.future, s.source];
        return { ...applySource(s, previous), past, future, transactionStart: null };
      });

    case "redo":
      return withScreen(state, action.name, (s) => {
        if (s.future.length === 0) return s;
        const future = s.future.slice();
        const next = future.pop()!;
        const past = [...s.past, s.source];
        return { ...applySource(s, next), past, future, transactionStart: null };
      });

    case "select": {
      // Single + multi-selection semantics.
      //   mode="replace" (default): selection becomes [path] on this screen.
      //   mode="add":               append path if not already in selection.
      //   mode="toggle":            toggle path in/out of selection.
      // Selecting on screen X always clears every OTHER screen's selection so
      // the editor never reports selections across multiple screens.
      const mode = action.mode ?? "replace";
      const screens: Record<string, ScreenData> = {};
      for (const [k, v] of Object.entries(state.screens)) {
        if (k === action.name) {
          let next: ElementPath[];
          if (mode === "replace") next = [action.path];
          else {
            const key = action.path.join(".");
            const has = v.selectedPaths.some((p) => p.join(".") === key);
            if (mode === "toggle") {
              next = has ? v.selectedPaths.filter((p) => p.join(".") !== key) : [...v.selectedPaths, action.path];
            } else {
              next = has ? v.selectedPaths : [...v.selectedPaths, action.path];
            }
          }
          screens[k] = withSelection(v, next);
        } else if (v.selectedPaths.length > 0) {
          screens[k] = withSelection(v, []);
        } else {
          screens[k] = v;
        }
      }
      return { ...state, screens, focusedScreen: action.name };
    }

    case "select-many": {
      // Marquee result — replace selection on this screen, clear all others.
      const screens: Record<string, ScreenData> = {};
      for (const [k, v] of Object.entries(state.screens)) {
        if (k === action.name) screens[k] = withSelection(v, action.paths);
        else if (v.selectedPaths.length > 0) screens[k] = withSelection(v, []);
        else screens[k] = v;
      }
      return { ...state, screens, focusedScreen: action.name };
    }

    case "clear-selection": {
      const screens: Record<string, ScreenData> = {};
      for (const [k, v] of Object.entries(state.screens)) {
        if (action.name && k !== action.name) {
          screens[k] = v;
          continue;
        }
        screens[k] = v.selectedPaths.length > 0 ? withSelection(v, []) : v;
      }
      return { ...state, screens };
    }

    case "focus-screen": {
      // Focusing null wipes every screen's selection; focusing a screen wipes
      // every OTHER screen's selection (the freshly-focused screen keeps its
      // last selection so single-tap focus+select still works).
      const screens: Record<string, ScreenData> = {};
      for (const [k, v] of Object.entries(state.screens)) {
        const keep = action.name != null && k === action.name;
        if (keep) screens[k] = v;
        else if (v.selectedPaths.length > 0) screens[k] = withSelection(v, []);
        else screens[k] = v;
      }
      return { ...state, focusedScreen: action.name, screens };
    }

    case "mark-saving":
      return withScreen(state, action.name, (s) => ({ ...s, saving: action.saving }));
    case "mark-saved":
      return withScreen(state, action.name, (s) => ({
        ...s,
        saving: false,
        dirty: false,
        savedSource: s.source,
      }));

    // ── Boards ───────────────────────────────────────────────────────────
    case "set-active-board":
      return { ...state, activeBoardId: action.id, focusedScreen: null };

    case "create-board": {
      const id = newBoardId();
      const name = nextUntitledName(state.boards);
      return {
        ...withBoards(state, (bs) => [...bs, { id, name, screens: [] }]),
        activeBoardId: id,
        focusedScreen: null,
      };
    }

    case "rename-board":
      return withBoards(state, (bs) =>
        bs.map((b) => (b.id === action.id ? { ...b, name: action.name } : b)),
      );

    case "remove-board": {
      const next = withBoards(state, (bs) => bs.filter((b) => b.id !== action.id));
      let activeBoardId = next.activeBoardId;
      if (activeBoardId === action.id) {
        const idx = state.boards.findIndex((b) => b.id === action.id);
        activeBoardId = next.boards[idx]?.id ?? next.boards[idx - 1]?.id ?? next.boards[0]?.id ?? null;
      }
      return { ...next, activeBoardId, focusedScreen: null };
    }

    case "add-screen-to-board": {
      return withBoards(state, (bs) =>
        bs.map((b) => {
          if (b.id !== action.boardId) return b;
          if (b.screens.some((s) => s.name === action.screenName)) return b;
          const fallback = b.screens.length === 0
            ? { x: 0, y: 0 }
            : { x: maxRight(b.screens) + 160, y: 0 };
          return {
            ...b,
            screens: [
              ...b.screens,
              { name: action.screenName, x: action.x ?? fallback.x, y: action.y ?? fallback.y },
            ],
          };
        }),
      );
    }

    case "remove-screen-from-board":
      return withBoards(state, (bs) =>
        bs.map((b) =>
          b.id === action.boardId
            ? { ...b, screens: arrangeScreens(state, b.screens.filter((s) => s.name !== action.screenName)) }
            : b,
        ),
      );

    case "move-screen-in-board":
      return withBoards(state, (bs) =>
        bs.map((b) =>
          b.id === action.boardId
            ? {
                ...b,
                screens: b.screens.map((s) =>
                  s.name === action.screenName ? { ...s, x: action.x, y: action.y } : s,
                ),
              }
            : b,
        ),
      );

    case "set-board-screen-order":
      return {
        ...withBoardsNoSave(state, (bs) =>
          bs.map((b) =>
            b.id === action.boardId
              ? { ...b, screens: arrangedFromNames(state, b, action.names) }
              : b,
          ),
        ),
        focusedScreen:
          action.boardId === state.activeBoardId && state.focusedScreen && !action.names.includes(state.focusedScreen)
            ? null
            : state.focusedScreen,
      };

    case "replace-boards": {
      const renames = action.renames ?? {};
      const mapName = (name: string | null) => (name ? renames[name] ?? name : null);
      const activeBoardId = action.boards.some((b) => b.id === state.activeBoardId)
        ? state.activeBoardId
        : action.boards[0]?.id ?? null;
      const focusedScreen = mapName(state.focusedScreen);
      const activeBoard = action.boards.find((b) => b.id === activeBoardId);
      const focusedStillVisible = !focusedScreen || activeBoard?.screens.some((s) => s.name === focusedScreen);
      return {
        ...state,
        boards: action.boards,
        screens: renameScreenState(state.screens, action.renames, action.boards),
        activeBoardId,
        focusedScreen: focusedStillVisible ? focusedScreen : null,
        lastEditedScreen: mapName(state.lastEditedScreen),
      };
    }

    case "view-mode":
      return { ...state, viewMode: action.mode };
  }
}

function maxRight(screens: BoardScreen[]): number {
  let r = 0;
  for (const s of screens) if (s.x > r) r = s.x;
  return r + 1284; // approximate width; refined when we know real sizes
}

export interface EditorApi {
  state: State;
  /** The active board, or null. */
  activeBoard: Board | null;
  /** The screen currently focused for element editing (within the active board). */
  focused: ScreenData | null;
  loadScreen(name: string): Promise<void>;
  /** Clone a .screen on disk and add it to a board. Returns the new name. */
  duplicateScreen(name: string, addToBoardId?: string): Promise<string | null>;
  setSource(name: string, source: string): void;
  setAttrs(name: string, path: ElementPath, patch: Record<string, string | undefined>, opts?: { transient?: boolean }): void;
  setText(name: string, path: ElementPath, text: string, opts?: { transient?: boolean }): void;
  insertChild(name: string, parentPath: ElementPath, tag: string): void;
  duplicate(name: string, path: ElementPath): void;
  deleteAt(name: string, path: ElementPath): void;
  beginTransaction(name: string): void;
  commitTransaction(name: string): void;
  cancelTransaction(name: string): void;
  undo(name: string): void;
  redo(name: string): void;
  select(name: string, path: ElementPath, mode?: "replace" | "toggle" | "add"): void;
  selectMany(name: string, paths: ElementPath[]): void;
  clearSelection(name?: string): void;
  focusScreen(name: string | null): void;
  setActiveBoard(id: string): void;
  createBoard(): void;
  renameBoard(id: string, name: string): void;
  removeBoard(id: string): void;
  addScreenToBoard(boardId: string, screenName: string, position?: { x: number; y: number }): void;
  removeScreenFromBoard(boardId: string, screenName: string): void;
  reorderScreenInBoard(boardId: string, fromIndex: number, toIndex: number): void;
  moveScreenInBoard(boardId: string, screenName: string, x: number, y: number): void;
  setViewMode(mode: ViewMode): void;
}

const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error("useEditor must be used within <EditorProvider>");
  return api;
}

interface ProviderProps {
  projectId: string;
  initialBoards: Board[];
  /** Sources for screens that should be preloaded (every screen in the initial active board). */
  initialScreens: { name: string; source: string }[];
  initialActiveBoardId?: string | null;
  children: ReactNode;
}

export function EditorProvider({
  projectId,
  initialBoards,
  initialScreens,
  initialActiveBoardId,
  children,
}: ProviderProps) {
  const initialState: State = useMemo(() => {
    const screens: Record<string, ScreenData> = {};
    for (const s of initialScreens) screens[s.name] = makeScreen(s.name, s.source);
    // Stubs for any screen named in a board but not yet preloaded.
    for (const b of initialBoards) {
      for (const s of b.screens) {
        if (!screens[s.name]) screens[s.name] = stubScreen(s.name);
      }
    }
    return {
      projectId,
      boards: initialBoards,
      activeBoardId: initialActiveBoardId ?? initialBoards[0]?.id ?? null,
      screens,
      focusedScreen: null,
      lastEditedScreen: null,
      viewMode: "visual",
      boardsRevision: 0,
    };
  }, [projectId, initialBoards, initialScreens, initialActiveBoardId]);

  const [state, dispatch] = useReducer(reducer, initialState);
  const orderWriteInFlight = useRef(0);
  const ignoreScreenEventsUntil = useRef(0);

  // Auto-save individual screen sources.
  const saveTimers = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    for (const s of Object.values(state.screens)) {
      if (!s.dirty || s.saving || !s.loaded) continue;
      const existing = saveTimers.current.get(s.name);
      if (existing) clearTimeout(existing);
      const timer = window.setTimeout(async () => {
        dispatch({ type: "mark-saving", name: s.name, saving: true });
        try {
          await fetch(`/api/projects/${projectId}/screens/${s.name}`, {
            method: "PUT",
            headers: { "content-type": "text/plain" },
            body: s.source,
          });
          dispatch({ type: "mark-saved", name: s.name });
        } catch {
          dispatch({ type: "mark-saving", name: s.name, saving: false });
        }
      }, 400);
      saveTimers.current.set(s.name, timer);
    }
  }, [state.screens, projectId]);

  // Auto-save boards manifest.
  const boardsSaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (state.boardsRevision === 0) return;
    if (boardsSaveTimer.current) clearTimeout(boardsSaveTimer.current);
    boardsSaveTimer.current = window.setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/boards`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ boards: state.boards } satisfies BoardsManifest),
        });
      } catch {
        // best-effort
      }
    }, 300);
    return () => {
      if (boardsSaveTimer.current) clearTimeout(boardsSaveTimer.current);
    };
  }, [state.boards, state.boardsRevision, projectId]);

  // Subscribe to project file changes via SSE. Reload any non-dirty open
  // screen whose source changed externally; warn on dirty conflicts.
  const screensRef = useRef(state.screens);
  screensRef.current = state.screens;
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    try {
      es = new EventSource(`/api/projects/${projectId}/events`);
    } catch {
      return;
    }
    es.onmessage = async (e) => {
      if (cancelled) return;
      let data: { kind: string; event?: string; name?: string };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.kind === "screen" && data.name) {
        const name = data.name;
        if (name.startsWith(".renaming-")) return;
        const isOrderWriteNoise =
          orderWriteInFlight.current > 0 || Date.now() < ignoreScreenEventsUntil.current;
        if (isOrderWriteNoise && (data.event === "add" || data.event === "change" || data.event === "unlink")) {
          return;
        }
        const existing = screensRef.current[name];
        if (data.event === "unlink") {
          dispatch({ type: "remove-screen", name });
          return;
        }
        if (!existing || !existing.loaded) return;
        if (existing.dirty || existing.saving) return; // protect unsaved work
        const res = await fetch(`/api/projects/${projectId}/screens/${name}`);
        if (!res.ok) return;
        const source = await res.text();
        if (cancelled) return;
        if (source === existing.savedSource) return; // our own save echoing back
        dispatch({ type: "reload-screen", name, source });
      }
    };
    es.onerror = () => {
      // Browser will auto-reconnect; nothing to do.
    };
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [projectId]);

  // Global keyboard shortcuts. Target the focused screen first; if nothing's
  // focused, fall back to the screen with the most recent edit so ⌘Z still
  // works after the user clicks the void to deselect everything.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], .cm-editor")) return;
      const name = state.focusedScreen ?? state.lastEditedScreen;
      const screen = name ? state.screens[name] : null;

      // Cmd/Ctrl-Z / Shift / Y — undo / redo
      const mod = e.metaKey || e.ctrlKey;
      if (mod && name) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          dispatch({ type: "undo", name });
          return;
        }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          dispatch({ type: "redo", name });
          return;
        }
      }

      // Escape — drop selection / focus
      if (e.key === "Escape") {
        if (screen && screen.selectedPath.length > 0) {
          dispatch({ type: "select", name: screen.name, path: [] });
        } else if (name) {
          dispatch({ type: "focus-screen", name: null });
        }
        return;
      }

      // Arrow keys — nudge selected element. Shift = 10px.
      if (screen && screen.selectedPath.length > 0 && screen.doc) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        else if (e.key === "ArrowRight") dx = step;
        else if (e.key === "ArrowUp") dy = -step;
        else if (e.key === "ArrowDown") dy = step;
        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          const node = resolvePath(screen.doc, screen.selectedPath);
          if (!node) return;
          const cx = Number.parseFloat(node.attrs.x ?? node.attrs.left ?? "0") || 0;
          const cy = Number.parseFloat(node.attrs.y ?? node.attrs.top ?? "0") || 0;
          dispatch({
            type: "set-attrs",
            name: screen.name,
            path: screen.selectedPath,
            patch: {
              position: "absolute",
              x: String(Math.round(cx + dx)),
              y: String(Math.round(cy + dy)),
              left: undefined,
              top: undefined,
            },
          });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.focusedScreen, state.lastEditedScreen, state.screens]);

  const activeBoard = state.boards.find((b) => b.id === state.activeBoardId) ?? null;
  const focused = state.focusedScreen ? state.screens[state.focusedScreen] ?? null : null;

  const loadScreen = useCallback(
    async (name: string) => {
      // If we already have a loaded copy, no-op.
      const have = (state.screens[name] as ScreenData | undefined)?.loaded;
      if (have) return;
      const res = await fetch(`/api/projects/${projectId}/screens/${name}`);
      if (!res.ok) throw new Error(`Failed to load screen "${name}"`);
      const source = await res.text();
      dispatch({ type: "load-screen", name, source });
    },
    [projectId, state.screens],
  );

  const persistBoardOrder = useCallback(
    async (boardId: string, names: string[]) => {
      orderWriteInFlight.current += 1;
      ignoreScreenEventsUntil.current = Math.max(ignoreScreenEventsUntil.current, Date.now() + 3000);
      try {
        const res = await fetch(`/api/projects/${projectId}/boards/${boardId}/order`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ names }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { boards: Board[]; renames?: Record<string, string> };
        dispatch({ type: "replace-boards", boards: data.boards, renames: data.renames });
      } catch {
        // Local optimistic ordering is still preserved for the current session.
      } finally {
        orderWriteInFlight.current = Math.max(0, orderWriteInFlight.current - 1);
        ignoreScreenEventsUntil.current = Math.max(ignoreScreenEventsUntil.current, Date.now() + 1200);
      }
    },
    [projectId],
  );

  const removeScreenFromBoard = useCallback(
    (boardId: string, screenName: string) => {
      const board = state.boards.find((b) => b.id === boardId);
      const names = board?.screens.map((s) => s.name).filter((name) => name !== screenName) ?? [];
      dispatch({ type: "set-board-screen-order", boardId, names });
      void persistBoardOrder(boardId, names);
    },
    [persistBoardOrder, state.boards],
  );

  const reorderScreenInBoard = useCallback(
    (boardId: string, fromIndex: number, toIndex: number) => {
      const board = state.boards.find((b) => b.id === boardId);
      if (!board) return;
      const names = board.screens.map((s) => s.name);
      if (fromIndex < 0 || fromIndex >= names.length || toIndex < 0 || toIndex >= names.length || fromIndex === toIndex) return;
      const [moved] = names.splice(fromIndex, 1);
      if (!moved) return;
      names.splice(toIndex, 0, moved);
      dispatch({ type: "set-board-screen-order", boardId, names });
      void persistBoardOrder(boardId, names);
    },
    [persistBoardOrder, state.boards],
  );

  const api: EditorApi = {
    state,
    activeBoard,
    focused,
    loadScreen,
    duplicateScreen: useCallback(
      async (name: string, addToBoardId?: string) => {
        const res = await fetch(`/api/projects/${projectId}/screens/${name}/duplicate`, { method: "POST" });
        if (!res.ok) return null;
        const data = (await res.json()) as { name: string; source: string };
        dispatch({ type: "load-screen", name: data.name, source: data.source });
        if (addToBoardId) {
          dispatch({ type: "add-screen-to-board", boardId: addToBoardId, screenName: data.name });
        }
        return data.name;
      },
      [projectId],
    ),
    setSource: useCallback((name, source) => dispatch({ type: "set-source", name, source }), []),
    setAttrs: useCallback((name, path, patch, opts) => dispatch({ type: "set-attrs", name, path, patch, transient: opts?.transient }), []),
    setText: useCallback((name, path, text, opts) => dispatch({ type: "set-text", name, path, text, transient: opts?.transient }), []),
    insertChild: useCallback((name, parentPath, tag) => dispatch({ type: "insert-child", name, parentPath, tag }), []),
    duplicate: useCallback((name, path) => dispatch({ type: "duplicate", name, path }), []),
    deleteAt: useCallback((name, path) => dispatch({ type: "delete-element", name, path }), []),
    beginTransaction: useCallback((name) => dispatch({ type: "begin-transaction", name }), []),
    commitTransaction: useCallback((name) => dispatch({ type: "commit-transaction", name }), []),
    cancelTransaction: useCallback((name) => dispatch({ type: "cancel-transaction", name }), []),
    undo: useCallback((name) => dispatch({ type: "undo", name }), []),
    redo: useCallback((name) => dispatch({ type: "redo", name }), []),
    select: useCallback((name, path, mode) => dispatch({ type: "select", name, path, mode }), []),
    selectMany: useCallback((name, paths) => dispatch({ type: "select-many", name, paths }), []),
    clearSelection: useCallback((name) => dispatch({ type: "clear-selection", name }), []),
    focusScreen: useCallback((name) => dispatch({ type: "focus-screen", name }), []),
    setActiveBoard: useCallback((id) => dispatch({ type: "set-active-board", id }), []),
    createBoard: useCallback(() => dispatch({ type: "create-board" }), []),
    renameBoard: useCallback((id, name) => dispatch({ type: "rename-board", id, name }), []),
    removeBoard: useCallback((id) => dispatch({ type: "remove-board", id }), []),
    addScreenToBoard: useCallback((boardId, screenName, position) => dispatch({ type: "add-screen-to-board", boardId, screenName, x: position?.x, y: position?.y }), []),
    removeScreenFromBoard,
    reorderScreenInBoard,
    moveScreenInBoard: useCallback((boardId, screenName, x, y) => dispatch({ type: "move-screen-in-board", boardId, screenName, x, y }), []),
    setViewMode: useCallback((mode) => dispatch({ type: "view-mode", mode }), []),
  };

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}
