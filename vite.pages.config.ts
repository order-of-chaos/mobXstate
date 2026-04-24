import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "mobXstate";
const liveRoot = path.resolve(rootDir, "examples/live");

export default defineConfig({
  root: liveRoot,
  base: process.env.GITHUB_ACTIONS === "true" ? `/${repositoryName}/` : "/",
  build: {
    outDir: path.resolve(rootDir, "dist-pages"),
    emptyOutDir: true,
  },
});
