"use client";

import { APP_STORE_PRESETS } from "framedeck-core";
import { Select } from "./Inputs";

interface Props {
  value?: string;
  onChange: (size: string | undefined) => void;
}

export function PresetPicker({ value, onChange }: Props) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={APP_STORE_PRESETS.map((p) => ({
        value: p.size,
        label: `${p.label} · ${p.size}`,
      }))}
    />
  );
}
