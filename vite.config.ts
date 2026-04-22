import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["mobx", "ts-pattern"],
      output: {
        globals: {
          mobx: "mobx",
          "ts-pattern": "tsPattern",
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./src/test/setup.ts",
  },
});
