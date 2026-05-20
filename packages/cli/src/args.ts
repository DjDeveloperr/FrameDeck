// Tiny argv parser — minimal surface, no third-party dep so install is light.
//
// Supports:
//   command positionals
//   --flag (boolean true)
//   --no-flag (boolean false)
//   --key=value, --key value
//   -k value (single-letter)

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (body.startsWith("no-")) {
        flags[body.slice(3)] = false;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

export function flag(args: ParsedArgs, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = args.flags[n];
    if (typeof v === "string") return v;
    if (v === true) return "";
  }
  return undefined;
}

export function boolFlag(args: ParsedArgs, ...names: string[]): boolean | undefined {
  for (const n of names) {
    const v = args.flags[n];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false" && v !== "no";
  }
  return undefined;
}
