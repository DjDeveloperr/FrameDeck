"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEditor } from "./EditorContext";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-ink-925)",
    fontSize: "13px",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    padding: "16px",
    caretColor: "#ffffff",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-ink-925)",
    color: "var(--color-ink-600)",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "var(--color-ink-875)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-ink-700) !important",
  },
});

export function CodeView() {
  const { focused, setSource } = useEditor();
  const extensions = useMemo(() => [xml(), editorTheme], []);

  if (!focused)
    return (
      <div className="flex h-full items-center justify-center bg-ink-925 px-6 text-center text-[12.5px] text-ink-500">
        Pick a screen on the canvas to view its code.
      </div>
    );

  return (
    <div className="flex h-full flex-col bg-ink-925">
      <div className="flex h-10 items-center justify-between border-b border-ink-800/80 bg-ink-925 px-4">
        <span className="font-mono text-[12px] text-ink-300">{focused.name}.screen</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
          {focused.saving ? "Saving…" : focused.dirty ? "Unsaved" : "Saved"}
          {focused.parseError && <span className="ml-2 text-red-400">syntax error</span>}
        </span>
      </div>
      <div className="scrollbar-thin flex-1 overflow-auto">
        <CodeMirror
          value={focused.source}
          onChange={(v) => setSource(focused.name, v)}
          extensions={extensions}
          theme={oneDark}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
          }}
          height="100%"
        />
      </div>
      {focused.parseError && (
        <div className="border-t border-red-900/60 bg-red-950/40 px-4 py-2 font-mono text-[11.5px] text-red-300">
          {focused.parseError}
        </div>
      )}
    </div>
  );
}
