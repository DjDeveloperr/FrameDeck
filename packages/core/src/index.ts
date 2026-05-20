// Browser-safe core: parser, AST, layout helpers, device registry data types,
// App Store presets. Filesystem-backed helpers (project + devices-fs) live in
// "@screendeck/core/fs" so this entry doesn't pull `node:fs` into web bundles.
export * from "./ast.js";
export * from "./parse.js";
export * from "./serialize.js";
export * from "./path.js";
export * from "./templates.js";
export * from "./layout.js";
export * from "./devices.js";
export * from "./presets.js";
export type { Project, ProjectManifest, ProjectScreen, ProjectExport } from "./project.js";
export * from "./boards.js";
