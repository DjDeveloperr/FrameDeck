// Map .screen attributes to Yoga style. The mapping is a thin alias over
// flexbox so anyone familiar with React Native or CSS flex can predict the
// layout outcome.

import Yoga, {
  type Node as YogaNode,
  type Align,
  type Edge,
  type FlexDirection,
  type Justify,
  type PositionType,
} from "yoga-layout";
import type { Attrs } from "framedeck-core";

const PCT = /^(-?\d+(?:\.\d+)?)%$/;

function setSize(node: YogaNode, axis: "width" | "height", value: string | undefined) {
  if (value == null || value === "") return;
  if (value === "auto") {
    if (axis === "width") node.setWidthAuto();
    else node.setHeightAuto();
    return;
  }
  const pct = value.match(PCT);
  if (pct) {
    if (axis === "width") node.setWidthPercent(Number.parseFloat(pct[1]!));
    else node.setHeightPercent(Number.parseFloat(pct[1]!));
    return;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return;
  if (axis === "width") node.setWidth(n);
  else node.setHeight(n);
}

function parseFlexDirection(v: string | undefined): FlexDirection | null {
  switch (v) {
    case "row": return Yoga.FLEX_DIRECTION_ROW;
    case "row-reverse": return Yoga.FLEX_DIRECTION_ROW_REVERSE;
    case "column": case "col": return Yoga.FLEX_DIRECTION_COLUMN;
    case "column-reverse": case "col-reverse": return Yoga.FLEX_DIRECTION_COLUMN_REVERSE;
    default: return null;
  }
}

function parseJustify(v: string | undefined): Justify | null {
  switch (v) {
    case "start": case "flex-start": return Yoga.JUSTIFY_FLEX_START;
    case "end": case "flex-end": return Yoga.JUSTIFY_FLEX_END;
    case "center": return Yoga.JUSTIFY_CENTER;
    case "between": case "space-between": return Yoga.JUSTIFY_SPACE_BETWEEN;
    case "around": case "space-around": return Yoga.JUSTIFY_SPACE_AROUND;
    case "evenly": case "space-evenly": return Yoga.JUSTIFY_SPACE_EVENLY;
    default: return null;
  }
}

function parseAlign(v: string | undefined): Align | null {
  switch (v) {
    case "start": case "flex-start": return Yoga.ALIGN_FLEX_START;
    case "end": case "flex-end": return Yoga.ALIGN_FLEX_END;
    case "center": return Yoga.ALIGN_CENTER;
    case "stretch": return Yoga.ALIGN_STRETCH;
    case "baseline": return Yoga.ALIGN_BASELINE;
    default: return null;
  }
}

function parsePosition(v: string | undefined): PositionType | null {
  switch (v) {
    case "absolute": return Yoga.POSITION_TYPE_ABSOLUTE;
    case "relative": return Yoga.POSITION_TYPE_RELATIVE;
    case "static": return Yoga.POSITION_TYPE_STATIC;
    default: return null;
  }
}

export function applyStyle(node: YogaNode, tag: string, attrs: Attrs): void {
  if (tag === "VStack") node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  else if (tag === "HStack") node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);

  setSize(node, "width", attrs.width);
  setSize(node, "height", attrs.height);

  const dir = parseFlexDirection(attrs.direction ?? attrs.flexDirection);
  if (dir != null) node.setFlexDirection(dir);
  const justify = parseJustify(attrs.justify ?? attrs.justifyContent);
  if (justify != null) node.setJustifyContent(justify);
  const align = parseAlign(attrs.alignItems ?? (tag === "VStack" || tag === "HStack" ? attrs.align : undefined));
  if (align != null) node.setAlignItems(align);
  const alignSelf = parseAlign(attrs.alignSelf);
  if (alignSelf != null) node.setAlignSelf(alignSelf);
  if (attrs.wrap === "wrap") node.setFlexWrap(Yoga.WRAP_WRAP);
  if (attrs.wrap === "nowrap") node.setFlexWrap(Yoga.WRAP_NO_WRAP);

  if (attrs.flex != null) {
    const f = Number.parseFloat(attrs.flex);
    if (Number.isFinite(f)) node.setFlex(f);
  }
  if (attrs.grow != null) node.setFlexGrow(Number.parseFloat(attrs.grow));
  if (attrs.shrink != null) node.setFlexShrink(Number.parseFloat(attrs.shrink));
  if (attrs.basis != null) {
    const m = attrs.basis.match(PCT);
    if (m) node.setFlexBasisPercent(Number.parseFloat(m[1]!));
    else {
      const n = Number.parseFloat(attrs.basis);
      if (Number.isFinite(n)) node.setFlexBasis(n);
    }
  }

  if (attrs.gap != null) {
    const n = Number.parseFloat(attrs.gap);
    if (Number.isFinite(n)) node.setGap(Yoga.GUTTER_ALL, n);
  }
  if (attrs.rowGap != null) {
    const n = Number.parseFloat(attrs.rowGap);
    if (Number.isFinite(n)) node.setGap(Yoga.GUTTER_ROW, n);
  }
  if (attrs.columnGap != null) {
    const n = Number.parseFloat(attrs.columnGap);
    if (Number.isFinite(n)) node.setGap(Yoga.GUTTER_COLUMN, n);
  }

  applyEdges(node, "padding", attrs);
  applyEdges(node, "margin", attrs);

  const pos = parsePosition(attrs.position);
  if (pos != null) node.setPositionType(pos);

  setEdge(node, Yoga.EDGE_TOP, attrs.top ?? attrs.y);
  setEdge(node, Yoga.EDGE_LEFT, attrs.left ?? attrs.x);
  setEdge(node, Yoga.EDGE_RIGHT, attrs.right);
  setEdge(node, Yoga.EDGE_BOTTOM, attrs.bottom);

  if (attrs.aspectRatio != null) {
    const n = Number.parseFloat(attrs.aspectRatio);
    if (Number.isFinite(n)) node.setAspectRatio(n);
  }

  if (attrs.minWidth) setMin(node, "width", attrs.minWidth);
  if (attrs.minHeight) setMin(node, "height", attrs.minHeight);
  if (attrs.maxWidth) setMax(node, "width", attrs.maxWidth);
  if (attrs.maxHeight) setMax(node, "height", attrs.maxHeight);
}

