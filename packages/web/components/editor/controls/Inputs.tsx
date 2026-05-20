"use client";

// Small set of styled inputs used across every inspector. Each control accepts
// `value` as a string (matching the attribute store) and pushes string output
// to keep the data path uniform — no parsing in components, only in the
// renderer.

import { useEffect, useRef, useState } from "react";

const INPUT_CLASS =
  "w-full rounded-md border border-ink-800 bg-ink-850 px-2 py-1 font-mono text-[12.5px] text-ink-100 outline-none transition focus:border-ink-500 focus:bg-ink-825 placeholder:text-ink-600";

interface BaseProps {
  value?: string;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
}

export function TextInput({ value, onChange, placeholder, monospace = true }: BaseProps & { monospace?: boolean }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);
  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local === "" ? undefined : local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      spellCheck={false}
      autoComplete="off"
      className={`${INPUT_CLASS} ${monospace ? "font-mono" : "font-sans"}`}
    />
  );
}

export function NumberInput({ value, onChange, placeholder, unit }: BaseProps & { unit?: string }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local === "" ? undefined : local)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        spellCheck={false}
        autoComplete="off"
        className={INPUT_CLASS}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] uppercase tracking-wider text-ink-500">
          {unit}
        </span>
      )}
    </div>
  );
}

interface ColorInputProps extends BaseProps {}

export function ColorInput({ value, onChange, placeholder }: ColorInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const swatchOk = /^#([0-9a-f]{3,4}|[0-9a-f]{6,8})$/i.test(value ?? "");
  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        aria-label="Pick color"
        onClick={() => ref.current?.click()}
        className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded border border-ink-800 bg-[conic-gradient(at_top_left,_var(--color-ink-700)_25%,_var(--color-ink-900)_25%_50%,_var(--color-ink-700)_50%_75%,_var(--color-ink-900)_75%)] bg-[length:8px_8px]"
      >
        <span
          className="absolute inset-0 block"
          style={{ background: swatchOk ? value : undefined }}
        />
      </button>
      <input
        ref={ref}
        type="color"
        value={swatchOk ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder ?? "#000000"}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className={INPUT_CLASS}
      />
    </div>
  );
}

interface SelectProps extends BaseProps {
  options: { value: string; label: string }[];
  /** Render an "auto" option that clears the attribute. */
  allowAuto?: boolean;
}

export function Select({ value, onChange, options, allowAuto = true }: SelectProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className={`${INPUT_CLASS} cursor-pointer pr-6`}
    >
      {allowAuto && <option value="">— auto —</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface SegmentedProps extends BaseProps {
  options: { value: string; label: string; title?: string }[];
}

export function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-md border border-ink-800 bg-ink-850 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            onClick={() => onChange(active ? undefined : opt.value)}
            className={`flex-1 rounded-[5px] px-1.5 py-1 text-[11.5px] transition ${
              active
                ? "bg-ink-700 text-ink-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                : "text-ink-400 hover:text-ink-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
