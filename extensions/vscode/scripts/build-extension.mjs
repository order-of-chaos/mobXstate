import { rmSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(extensionRoot, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [resolve(extensionRoot, "src", "extension.ts")],
  outfile: resolve(distDir, "extension.js"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["node18"],
  sourcemap: true,
  external: ["vscode"],
  logLevel: "info",
});
