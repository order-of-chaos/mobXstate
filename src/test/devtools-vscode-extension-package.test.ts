import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

interface PackageJson {
  readonly main?: string;
  readonly scripts?: Record<string, string>;
  readonly files?: readonly string[];
}

interface TsConfig {
  readonly compilerOptions?: {
    readonly noEmit?: boolean;
    readonly outDir?: string;
    readonly rootDir?: string;
    readonly declaration?: boolean;
  };
}

describe("VS Code extension package scaffold", () => {
  it("declares a build that emits the configured extension entrypoint", () => {
    const packageJson = readJson<PackageJson>("extensions/vscode/package.json");
    const buildConfig = readJson<TsConfig>(
      "extensions/vscode/tsconfig.build.json",
    );

    expect(packageJson.main).toBe("./dist/extension.js");
    expect(packageJson.scripts?.build).toBe("tsc -p tsconfig.build.json");
    expect(packageJson.scripts?.clean).toContain("dist");
    expect(packageJson.files).toEqual(["dist", "README.md", "package.json"]);
    expect(buildConfig.compilerOptions?.noEmit).toBe(false);
    expect(buildConfig.compilerOptions?.rootDir).toBe("src");
    expect(buildConfig.compilerOptions?.outDir).toBe("dist");
    expect(buildConfig.compilerOptions?.declaration).toBe(false);
  });
});
