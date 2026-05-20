# FrameDeck

FrameDeck is a local editor and CLI for building App Store screenshot decks.
Projects are plain folders with `project.json`, `screens/*.screen`, and optional
`shots/*` images, so they can live directly inside the app repo they document.

## Quick Start

```bash
npm install
npm run build

# From an app repo, opens or creates ./screenshots and jumps straight to it.
node /path/to/FrameDeck/packages/cli/bin/framedeck.js

# From an app repo, exports every screen to ./screenshots/dist.
node /path/to/FrameDeck/packages/cli/bin/framedeck.js build

# Open the all-projects editor.
node /path/to/FrameDeck/packages/cli/bin/framedeck.js editor

# Render a project or one screen.
node /path/to/FrameDeck/packages/cli/bin/framedeck.js render screenshots
node /path/to/FrameDeck/packages/cli/bin/framedeck.js render screenshots/screens/hero.screen
```

## Project Discovery

Running `framedeck` from an app repo uses `screenshots/` by default. Override
that directory with `FRAMEDECK_PROJECT=path/to/project` or `--project path`.
The misspelled `FRAMEDECK_PROEJCT` alias is accepted for compatibility.

FrameDeck keeps a registry at `~/.framedeck/registry.json`. Projects are added
automatically when opened or created, and stale entries are pruned when the
editor lists projects. `framedeck editor` ignores the current app repo and
opens the all-projects screen.

## Build

Run `framedeck build` from an app repo to render every `screens/*.screen` file
in the detected project. By default, output is written to `screenshots/dist/`.
Use `--out path` to choose a different destination and `--scale 2` for higher
resolution exports.

```bash
framedeck build
framedeck build --out screenshots/dist --scale 2
```

## Workspace

```text
packages/core      parser, filesystem project helpers, boards, devices
packages/renderer  Yoga layout and Canvas rendering
packages/cli       framedeck command line
packages/web       Next.js editor
assets/            bundled device bezel assets
projects/          local example projects
```

Useful scripts:

```bash
npm run dev       # editor on http://localhost:4242
npm run check     # build and test
npm run cli -- --help
```

## Release

The CI workflow runs `npm run check` on pushes and pull requests. The npm
release workflow publishes `framedeck-core`, `framedeck-renderer`, and
`framedeck` when a `vX.Y.Z` tag is pushed, using npm trusted publishing
(OIDC) and provenance.

## License

Apache-2.0. See [LICENSE](LICENSE).
