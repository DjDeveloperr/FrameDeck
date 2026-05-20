// `framedeck devices [--family iphone|ipad|apple-watch] [--json]`
//
// Lists device slugs and friendly names from the bundled bezel index. Useful
// for agents that want to feed a value to the `model="..."` attribute.

import { DeviceRegistry, type DeviceFamily } from "@framedeck/core";
import { loadDeviceIndexFromFs } from "@framedeck/core/fs";
import { resolveAssetsRoot } from "../assets.js";
import { flag, boolFlag, type ParsedArgs } from "../args.js";

const VALID: DeviceFamily[] = ["iphone", "ipad", "apple-watch"];

export async function devicesCommand(args: ParsedArgs): Promise<void> {
  const familyArg = flag(args, "family", "f");
  if (familyArg && !VALID.includes(familyArg as DeviceFamily)) {
    console.error(`--family must be one of: ${VALID.join(", ")}`);
    process.exit(2);
  }
  const assetsRoot = resolveAssetsRoot(flag(args, "assets"));
  const devices = new DeviceRegistry(assetsRoot, loadDeviceIndexFromFs(assetsRoot));
  const list = devices.list(familyArg as DeviceFamily | undefined);

  if (boolFlag(args, "json")) {
    console.log(JSON.stringify(
      list.map((d) => ({
        slug: d.slug,
        name: d.name,
        family: d.family,
        modelIdentifier: d.modelIdentifier,
        size: `${d.geometry.totalWidth}x${d.geometry.totalHeight}`,
      })),
      null,
      2,
    ));
    return;
  }

  const slugCol = Math.max(...list.map((d) => d.slug.length), 4);
  const nameCol = Math.max(...list.map((d) => d.name.length), 4);
  console.log(`${"slug".padEnd(slugCol)}  ${"name".padEnd(nameCol)}  family       size`);
  console.log(`${"-".repeat(slugCol)}  ${"-".repeat(nameCol)}  -----------  ----`);
  for (const d of list) {
    const size = `${d.geometry.totalWidth}×${d.geometry.totalHeight}`;
    console.log(
      `${d.slug.padEnd(slugCol)}  ${d.name.padEnd(nameCol)}  ${d.family.padEnd(11)}  ${size}`,
    );
  }
  console.log(`\n${list.length} device${list.length === 1 ? "" : "s"}`);
}