function applyEdges(node: YogaNode, kind: "padding" | "margin", attrs: Attrs): void {
  const setOne = (edge: Edge, value: string | undefined) => {
    if (value == null) return;
    const pct = value.match(PCT);
    if (pct) {
      if (kind === "padding") node.setPaddingPercent(edge, Number.parseFloat(pct[1]!));
      else node.setMarginPercent(edge, Number.parseFloat(pct[1]!));
      return;
    }
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return;
    if (kind === "padding") node.setPadding(edge, n);
    else node.setMargin(edge, n);
  };
  setOne(Yoga.EDGE_ALL, attrs[kind]);
  setOne(Yoga.EDGE_HORIZONTAL, attrs[`${kind}X`]);
  setOne(Yoga.EDGE_VERTICAL, attrs[`${kind}Y`]);
  setOne(Yoga.EDGE_TOP, attrs[`${kind}Top`]);
  setOne(Yoga.EDGE_RIGHT, attrs[`${kind}Right`]);
  setOne(Yoga.EDGE_BOTTOM, attrs[`${kind}Bottom`]);
  setOne(Yoga.EDGE_LEFT, attrs[`${kind}Left`]);
}

function setEdge(node: YogaNode, edge: Edge, value: string | undefined) {
  if (value == null) return;
  const pct = value.match(PCT);
  if (pct) {
    node.setPositionPercent(edge, Number.parseFloat(pct[1]!));
    return;
  }
  const n = Number.parseFloat(value);
  if (Number.isFinite(n)) node.setPosition(edge, n);
}

function setMin(node: YogaNode, axis: "width" | "height", value: string) {
  const pct = value.match(PCT);
  if (pct) {
    if (axis === "width") node.setMinWidthPercent(Number.parseFloat(pct[1]!));
    else node.setMinHeightPercent(Number.parseFloat(pct[1]!));
    return;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return;
  if (axis === "width") node.setMinWidth(n);
  else node.setMinHeight(n);
}

function setMax(node: YogaNode, axis: "width" | "height", value: string) {
  const pct = value.match(PCT);
  if (pct) {
    if (axis === "width") node.setMaxWidthPercent(Number.parseFloat(pct[1]!));
    else node.setMaxHeightPercent(Number.parseFloat(pct[1]!));
    return;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return;
  if (axis === "width") node.setMaxWidth(n);
  else node.setMaxHeight(n);
}
