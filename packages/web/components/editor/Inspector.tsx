"use client";

import type { ElementNode } from "@framedeck/core";
import { resolvePath } from "@framedeck/core";
import { useEditor } from "./EditorContext";
import { Field, Row, Section } from "./controls/Field";
import { ColorInput, NumberInput, Segmented, Select, TextInput } from "./controls/Inputs";
import {
  BoxControls,
  FlexControls,
  PositionControls,
  VisualControls,
} from "./controls/FlexControls";
import { DevicePicker } from "./controls/DevicePicker";
import { PresetPicker } from "./controls/PresetPicker";
import { ScreenshotPicker } from "./controls/ScreenshotPicker";
import { IconDuplicate, IconImage, IconTrash, IconX } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";

export function Inspector() {
  const { focused, setAttrs, setText, deleteAt, duplicate } = useEditor();
  if (!focused) {
    return <Empty message="Pick a screen on the canvas to edit it." />;
  }
  if (!focused.doc) {
    return <Empty message="Fix the syntax error in code mode to enable the inspector." />;
  }
  const selected = resolvePath(focused.doc, focused.selectedPath);
  if (!selected) return <Empty message="Pick an element from the tree or canvas." />;

  const onPatch = (patch: Record<string, string | undefined>) => {
    setAttrs(focused.name, focused.selectedPath, patch);
  };
  const onText = (text: string) => setText(focused.name, focused.selectedPath, text);

  return (
    <aside className="flex h-full w-full flex-col bg-ink-900">
      <header className="flex h-10 items-center justify-between border-b border-ink-800/80 bg-ink-925 px-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[12.5px] font-semibold text-ink-100">{selected.tag}</span>
          <span className="font-mono text-[10.5px] text-ink-500">
            {focused.selectedPath.length === 0 ? "root" : focused.selectedPath.join(".")}
          </span>
        </div>
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Inspector</span>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <TagInspector node={selected} onPatch={onPatch} onText={onText} />
        <BoxControls attrs={selected.attrs} onPatch={onPatch} />
        {(selected.tag === "Screen" ||
          selected.tag === "VStack" ||
          selected.tag === "HStack" ||
          selected.tag === "Background" ||
          selected.tag === "Gradient") && (
          <FlexControls attrs={selected.attrs} onPatch={onPatch} />
        )}
        {selected.tag !== "Screen" && <PositionControls attrs={selected.attrs} onPatch={onPatch} />}
        <VisualControls attrs={selected.attrs} onPatch={onPatch} />
      </div>

      {focused.selectedPath.length > 0 && (
        <footer className="flex items-center gap-1.5 border-t border-ink-800/80 bg-ink-925 px-3 py-2">
          <button
            type="button"
            onClick={() => duplicate(focused.name, focused.selectedPath)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-850 px-2.5 py-1 text-[11.5px] text-ink-200 transition hover:border-ink-700 hover:bg-ink-825 hover:text-ink-50"
            title="Duplicate (⌘D)"
          >
            <IconDuplicate size={12} />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => deleteAt(focused.name, focused.selectedPath)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-850 px-2.5 py-1 text-[11.5px] text-ink-200 transition hover:border-red-800/60 hover:bg-red-950/40 hover:text-red-200"
            title="Delete (⌫)"
          >
            <IconTrash size={12} />
            Delete
          </button>
        </footer>
      )}
    </aside>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <aside className="flex h-full w-full items-center justify-center bg-ink-900 px-6 text-center text-[12.5px] text-ink-500">
      {message}
    </aside>
  );
}

interface TagProps {
  node: ElementNode;
  onPatch: (patch: Record<string, string | undefined>) => void;
  onText: (text: string) => void;
}

function TagInspector({ node, onPatch, onText }: TagProps) {
  switch (node.tag) {
    case "Screen":
      return <ScreenSection attrs={node.attrs} onPatch={onPatch} />;
    case "Text":
      return <TextSection node={node} onPatch={onPatch} onText={onText} />;
    case "Device":
      return <DeviceSection attrs={node.attrs} onPatch={onPatch} />;
    case "Background":
      return <BackgroundSection attrs={node.attrs} onPatch={onPatch} />;
    case "Gradient":
      return <GradientSection attrs={node.attrs} onPatch={onPatch} />;
    case "Image":
      return <ImageSection attrs={node.attrs} onPatch={onPatch} />;
    case "Shape":
      return <ShapeSection attrs={node.attrs} onPatch={onPatch} />;
    default:
      return null;
  }
}

// ── Section components ─────────────────────────────────────────────────────

function ScreenSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  return (
    <Section title="Screen">
      <Field label="Canvas size">
        <TextInput value={attrs.size} placeholder="1284x2778" onChange={(v) => onPatch({ size: v })} />
      </Field>
      <Field label="Preset">
        <PresetPicker value={attrs.size} onChange={(v) => onPatch({ size: v })} />
      </Field>
    </Section>
  );
}

