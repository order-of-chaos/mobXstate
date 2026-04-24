import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const [command, ...passthroughArgs] = process.argv.slice(2);

const run = (binary, args, options = {}) => {
  const result = spawnSync(binary, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const capture = (binary, args) => {
  return spawnSync(binary, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
};

const assertCleanGitTree = () => {
  const result = capture("git", ["status", "--porcelain"]);

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  if (result.stdout.trim().length > 0) {
    console.error("Release commands require a clean git working tree.");
    process.exit(1);
  }
};

const getNpmUsername = () => {
  const result = capture(npmCommand, ["whoami"]);

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
};

const requireNpmAuth = () => {
  const username = getNpmUsername();

  if (!username) {
    console.error("npm auth is missing. Run `npm run release:login` first.");
    process.exit(1);
  }

  return username;
};

const runNpmScript = (scriptName) => {
  run(npmCommand, ["run", scriptName]);
};

const runChangeset = (args) => {
  run(npxCommand, ["--no-install", "changeset", ...args]);
};

const runReleaseCheck = () => {
  mkdirSync("/tmp/release-pack", { recursive: true });
  runNpmScript("lint");
  runNpmScript("typecheck");
  runNpmScript("test");
  runNpmScript("build");
  runNpmScript("pages:build");
  runNpmScript("pack:package");
  runNpmScript("smoke:package");
};

const runPublish = () => {
  assertCleanGitTree();
  const username = requireNpmAuth();

  console.log(`Publishing to npm as ${username}`);
  runNpmScript("build");
  runChangeset(["publish", ...passthroughArgs]);
};

const runShip = () => {
  assertCleanGitTree();
  requireNpmAuth();

  run(npmCommand, ["ci"]);
  runReleaseCheck();
  runPublish();
};

const printUsage = () => {
  console.error(
    "Usage: node ./scripts/release.mjs <login|whoami|status|version|check|publish|ship> [-- <args>]",
  );
  process.exit(1);
};

switch (command) {
  case "login":
    run(npmCommand, ["login", ...passthroughArgs]);
    break;

  case "whoami":
    run(npmCommand, ["whoami"]);
    break;

  case "status":
    runChangeset(["status", "--verbose"]);
    break;

  case "version":
    assertCleanGitTree();
    runChangeset(["version", ...passthroughArgs]);
    break;

  case "check":
    runReleaseCheck();
    break;

  case "publish":
    runPublish();
    break;

  case "ship":
    runShip();
    break;

  default:
    printUsage();
}
