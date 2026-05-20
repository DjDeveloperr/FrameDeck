---
name: framedeck
description: Author and render App Store screenshots using the FrameDeck `.screen` format. Use when the user wants to create, edit, render, or organize screenshot mockups for iPhone, iPad, or Apple Watch — including authoring `.screen` files, arranging them in boards, picking device frames, and exporting PNGs.
---

# FrameDeck

FrameDeck is a precision compositor for App Store screenshots and device
mockups. Screenshots are stored as `.screen` files — small, hand-editable,
agent-friendly JSX-ish documents that render identically through the CLI
(Skia/Node canvas) and the web editor (DOM canvas, same code).

## When to use this skill

- Authoring or editing `.screen` files by hand.
- Creating new screenshot projects.
- Composing multiple screens into a board (e.g. an "iPhone Screenshots" set).
- Picking device frames (iPhone/iPad/Apple Watch) from the bundled bezel
  library.
- Rendering `.screen` documents to PNGs for App Store submission.

## Project layout

```
projects/<app>/
  project.json          ← name, id, optional export presets
  boards.json           ← UI groupings of screens (created/edited by editor)
  screens/
    01-hero.screen      ← one <Screen> document per file
    02-feature.screen
    ...
  shots/                ← raster files used as <Device screenshot="..."> sources
    home.png
```

A project is just a directory with `project.json`. Boards are persisted as
`boards.json` next to it. Each board is an ordered list of screen references
with `(x, y)` positions on a free-form 2-D canvas.

## The `.screen` format

A `.screen` file is a single JSX-ish document with one root `<Screen>`. The
runtime parses it, lays it out with Yoga (flexbox), then paints onto a canvas.

```jsx
<Screen size="1284x2778">
  <Background color="#0a0a0a" />

  <VStack padding="120" gap="48" alignItems="center" width="100%">
    <Text size="120" weight="800" color="#fff" align="center" tracking="-2">
      Designed for focus.
    </Text>
    <Text size="44" weight="400" color="#a1a1aa" align="center" maxWidth="900">
      A precision tool for crafting App Store screenshots.
    </Text>
    <Device model="iphone-16-pro" width="900" screenshot="shots/home.png" />
  </VStack>
</Screen>
```

### Rules

1. **Exactly one root** `<Screen>` with a required `size="WIDTHxHEIGHT"`.
2. Everything else lives inside.
3. **Flexbox by default.** Containers (`Screen`, `VStack`, `HStack`,
   `Background`, `Gradient`) arrange children with flex semantics.
4. Set `position="absolute"` to opt out of flow; pair with `x` / `y` (aliases
   for `left` / `top`) for explicit placement.
5. Sizes accept plain numbers (`"100"`), `px` (`"100px"`), `%` (`"50%"`), or
   `"auto"`.
6. Relative image paths (e.g. `shots/home.png`) resolve against the project
   root.

### Common attributes (any element)

| Attribute                       | Meaning                                          |
| ------------------------------- | ------------------------------------------------ |
| `width`, `height`               | Yoga-driven size                                 |
| `padding{,X,Y,Top,Right,Bottom,Left}` | Inner spacing                              |
| `margin{,X,Y,Top,Right,Bottom,Left}`  | Outer spacing                              |
| `gap`, `rowGap`, `columnGap`    | Spacing between flex children                    |
| `direction` / `flexDirection`   | `row` \| `column` \| `row-reverse` \| `column-reverse` |
| `justify` / `justifyContent`    | `start` \| `end` \| `center` \| `between` \| `around` \| `evenly` |
| `alignItems`                    | `start` \| `end` \| `center` \| `stretch`        |
| `alignSelf`                     | Same values, applied to self                     |
| `flex`, `grow`, `shrink`, `basis` | Flexbox sizing                                 |
| `position`                      | `relative` (default) \| `absolute`               |
| `x`, `y`, `top`, `right`, `bottom`, `left` | Active when position=absolute         |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | Size bounds                   |
| `aspectRatio`                   | `width / height` ratio                           |
| `opacity`                       | 0–1                                              |

### Elements

- **`<Screen size="WxH">`** — root. Sets the output canvas size.
- **`<Background color image radius opacity>`** — full-bleed fill by default.
- **`<Gradient css from to direction>`** — full-bleed linear gradient.
  Either pass a CSS string (`css="linear-gradient(180deg, #000 0%, #1a1a1a 100%)"`)
  or `from` + `to` + optional `direction`.
- **`<Text size weight color font align maxWidth lineHeight tracking>`** — text
  content goes between the tags. Default align is `left`.
- **`<Device model width|height|scale screenshot screen screenColor buttons opacity>`**
  - `model` — slug (`iphone-16-pro`) or Apple model id (`iPhone17,1`)
  - `screenshot` — path to a raster image to paint inside the bezel
  - `screenColor` — solid fill (if no screenshot)
  - `buttons` — `true` (default) shows side buttons; `false` hides them
- **`<Image src fit width height opacity>`**
  - `fit` — `cover` (default) \| `contain` \| `fill` \| `none`