function TextSection({ node, onPatch, onText }: TagProps) {
  const text = useMemo(() => textValueForNode(node), [node]);
  return (
    <Section title="Text">
      <Field label="Content">
        <TextContentEditor
          value={text}
          onChange={(value) => onText(encodeTextValue(value))}
        />
      </Field>
      <Row cols={2}>
        <Field label="Size" inline={false}>
          <NumberInput value={node.attrs.size} onChange={(v) => onPatch({ size: v })} placeholder="48" />
        </Field>
        <Field label="Weight" inline={false}>
          <Select
            value={node.attrs.weight}
            onChange={(v) => onPatch({ weight: v })}
            options={[
              { value: "100", label: "100 — Thin" },
              { value: "300", label: "300 — Light" },
              { value: "400", label: "400 — Regular" },
              { value: "500", label: "500 — Medium" },
              { value: "600", label: "600 — Semibold" },
              { value: "700", label: "700 — Bold" },
              { value: "800", label: "800 — Heavy" },
              { value: "900", label: "900 — Black" },
            ]}
          />
        </Field>
      </Row>
      <Field label="Color">
        <ColorInput value={node.attrs.color} onChange={(v) => onPatch({ color: v })} />
      </Field>
      <Field label="Alignment">
        <Segmented
          value={node.attrs.align}
          onChange={(v) => onPatch({ align: v })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </Field>
      <Row cols={2}>
        <Field label="Tracking" inline={false}>
          <NumberInput value={node.attrs.tracking} onChange={(v) => onPatch({ tracking: v })} placeholder="0" />
        </Field>
        <Field label="Line height" inline={false}>
          <NumberInput value={node.attrs.lineHeight} onChange={(v) => onPatch({ lineHeight: v })} placeholder="1.18" />
        </Field>
      </Row>
      <Field label="Max width">
        <NumberInput value={node.attrs.maxWidth} onChange={(v) => onPatch({ maxWidth: v })} placeholder="auto" />
      </Field>
      <Field label="Font family">
        <TextInput value={node.attrs.font} onChange={(v) => onPatch({ font: v })} placeholder="SF Pro Display" />
      </Field>
    </Section>
  );
}

function TextContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const update = (next: string) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <textarea
      ref={ref}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        setDraft(value);
      }}
      onChange={(e) => update(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          update(insertAtSelection(e.currentTarget, "\n"));
        }
      }}
      rows={4}
      spellCheck={false}
      className="w-full resize-y rounded border border-ink-800 bg-ink-900 px-2 py-1.5 font-sans text-[13px] leading-[1.35] text-ink-100 outline-none focus:border-ink-500"
    />
  );
}

function textValueForNode(node: ElementNode): string {
  return node.children
    .filter((c): c is { type: "text"; value: string } => c.type === "text")
    .map((c) => c.value)
    .join("")
    .replace(/\\n/g, "\n");
}

function encodeTextValue(value: string): string {
  return value.replace(/\r?\n/g, "\\n");
}

function insertAtSelection(el: HTMLTextAreaElement, text: string): string {
  el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
  return el.value;
}

function DeviceSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Section title="Device">
      <Field label="Model">
        <DevicePicker value={attrs.model} onChange={(v) => onPatch({ model: v })} />
      </Field>
      <Field label="Screenshot" hint="Choose a file or upload from disk.">
        <ScreenshotField
          value={attrs.screenshot}
          onPick={() => setPickerOpen(true)}
          onClear={() => onPatch({ screenshot: undefined })}
        />
      </Field>
      <Field label="Or fill with">
        <ColorInput value={attrs.screenColor} onChange={(v) => onPatch({ screenColor: v })} />
      </Field>
      <Row cols={2}>
        <Field label="Width" inline={false}>
          <NumberInput value={attrs.width} onChange={(v) => onPatch({ width: v })} placeholder="900" />
        </Field>
        <Field label="Scale" inline={false}>
          <NumberInput value={attrs.scale} onChange={(v) => onPatch({ scale: v })} placeholder="1" />
        </Field>
      </Row>
      <Field label="Side buttons">
        <Segmented
          value={attrs.buttons}
          onChange={(v) => onPatch({ buttons: v })}
          options={[
            { value: "true", label: "Show" },
            { value: "false", label: "Hide" },
          ]}
        />
      </Field>
      <ScreenshotPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(path) => {
          onPatch({ screenshot: path });
          setPickerOpen(false);
        }}
      />
    </Section>
  );
}

