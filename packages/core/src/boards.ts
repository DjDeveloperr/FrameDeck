// Boards — user-defined groupings of screens inside a project.
//
// Each board lists the screens it contains plus a position for each. The
// canvas in the editor renders every screen in the active board at its (x, y).
// Boards are loose: a single screen file may appear in multiple boards
// (different layouts of the same artwork), and a board may be empty.
//
// Persistence lives on disk in `<project>/boards.json` so collaborators see
// the same layouts. If the file is missing, the editor synthesizes a single
// `Untitled 1` board listing every `.screen` file at a horizontal stride.

export interface BoardScreen {
  /** Stem of the .screen file (without extension). */
  name: string;
  x: number;
  y: number;
}

export interface Board {
  /** Stable id used in routes / localStorage / action dispatching. */
  id: string;
  /** Display name (e.g. "iPhone Screenshots"). */
  name: string;
  screens: BoardScreen[];
}

export interface BoardsManifest {
  boards: Board[];
}

/** Reasonable default screen width when arranging untyped boards. */
const DEFAULT_SCREEN_WIDTH = 1284;
const DEFAULT_SCREEN_HEIGHT = 2778;
const BOARD_GAP = 160;

export function synthesizeBoardsForScreens(screenNames: string[]): BoardsManifest {
  return {
    boards: [
      {
        id: "default",
        name: "Untitled 1",
        screens: screenNames.map((name, i) => ({
          name,
          x: i * (DEFAULT_SCREEN_WIDTH + BOARD_GAP),
          y: 0,
        })),
      },
    ],
  };
}

/** Generate the next "Untitled N" not in `existing`. */
export function nextUntitledName(existing: Board[]): string {
  const taken = new Set(existing.map((b) => b.name));
  let n = 1;
  while (taken.has(`Untitled ${n}`)) n++;
  return `Untitled ${n}`;
}

/** New random id for a fresh board. */
export function newBoardId(): string {
  return `b-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default position for the n'th screen on a board, given previously-added ones. */
export function defaultScreenPosition(existing: BoardScreen[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const rightmost = existing.reduce((best, s) => (s.x > best.x ? s : best), existing[0]!);
  return { x: rightmost.x + DEFAULT_SCREEN_WIDTH + BOARD_GAP, y: rightmost.y };
}

/** Bounding box of all screens on a board, useful for canvas sizing. */
export function boardBounds(
  board: Board,
  screenSize: (name: string) => { w: number; h: number } | null,
): { width: number; height: number } {
  if (board.screens.length === 0) return { width: DEFAULT_SCREEN_WIDTH, height: DEFAULT_SCREEN_HEIGHT };
  let maxX = 0;
  let maxY = 0;
  for (const s of board.screens) {
    const size = screenSize(s.name) ?? { w: DEFAULT_SCREEN_WIDTH, h: DEFAULT_SCREEN_HEIGHT };
    if (s.x + size.w > maxX) maxX = s.x + size.w;
    if (s.y + size.h > maxY) maxY = s.y + size.h;
  }
  return { width: maxX, height: maxY };
}
