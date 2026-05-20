# ScreenDeck

ScreenDeck is a local editor and CLI for building App Store screenshot decks.
Projects are plain folders with `project.json`, `screens/*.screen`, and optional
`shots/*` images, so they can live directly inside the app repo they document.

## Quick Start

```bash
npm install
npm run build

# From an app repo, opens or creates ./screenshots and jumps straight to it.
node /path/to/ScreenDeck/packages/cli/bin/screendeck.js

# Open the all-projects editor.
node /path/to/ScreenDeck/packages/cli/bin/screendeck.js editor

# Render a project or one screen.
node /path/to/ScreenDeck/packages/cli/bin/screendeck.js render screenshots
node /path/to/ScreenDeck/packages/cli/bin/screendeck.js render screenshots/screens/hero.screen
```

## Project Discovery

Running `screendeck` from an app repo uses `screenshots/` by default. Override
that directory with `SCREENDECK_PROJECT=path/to/project` or `--project path`.
The misspelled `SCREENDECK_PROEJCT` alias is accepted for compatibility.

ScreenDeck keeps a registry at `~/.screendeck/registry.json`. Projects are added
automatically when opened or created, and stale entries are pruned when the
editor lists projects. `screendeck editor` ignores the current app repo and
opens the all-projects screen.

## Workspace

```text
packages/core      parser, filesystem project helpers, boards, devices
packages/renderer  Yoga layout and Canvas rendering
packages/cli       screendeck command line
packages/web       Next.js editor
assets/            bundled device bezel assets
projects/          local example projects
```

Useful scripts:

```bash
npm run dev       # editor on http://localhost:4242
npm run build     # core, renderer, cli, web
npm run cli -- --help
```

## License

Apache-2.0. See [LICENSE](LICENSE).
