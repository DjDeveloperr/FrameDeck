"use client";

// Top strip: project chip, then a row of board pills, then undo/redo and the
// view-mode toggle. A board is a UI grouping of screens that all appear
// side-by-side on the canvas.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "./EditorContext";
import { Popover } from "./controls/Popover";
import { ThemeToggle } from "./ThemeToggle";
import { IconChevronLeft, IconCode, IconEye, IconPlus, IconRedo, IconUndo, IconX } from "./icons";

interface Props {
  projectName: string;
}

export function Tabs({ projectName }: Props) {
  const {
    state,
    activeBoard,
    focused,
    undo,
    redo,
    setActiveBoard,
    createBoard,
    renameBoard,
    removeBoard,
    setViewMode,
  } = useEditor();
  const canUndo = !!focused && focused.past.length > 0;
  const canRedo = !!focused && focused.future.length > 0;
  const codeMode = state.viewMode === "code";

  return (
    <div className="flex h-11 shrink-0 select-none items-center gap-2 border-b border-ink-800/80 bg-ink-950 px-3">
      <Link
        href="/"
        className="group flex h-7 items-center gap-1.5 rounded-full bg-ink-875 px-3 text-[12px] leading-none text-ink-200 transition hover:bg-ink-825 hover:text-ink-50"
        title="Back to projects"
      >
        <IconChevronLeft className="text-ink-500 transition group-hover:text-ink-200" size={13} />
        <span className="truncate max-w-[160px] font-medium tracking-tight">{projectName}</span>
      </Link>

      <div className="scrollbar-thin flex flex-1 items-center gap-1 overflow-x-auto">
        {state.boards.map((board) => (
          <BoardChip
            key={board.id}
            board={board}
            isActive={board.id === activeBoard?.id}
            canClose={state.boards.length > 1}
            onActivate={() => setActiveBoard(board.id)}
            onRename={(name) => renameBoard(board.id, name)}
            onClose={() => removeBoard(board.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => createBoard()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-875 hover:text-ink-100"
          title="New board"
          aria-label="New board"
        >
          <IconPlus />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => focused && undo(focused.name)}
          disabled={!canUndo}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-875 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo (⌘Z)"
          aria-label="Undo"
        >
          <IconUndo />
        </button>
        <button
          type="button"
          onClick={() => focused && redo(focused.name)}
          disabled={!canRedo}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition hover:bg-ink-875 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo (⌘⇧Z)"
          aria-label="Redo"
        >
          <IconRedo />
        </button>
        <button
          type="button"
          onClick={() => setViewMode(codeMode ? "visual" : "code")}
          className="ml-1 flex h-7 items-center gap-1.5 rounded-full bg-ink-875 px-3 text-[11.5px] font-medium leading-none text-ink-200 transition hover:bg-ink-825 hover:text-ink-50"
          title="Toggle code mode"
        >
          {codeMode ? <IconEye /> : <IconCode />}
          <span>{codeMode ? "Visual" : "Code"}</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}

interface BoardChipProps {
  board: import("@screendeck/core").Board;
  isActive: boolean;
  canClose: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onClose: () => void;
}

function BoardChip({ board, isActive, canClose, onActivate, onRename, onClose }: BoardChipProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
      });
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== board.name) onRename(next);
    else setDraft(board.name);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onActivate()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(board.name);
        setEditing(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !editing) onActivate();
      }}
      className={`group relative flex h-7 max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] leading-none transition ${
        isActive
          ? "bg-ink-100 text-ink-950"
          : "bg-ink-875 text-ink-300 hover:bg-ink-825 hover:text-ink-100"
      }`}
    >
      {editing ? (
        <input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(board.name);
              setEditing(false);
            }
          }}
          className="w-[140px] bg-transparent text-[12px] font-medium tracking-tight outline-none"
          style={{ color: isActive ? "var(--color-ink-950)" : "var(--color-ink-100)" }}
        />
      ) : (
        <span className="truncate font-medium tracking-tight">{board.name}</span>
      )}
      {canClose && !editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete board "${board.name}"? Screen files are not deleted.`)) onClose();
          }}
          aria-label={`Close ${board.name}`}
          className={`-mr-1 ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 ${
            isActive ? "text-ink-700 hover:bg-ink-200" : "text-ink-500 hover:bg-ink-800 hover:text-ink-100"
          }`}
        >
          <IconX size={10} />
        </button>
      )}
    </div>
  );
}

// Popover unused for now — keeping the import so we can wire screen-add menus later.
void Popover;
