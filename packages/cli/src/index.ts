import { parseArgs } from "./args.js";
import { buildCommand } from "./commands/build.js";
import { renderCommand } from "./commands/render.js";
import { initCommand } from "./commands/init.js";
import { devicesCommand } from "./commands/devices.js";
import { watchCommand } from "./commands/watch.js";
import { presetsCommand } from "./commands/presets.js";
import { serveCommand } from "./commands/serve.js";

const HELP = `framedeck — Figma for screenshots

Usage:
  framedeck                                        open the current app repo's FrameDeck project
  framedeck build  [project-dir] [--out <dir>] [--scale N] [--assets <dir>]
  framedeck editor [--port N] [--projects <dir>] [--assets <dir>]
  framedeck serve  [--port N] [--projects <dir>] [--assets <dir>]
  framedeck render <file-or-dir> [--out <path>] [--scale N] [--assets <dir>]
  framedeck watch  <project-dir> [--out <dir>] [--scale N]
  framedeck init   <project-name> [--device <slug>] [--display-name <name>]
  framedeck devices [--family iphone|ipad|apple-watch] [--json]
  framedeck presets [--json]

Flags:
  --assets    path to assets/device-bezels (auto-detected by default)
  --scale     output pixel scale multiplier (default 1)
  --out       output file or directory
  --port,-p   port for \`serve\` (default 4242)
  --projects  base directory containing project folders
  --project   project directory for the current app repo (default screenshots/)

Examples:
  framedeck
  framedeck build
  framedeck editor --port 5000
  framedeck render projects/example-app/screens/hero.screen
  framedeck render projects/example-app --scale 2
  framedeck devices --family iphone
  framedeck init my-app --device iphone-16-pro-max
`;

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const cmd = args.positional[0];

  // `framedeck --help` (no positional, help flag) → print help.
  // `framedeck` (no args at all) → boot the editor.
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
      console.log("framedeck 0.1.0");
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(2);
  }
}
