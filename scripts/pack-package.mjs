import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packDirectory = "/tmp/release-pack";
const npmCache = path.join(os.tmpdir(), "mobxstate-pack-npm-cache");

mkdirSync(packDirectory, { recursive: true });
mkdirSync(npmCache, { recursive: true });

const result = spawnSync(npmCommand, ["pack", "--pack-destination", packDirectory], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_cache: npmCache,
    npm_config_update_notifier: "false",
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