function ScreenshotField({
  value,
  onPick,
  onClear,
}: {
  value?: string;
  onPick: () => void;
  onClear: () => void;
}) {
  const hasValue = !!value && value.trim().length > 0;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onPick}
        className="group flex flex-1 items-center gap-2 rounded-md border border-ink-800 bg-ink-850 px-2 py-1.5 text-left transition hover:border-ink-700 hover:bg-ink-825"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-400">
          <IconImage />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-100">
          {hasValue ? value : <span className="text-ink-500">— choose a file —</span>}
        </span>
        <span className="text-[11px] text-ink-500 group-hover:text-ink-300">›</span>
      </button>
      {hasValue && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear screenshot"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-800 bg-ink-850 text-ink-400 transition hover:border-ink-700 hover:bg-ink-825 hover:text-ink-100"
          title="Clear"
        >
          <IconX size={12} />
        </button>
      )}
    </div>
  );
}

function BackgroundSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  return (
    <Section title="Background">
      <Field label="Color">
        <ColorInput value={attrs.color} onChange={(v) => onPatch({ color: v })} />
      </Field>
      <Field label="Image (path)">
        <TextInput value={attrs.image} onChange={(v) => onPatch({ image: v })} placeholder="./bg.png" />
      </Field>
      <Field label="Corner radius">
        <NumberInput value={attrs.radius} onChange={(v) => onPatch({ radius: v })} placeholder="0" />
      </Field>
    </Section>
  );
}

function GradientSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  return (
    <Section title="Gradient">
      <Field label="CSS expression" hint='e.g. linear-gradient(180deg, #000 0%, #1a1a1a 100%)'>
        <TextInput
          value={attrs.css}
          onChange={(v) => onPatch({ css: v })}
          placeholder="linear-gradient(180deg, #000 0%, #1a1a1a 100%)"
        />
      </Field>
      <Row cols={2}>
        <Field label="From" inline={false}>
          <ColorInput value={attrs.from} onChange={(v) => onPatch({ from: v })} />
        </Field>
        <Field label="To" inline={false}>
          <ColorInput value={attrs.to} onChange={(v) => onPatch({ to: v })} />
        </Field>
      </Row>
      <Field label="Direction">
        <TextInput value={attrs.direction} onChange={(v) => onPatch({ direction: v })} placeholder="180deg" />
      </Field>
    </Section>
  );
}

function ImageSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  return (
    <Section title="Image">
      <Field label="Source">
        <TextInput value={attrs.src} onChange={(v) => onPatch({ src: v })} placeholder="./image.png" />
      </Field>
      <Field label="Fit">
        <Segmented
          value={attrs.fit}
          onChange={(v) => onPatch({ fit: v })}
          options={[
            { value: "cover", label: "Cover" },
            { value: "contain", label: "Contain" },
            { value: "fill", label: "Fill" },
            { value: "none", label: "None" },
          ]}
        />
      </Field>
    </Section>
  );
}

function ShapeSection({ attrs, onPatch }: { attrs: Record<string, string>; onPatch: TagProps["onPatch"] }) {
  return (
    <Section title="Shape">
      <Field label="Kind">
        <Segmented
          value={attrs.kind}
          onChange={(v) => onPatch({ kind: v })}
          options={[
            { value: "rect", label: "Rect" },
            { value: "circle", label: "Circle" },
          ]}
        />
      </Field>
      <Row cols={2}>
        <Field label="Fill" inline={false}>
          <ColorInput value={attrs.fill} onChange={(v) => onPatch({ fill: v })} />
        </Field>
        <Field label="Stroke" inline={false}>
          <ColorInput value={attrs.stroke} onChange={(v) => onPatch({ stroke: v })} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Radius" inline={false}>
          <NumberInput value={attrs.radius} onChange={(v) => onPatch({ radius: v })} />
        </Field>
        <Field label="Blur" inline={false}>
          <NumberInput value={attrs.blur} onChange={(v) => onPatch({ blur: v })} />
        </Field>
      </Row>
    </Section>
  );
}
