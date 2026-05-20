import { parseArgs } from "./args.js";
import { buildCommand } from "./commands/build.js";
import { renderCommand } from "./commands/render.js";
import { initCommand } from "./commands/init.js";
import { devicesCommand } from "./commands/devices.js";
import { watchCommand } from "./commands/watch.js";
import { presetsCommand } from "./commands/presets.js";
import { serveCommand } from "./commands/serve.js";

const HELP = `screendeck — Figma for screenshots

Usage:
  screendeck                                        open the current app repo's ScreenDeck project
  screendeck build  [project-dir] [--out <dir>] [--scale N] [--assets <dir>]
  screendeck editor [--port N] [--projects <dir>] [--assets <dir>]
  screendeck serve  [--port N] [--projects <dir>] [--assets <dir>]
  screendeck render <file-or-dir> [--out <path>] [--scale N] [--assets <dir>]
  screendeck watch  <project-dir> [--out <dir>] [--scale N]
  screendeck init   <project-name> [--device <slug>] [--display-name <name>]
  screendeck devices [--family iphone|ipad|apple-watch] [--json]
  screendeck presets [--json]

Flags:
  --assets    path to assets/device-bezels (auto-detected by default)
  --scale     output pixel scale multiplier (default 1)
  --out       output file or directory
  --port,-p   port for \`serve\` (default 4242)
  --projects  base directory containing project folders
  --project   project directory for the current app repo (default screenshots/)

Examples:
  screendeck
  screendeck build
  screendeck editor --port 5000
  screendeck render projects/example-app/screens/hero.screen
  screendeck render projects/example-app --scale 2
  screendeck devices --family iphone
  screendeck init my-app --device iphone-16-pro-max
`;

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const cmd = args.positional[0];

  // `screendeck --help` (no positional, help flag) → print help.
  // `screendeck` (no args at all) → boot the editor.
  if (!cmd) {
    if (args.flags.help || args.flags.h) {
      console.log(HELP);
      return;
    }
    return serveCommand(args, { mode: "project" });
  }

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }

  switch (cmd) {
    case "build":   return buildCommand(args);
    case "editor":  return serveCommand(args, { mode: "editor" });
    case "serve":   return serveCommand(args, { mode: "editor" });
    case "render":  return renderCommand(args);
    case "init":    return initCommand(args);
    case "devices": return devicesCommand(args);
    case "presets": return presetsCommand(args);
    case "watch":   return watchCommand(args);
    case "version":
    case "--version":
      console.log("screendeck 0.1.0");
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(2);
  }
}
