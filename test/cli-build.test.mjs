import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("screendeck build exports app-local screenshots to screenshots/dist", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "screendeck-build-"));
  try {
    const projectRoot = join(workspace, "screenshots");
    await mkdir(join(projectRoot, "screens"), { recursive: true });
    await writeFile(
      join(projectRoot, "project.json"),
      JSON.stringify({ name: "Fixture App", id: "fixture-app" }, null, 2) + "\n",
    );
    await writeFile(
      join(projectRoot, "screens", "01-hero.screen"),
      `<Screen size="64x64">\n  <Background color="#101010" />\n</Screen>\n`,
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, "packages", "cli", "bin", "screendeck.js"),
        "build",
        "--assets",
        join(repoRoot, "assets", "device-bezels"),
      ],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          SCREENDECK_HOME: join(workspace, ".screendeck"),
        },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = await readFile(join(projectRoot, "dist", "01-hero.png"));
    assert.deepEqual([...output.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
