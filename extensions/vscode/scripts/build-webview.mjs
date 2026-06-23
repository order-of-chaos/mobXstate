import { rmSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = resolve(extensionRoot, "media");

rmSync(mediaDir, { recursive: true, force: true });
mkdirSync(mediaDir, { recursive: true });

await build({
  entryPoints: [resolve(extensionRoot, "webview", "visualEditor.tsx")],
  outfile: resolve(mediaDir, "mobxstate-visual-editor.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  logLevel: "info",
  loader: {
    ".css": "css",
  },
});