- **`<Shape kind fill stroke strokeWidth radius blur opacity>`**
  - `kind` — `rect` (default) \| `circle` \| `ellipse`
- **`<VStack>` / `<HStack>`** — aliases for flex containers (`direction="column"` / `"row"`).

### App Store size presets

The canonical canvas sizes Apple expects:

| Preset                | Size        |
| --------------------- | ----------- |
| iPhone 6.9" portrait  | `1284x2778` |
| iPhone 6.5" portrait  | `1242x2688` |
| iPad 13"  portrait    | `2064x2752` |
| iPad 12.9" portrait   | `2048x2732` |
| Apple Watch Series 11 | `416x496`   |
| Apple Watch Ultra 3   | `422x514`   |

Run `framedeck presets` for the full list.

## CLI

```bash
# Discover bundled device frames (slug to use in `model=`)
framedeck devices --family iphone
framedeck devices --json

# List App Store canvas presets
framedeck presets

# Render a single file → PNG next to the source
framedeck render projects/<app>/screens/01-hero.screen
framedeck render projects/<app>/screens/01-hero.screen --scale 2

# Render every screen in a project → projects/<app>/out/*.png
framedeck render projects/<app>

# Watch + re-render on save
framedeck watch projects/<app>

# Scaffold a fresh project
framedeck init my-app --device iphone-16-pro-max
```

CLI options:

- `--out <path>` — output file or directory
- `--scale N` — output pixel multiplier (1 = artwork pixels)
- `--assets <dir>` — override the bundled bezels directory

## Programmatic API

```ts
// Render server-side / from any Node script.
import { parseScreen, DeviceRegistry } from "@framedeck/core";
import { loadDeviceIndexFromFs } from "@framedeck/core/fs";
import { renderDocumentNode } from "@framedeck/renderer/node";

const devices = new DeviceRegistry(
  "<repo>/assets/device-bezels",
  loadDeviceIndexFromFs("<repo>/assets/device-bezels"),
);
const doc = parseScreen(fs.readFileSync(screenPath, "utf8"));
const canvas = await renderDocumentNode(doc, {
  baseDir: projectRoot,
  devices,
  scale: 1,
});
fs.writeFileSync("out.png", canvas.toBuffer("image/png"));
```

In the browser, swap `renderDocumentNode` for the web entry:

```ts
import { renderDocument } from "@framedeck/renderer";
import { webBackend } from "@framedeck/renderer/web";
```

## Authoring tips for agents

1. **Always declare a canvas size** on `<Screen>`. Use a known App Store
   preset unless told otherwise.
2. **Prefer stacks for stable layout.** Reach for `VStack` / `HStack` with
   `gap` and `padding` before going to absolute positioning. Flex math is
   deterministic; absolute positioning isn't auto-responsive.
3. **Absolute positioning is explicit.** `x` / `y` only take effect when
   `position="absolute"` is set.
4. **Devices lock aspect ratio.** Setting `width` (or `height`) is enough;
   the other dimension is computed from the bezel. Don't set both unless you
   intentionally want distortion.
5. **Relative paths are project-root-relative.** Reference shots as
   `shots/foo.png`, not `../shots/foo.png`.
6. **Whitespace inside `<Text>` is collapsed** to single spaces. Use a literal
   `\n` to force a line break.
7. **Re-use the format spec** (`docs/screen-format.md`) when in doubt — it's
   the authoritative reference.

## Boards (groups of screens on a canvas)

`<project>/boards.json` describes UI groupings:

```json
{
  "boards": [
    {
      "id": "iphone",
      "name": "iPhone Screenshots",
      "screens": [
        { "name": "01-hero",    "x": 0,    "y": 0 },
        { "name": "02-feature", "x": 1444, "y": 0 },
        { "name": "03-cta",     "x": 2888, "y": 0 }
      ]
    },
    {
      "id": "ipad",
      "name": "iPad Screenshots",
      "screens": []
    }
  ]
}
```

If `boards.json` is missing, the editor synthesizes a single `Untitled 1`
board listing every `.screen` file horizontally. Agents creating boards
programmatically should:

- Pick a unique `id` (any short slug — only used internally).
- Give a human-readable `name`.
- Position screens at `(x, y)` in artwork pixels; default stride is
  `DEFAULT_SCREEN_WIDTH (1284) + 160` between screens.

Screens may appear in multiple boards. Removing a screen from a board does
not delete the underlying `.screen` file.

## A complete starter

```jsx
<Screen size="1284x2778">
  <Gradient css="linear-gradient(180deg, #0a0a0a 0%, #1f1f1f 100%)" />

  <VStack padding="120" paddingTop="200" gap="48" alignItems="center" width="100%">
    <Text size="140" weight="800" color="#ffffff" align="center" tracking="-4">
      Track every workout.
    </Text>
    <Text size="44" weight="400" color="#a1a1aa" align="center" maxWidth="900">
      Insights that move with you.
    </Text>
    <Device model="iphone-16-pro" width="900" marginTop="80" screenshot="shots/workout-home.png" />
  </VStack>
</Screen>
```
