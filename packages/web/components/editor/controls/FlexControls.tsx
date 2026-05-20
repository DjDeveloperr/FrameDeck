"use client";

// Universal box + flex controls — usable on any element. Mirrors what
// applyStyle understands in the renderer so what you set here is exactly what
// gets rendered.

import type { ReactNode } from "react";
import { Field, Row, Section } from "./Field";
import { NumberInput, Segmented, Select } from "./Inputs";

interface Patcher {
  attrs: Record<string, string>;
  onPatch(patch: Record<string, string | undefined>): void;
}

export function BoxControls({ attrs, onPatch }: Patcher) {
  return (
    <Section title="Layout">
      <Row>
        <Field label="W" inline={false}>
          <NumberInput value={attrs.width} onChange={(v) => onPatch({ width: v })} placeholder="auto" />
        </Field>
        <Field label="H" inline={false}>
          <NumberInput value={attrs.height} onChange={(v) => onPatch({ height: v })} placeholder="auto" />
        </Field>
      </Row>
      <Row>
        <Field label="Padding" inline={false}>
          <NumberInput value={attrs.padding} onChange={(v) => onPatch({ padding: v })} placeholder="0" />
        </Field>
        <Field label="Gap" inline={false}>
          <NumberInput value={attrs.gap} onChange={(v) => onPatch({ gap: v })} placeholder="0" />
        </Field>
      </Row>
      <details>
        <summary className="cursor-pointer select-none pt-1 text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-300">
          More spacing
        </summary>
        <div className="mt-1.5 space-y-1.5">
          <Row cols={4}>
            <Field label="PT" inline={false}>
              <NumberInput value={attrs.paddingTop} onChange={(v) => onPatch({ paddingTop: v })} />
            </Field>
            <Field label="PR" inline={false}>
              <NumberInput value={attrs.paddingRight} onChange={(v) => onPatch({ paddingRight: v })} />
            </Field>
            <Field label="PB" inline={false}>
              <NumberInput value={attrs.paddingBottom} onChange={(v) => onPatch({ paddingBottom: v })} />
            </Field>
            <Field label="PL" inline={false}>
              <NumberInput value={attrs.paddingLeft} onChange={(v) => onPatch({ paddingLeft: v })} />
            </Field>
          </Row>
          <Row cols={4}>
            <Field label="MT" inline={false}>
              <NumberInput value={attrs.marginTop} onChange={(v) => onPatch({ marginTop: v })} />
            </Field>
            <Field label="MR" inline={false}>
              <NumberInput value={attrs.marginRight} onChange={(v) => onPatch({ marginRight: v })} />
            </Field>
            <Field label="MB" inline={false}>
              <NumberInput value={attrs.marginBottom} onChange={(v) => onPatch({ marginBottom: v })} />
            </Field>
            <Field label="ML" inline={false}>
              <NumberInput value={attrs.marginLeft} onChange={(v) => onPatch({ marginLeft: v })} />
            </Field>
          </Row>
        </div>
      </details>
    </Section>
  );
}

export function FlexControls({ attrs, onPatch }: Patcher) {
  return (
    <Section title="Flex">
      <Field label="Direction">
        <Segmented
          value={attrs.direction ?? attrs.flexDirection}
          onChange={(v) => onPatch({ direction: v, flexDirection: undefined })}
          options={[
            { value: "row", label: "Row" },
            { value: "column", label: "Col" },
            { value: "row-reverse", label: "↤" },
            { value: "column-reverse", label: "↥" },
          ]}
        />
      </Field>
      <Field label="Justify">
        <Select
          value={attrs.justify ?? attrs.justifyContent}
          onChange={(v) => onPatch({ justify: v, justifyContent: undefined })}
          options={[
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "between", label: "Space between" },
            { value: "around", label: "Space around" },
            { value: "evenly", label: "Space evenly" },
          ]}
        />
      </Field>
      <Field label="Align items">
        <Select
          value={attrs.alignItems ?? attrs.align}
          onChange={(v) => onPatch({ alignItems: v, align: undefined })}
          options={[
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "stretch", label: "Stretch" },
            { value: "baseline", label: "Baseline" },
          ]}
        />
      </Field>
      <Field label="Align self">
        <Select
          value={attrs.alignSelf}
          onChange={(v) => onPatch({ alignSelf: v })}
          options={[
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "stretch", label: "Stretch" },
          ]}
        />
      </Field>
    </Section>
  );
}

export function PositionControls({ attrs, onPatch }: Patcher) {
  const isAbs = attrs.position === "absolute";
  return (
    <Section title="Position">
      <Field label="Type">
        <Segmented
          value={attrs.position}
          onChange={(v) => onPatch({ position: v })}
          options={[
            { value: "relative", label: "Flow" },
            { value: "absolute", label: "Absolute" },
          ]}
        />
      </Field>
      {isAbs && (
        <Row cols={2}>
          <Field label="X / Left" inline={false}>
            <NumberInput value={attrs.left ?? attrs.x} onChange={(v) => onPatch({ x: v, left: undefined })} />
          </Field>
          <Field label="Y / Top" inline={false}>
            <NumberInput value={attrs.top ?? attrs.y} onChange={(v) => onPatch({ y: v, top: undefined })} />
          </Field>
          <Field label="Right" inline={false}>
            <NumberInput value={attrs.right} onChange={(v) => onPatch({ right: v })} />
          </Field>
          <Field label="Bottom" inline={false}>
            <NumberInput value={attrs.bottom} onChange={(v) => onPatch({ bottom: v })} />
          </Field>
        </Row>
      )}
    </Section>
  );
}

export function VisualControls({ attrs, onPatch, children }: Patcher & { children?: ReactNode }) {
  return (
    <Section title="Appearance">
      {children}
      <Field label="Opacity" inline={false}>
        <NumberInput value={attrs.opacity} onChange={(v) => onPatch({ opacity: v })} placeholder="1" />
      </Field>
    </Section>
  );
}
