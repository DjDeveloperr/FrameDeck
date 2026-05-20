// `screendeck presets [--json]` — list the bundled App Store size presets.

import { APP_STORE_PRESETS } from "@screendeck/core";
import { boolFlag, type ParsedArgs } from "../args.js";

export async function presetsCommand(args: ParsedArgs): Promise<void> {
  if (boolFlag(args, "json")) {
    console.log(JSON.stringify(APP_STORE_PRESETS, null, 2));
    return;
  }
  const idCol = Math.max(...APP_STORE_PRESETS.map((p) => p.id.length), 2);
  const labelCol = Math.max(...APP_STORE_PRESETS.map((p) => p.label.length), 5);
  console.log(`${"id".padEnd(idCol)}  ${"label".padEnd(labelCol)}  size`);
  console.log(`${"-".repeat(idCol)}  ${"-".repeat(labelCol)}  ----`);
  for (const p of APP_STORE_PRESETS) {
    console.log(`${p.id.padEnd(idCol)}  ${p.label.padEnd(labelCol)}  ${p.size}`);
  }
}
