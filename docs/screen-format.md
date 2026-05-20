# The `.screen` format

A `.screen` file is a single JSX-like document that describes one App Store
screenshot or device mockup. The runtime parses the document, computes a
flexbox layout via Yoga, then paints each element onto a canvas. Output is a
PNG at the size declared on the root `<Screen>`.

The format is intentionally familiar — agents and humans both read it the same
way they'd read HTML or React Native JSX, and predictable layout falls out of
flexbox semantics applied identically in Node and the browser.

## Document shape

```jsx
<Screen size="1290x2796">
  ...children...
</Screen>
```

* Exactly one root `<Screen>` element.
* `size` is required, formatted as `WIDTHxHEIGHT` in pixels (the canvas size).
* All other elements live inside.
* Whitespace and indentation are insignificant.

## Coordinate model

* Flexbox is the default. Containers (`Screen`, `VStack`, `HStack`, `Background`)
  arrange children using flex semantics (`direction`, `justify`, `alignItems`,
  `gap`, etc.).
* Set `position="absolute"` on a child to opt out of the flow; combine with
  `x`/`y` (aliases for `left`/`top`) for precise placement.
* Sizes accept three forms: plain number (`"100"`), `px` suffix (`"100px"`),
  or percent (`"50%"`). `"auto"` is also accepted on width/height.

## Common attributes (any element)

| Attribute                          | Meaning                                          |
| ---------------------------------- | ------------------------------------------------ |
| `width`, `height`                  | Yoga-driven size                                 |
| `padding`, `paddingX`, `paddingY`, `paddingTop`, … | Inner spacing                    |
| `margin`, `marginX`, `marginY`, `marginTop`, …   | Outer spacing                    |
| `gap`, `rowGap`, `columnGap`       | Spacing between children                         |
| `direction` / `flexDirection`      | `row` \| `column` \| `row-reverse` \| `column-reverse` |
| `justify` / `justifyContent`       | `start` \| `end` \| `center` \| `between` \| `around` \| `evenly` |
| `alignItems`                       | `start` \| `end` \| `center` \| `stretch`        |
| `alignSelf`                        | Same values, applied to self                     |
| `flex`, `grow`, `shrink`, `basis`  | Flexbox sizing                                   |
| `position`                         | `relative` (default) \| `absolute`               |
| `x`, `y`, `top`, `right`, `bottom`, `left` | Active when position=absolute            |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | Size bounds                        |
| `aspectRatio`                      | `width / height` ratio                           |
| `opacity`                          | 0–1                                              |

## Elements

### `<Screen size="WxH">`
Root container. Sets the output canvas size. Treats children as a normal
flexbox container (defaults to `column` direction).

### `<Background color image radius opacity>`
Paints a fill across its computed box. Stretches to its parent by default.

* `color` — any CSS color
* `image` — relative path to a raster image (file system or URL on web)
* `radius` — rounds & clips

### `<Gradient from to direction css>`
Linear gradient fill across the computed box.

* `css` — full CSS gradient: `linear-gradient(180deg, #000 0%, #1a1a1a 100%)`
* Or simpler: `from`, `to`, and `direction="180deg"`

### `<Text size weight color font align maxWidth lineHeight tracking>`
Renders the text content of the element (everything between the tags).

* `size`, `weight`, `font`, `color`
* `align` — `left` \| `center` \| `right`
* `maxWidth` — wrap width (auto-derived from the layout slot if omitted)
* `lineHeight` — multiplier (default 1.18)
* `tracking` — letter-spacing in px

### `<Device model width|height|scale screenshot screen screenColor buttons opacity>`
Composites a device frame with optional embedded screenshot.

* `model` — slug (`iphone-16-pro`) or Apple model id (`iPhone17,1`)
* `width` / `height` / `scale` — size; aspect ratio is locked automatically
* `screenshot` — image painted inside the screen rect (clipped by mask)
* `screenColor` — solid fill (use when no screenshot)
* `buttons` — `true` (default) shows side buttons; `false` hides them

### `<Image src fit width height opacity>`
Raster image placement.

* `fit` — `cover` (default) \| `contain` \| `fill` \| `none`

### `<Shape kind fill stroke strokeWidth radius blur opacity>`
Basic shape primitive.

* `kind` — `rect` (default) \| `circle` \| `ellipse`
* `radius` — corner radius on rectangles
* `blur` — pixel blur (for ambient/depth effects)

### `<VStack>` / `<HStack>`
Aliases for flex containers (`direction="column"` and `direction="row"`).
Accept all flex attributes.

## Predictability rules for agents

1. **One root, one canvas size.** Always declare `<Screen size="WxH">`.
2. **Use stacks for stable layout.** Reach for `VStack` / `HStack` with
   `gap` and `padding` before resorting to absolute positioning. Layout is
   then driven by flex math and won't drift across renders.
3. **Absolute positioning is explicit.** When you need precise control, set
   `position="absolute"` and provide `x`/`y`. Without `position="absolute"`,
   `x`/`y` are ignored.
4. **Devices lock aspect ratio.** A `<Device model="..." width="900" />`
   computes height automatically — never set both unless you want distortion.
5. **Relative paths resolve against the .screen file's directory.** Keep
   screenshots in `shots/` next to `screens/` for a tidy project.
6. **Whitespace inside `<Text>` is collapsed.** Use `\n` (literal) in the
   content to force a line break.

## Rendering

```bash
# Single file
framedeck render screens/hero.screen

# Project (all screens/*.screen)
framedeck render projects/example-app

# 2x scale (HiDPI output)
framedeck render screens/hero.screen --scale 2
```

Outputs land alongside the source as `<name>.png`, or under `out/` when
rendering a project directory.

## Programmatic API

```ts
import { renderSourceToFile } from "framedeck-renderer/node";
import { DeviceRegistry } from "framedeck-core";

await renderSourceToFile(sourceText, "out/hero.png", {
  baseDir: "./projects/example-app/screens",
  devices: new DeviceRegistry("./assets/device-bezels"),
});
```

Same API exists on the web (`framedeck-renderer/web`) — it draws to an
`HTMLCanvasElement` instead of writing a file.
