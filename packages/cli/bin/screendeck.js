#!/usr/bin/env node
import("../dist/index.js").then((mod) => mod.main(process.argv.slice(2))).catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
