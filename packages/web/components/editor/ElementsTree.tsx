"use client";

// Two-level tree: top shows the screens in the active board (click to focus
// one); inside each focused screen, the AST is browsable as before.

import { useEffect, useState } from "react";
import type { ElementNode } from "@screendeck/core";
import { pathEquals, type ElementPath } from "@screendeck/core";
import { useEditor } from "./EditorContext";
import { InsertMenu } from "./controls/InsertMenu";
import { Popover } from "./controls/Popover";
import {
  IconBackground,
  IconChevronRight,
  IconColumns,
  IconDevice,
  IconDuplicate,
  IconGradient,
  IconImage,
  IconPlus,
  IconRows,
  IconSquare,
  IconText,
  IconTrash,
  IconX,
} from "./icons";

const TAG_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Screen: IconBackground,
  VStack: IconRows,
  HStack: IconColumns,
  Background: IconBackground,
  Gradient: IconGradient,
  Text: IconText,
  Image: IconImage,
  Device: IconDevice,
  Shape: IconSquare,
};

export function ElementsTree() {
  const {
    state,
    activeBoard,
    focused,
    focusScreen,
    select,
    insertChild,
    duplicate,
    deleteAt,
    addScreenToBoard,
    removeScreenFromBoard,
    reorderScreenInBoard,
    duplicateScreen,
  } = useEditor();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Keyboard: Delete / Cmd+D on the focused screen's selected element.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!focused || focused.selectedPath.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], .cm-editor")) return;
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteAt(focused.name, focused.selectedPath);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicate(focused.name, focused.selectedPath);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, duplicate, deleteAt]);

  if (!activeBoard) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-ink-900 px-4 text-center text-[12px] text-ink-500">
        No board open
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-ink-900">
      <div className="flex h-10 items-center justify-between border-b border-ink-800/80 bg-ink-925 px-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          {activeBoard.name}
        </h2>
        <AddScreenButton
          boardId={activeBoard.id}
          alreadyOnBoard={activeBoard.screens.map((s) => s.name)}
          onAdd={(name) => addScreenToBoard(activeBoard.id, name)}
        />
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto py-1">
        {activeBoard.screens.length === 0 && (
          <div className="px-4 py-6 text-[12px] text-ink-500">
            This board has no screens yet. Use <span className="font-mono text-ink-400">+</span> above to add one.
          </div>
        )}
        {activeBoard.screens.map((entry, index) => {
          const screen = state.screens[entry.name];
          const isFocused = focused?.name === entry.name;
          const isDropTarget = dragIndex != null && dropIndex === index && dragIndex !== index;
          return (
            <div
              key={entry.name}
              className={`border-b border-ink-800/40 last:border-b-0 ${isDropTarget ? "bg-ink-875/70" : ""}`}
              onDragOver={(e) => {
                if (dragIndex == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex != null) reorderScreenInBoard(activeBoard.id, dragIndex, index);
                setDragIndex(null);
                setDropIndex(null);
              }}
            >
              <div
                onClick={() => focusScreen(entry.name)}
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  setDropIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", entry.name);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") focusScreen(entry.name);
                }}
                className={`group flex h-8 cursor-pointer items-center gap-1.5 px-2 text-[12.5px] transition ${
                  isFocused ? "bg-ink-825 text-ink-50" : "text-ink-200 hover:bg-ink-875"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-500">
                  <IconBackground size={11} />
                </span>
                <span className="truncate font-mono text-[12px]">{entry.name}</span>
                {screen?.dirty && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-ink-300" />}
                <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Duplicate screen"
                    onClick={(e) => {
                      e.stopPropagation();
                      void duplicateScreen(entry.name, activeBoard.id);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-ink-825 hover:text-ink-100"
                    title="Duplicate screen file"
                  >
                    <IconDuplicate size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from board"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScreenFromBoard(activeBoard.id, entry.name);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-red-950 hover:text-red-200"
                    title="Remove from board (keeps file)"
                  >
                    <IconX size={10} />
                  </button>
                </div>
              </div>
              {isFocused && screen?.doc && (
                <ElementSubtree
                  node={screen.doc.root}
                  path={[]}
                  selectedPath={screen.selectedPath}
                  onSelect={(p) => select(entry.name, p)}
                  onAdd={(p, tag) => insertChild(entry.name, p, tag)}
                  onDuplicate={(p) => duplicate(entry.name, p)}
                  onDelete={(p) => deleteAt(entry.name, p)}
                  depth={1}
                />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

interface AddScreenProps {
  boardId: string;
  alreadyOnBoard: string[];
  onAdd: (name: string) => void;
}

function AddScreenButton({ boardId, alreadyOnBoard, onAdd }: AddScreenProps) {
  const { state } = useEditor();
  const allNames = Object.keys(state.screens).sort();
  const candidates = allNames.filter((n) => !alreadyOnBoard.includes(n));
  void boardId;
  return (
    <Popover
      width={240}
      align="end"
      content={(close) => (
        <div className="p-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Add screen to this board
          </div>
          {candidates.length === 0 ? (
            <div className="px-2 py-2 text-[11.5px] text-ink-500">
              Every screen is already on this board.
            </div>
          ) : (
            candidates.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onAdd(name);
                  close();
                }}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-[13px] text-ink-200 transition hover:bg-ink-850"
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={(e) => open(e.currentTarget)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-850 hover:text-ink-100"
          aria-label="Add screen to board"
          title="Add screen to board"
        >
          <IconPlus size={13} />
        </button>
      )}
    </Popover>
  );
}

interface SubtreeProps {
  node: ElementNode;
  path: ElementPath;
  selectedPath: ElementPath;
  onSelect: (p: ElementPath) => void;
  onAdd: (parentPath: ElementPath, tag: string) => void;
  onDuplicate: (p: ElementPath) => void;
  onDelete: (p: ElementPath) => void;
  depth: number;
}

function ElementSubtree({ node, path, selectedPath, onSelect, onAdd, onDuplicate, onDelete, depth }: SubtreeProps) {
  const elementChildren = node.children.filter((c): c is ElementNode => c.type === "element");
  const hasChildren = elementChildren.length > 0;
  const [expanded, setExpanded] = useState(depth < 4);
  const isSelected = pathEquals(path, selectedPath);
  const isRoot = path.length === 0;
  const Icon = TAG_ICON[node.tag] ?? IconSquare;

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(path);
          }
        }}
        className={`group relative flex h-7 cursor-pointer items-center gap-1.5 pr-2 text-[12.5px] transition ${
          isSelected ? "bg-ink-825 text-ink-50" : "text-ink-200 hover:bg-ink-875"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          type="button"
          aria-label={hasChildren ? (expanded ? "Collapse" : "Expand") : ""}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-ink-500 ${hasChildren ? "" : "opacity-0"}`}
        >
          <IconChevronRight size={12} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400">
          <Icon size={12} />
        </span>
        <span className="font-mono text-[12px] text-ink-100">{node.tag}</span>
        <span className="ml-1 flex-1 truncate text-[11.5px] text-ink-500">{previewFor(node)}</span>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <InsertMenu onPick={(tag) => onAdd(path, tag)}>
            {(open) => (
              <button
                type="button"
                aria-label="Add child"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                  open();
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
              >
                <IconPlus size={11} />
              </button>
            )}
          </InsertMenu>
          {!isRoot && (
            <>
              <button
                type="button"
                aria-label="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(path);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
              >
                <IconDuplicate size={11} />
              </button>
              <button
                type="button"
                aria-label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(path);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-ink-400 transition hover:bg-red-950 hover:text-red-200"
              >
                <IconTrash size={11} />
              </button>
            </>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {elementChildren.map((child, i) => (
            <ElementSubtree
              key={`${child.tag}-${i}`}
              node={child}
              path={[...path, i]}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onAdd={onAdd}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function previewFor(node: ElementNode): string {
  if (node.tag === "Text") {
    const text = node.children
      .filter((c): c is { type: "text"; value: string } => c.type === "text")
      .map((c) => c.value)
      .join(" ")
      .trim();
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  if (node.tag === "Device" && node.attrs.model) return node.attrs.model;
  if (node.tag === "Image" && node.attrs.src) return node.attrs.src.split("/").pop() ?? "";
  if (node.tag === "Shape" && node.attrs.kind) return node.attrs.kind;
  return "";
}
