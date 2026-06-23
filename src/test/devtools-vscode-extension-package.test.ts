import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

interface PackageJson {
  readonly main?: string;
  readonly scripts?: Record<string, string>;
  readonly files?: readonly string[];
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
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
    expect(packageJson.scripts?.build).toBe(
      "tsc -p tsconfig.json && tsc -p tsconfig.webview.json && node scripts/build-extension.mjs && node scripts/build-webview.mjs",
    );
    expect(packageJson.scripts?.["build:extension"]).toBe(
      "node scripts/build-extension.mjs",
    );
    expect(packageJson.scripts?.["build:webview"]).toBe(
      "node scripts/build-webview.mjs",
    );
    expect(packageJson.scripts?.clean).toContain("dist");
    expect(packageJson.files).toEqual([
      "dist",
      "media",
      "LICENSE",
      "README.md",
      "package.json",
    ]);
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies?.["@orderofchaos/mobxstate"]).toBeDefined();
    expect(packageJson.devDependencies?.["@xyflow/react"]).toBeDefined();
    expect(packageJson.devDependencies?.react).toBeDefined();
    expect(packageJson.devDependencies?.["react-dom"]).toBeDefined();
    expect(packageJson.devDependencies?.esbuild).toBeDefined();
    expect(buildConfig.compilerOptions?.noEmit).toBe(true);
    expect(buildConfig.compilerOptions?.declaration).toBe(false);
  });

  it("keeps the webview graph-first with editor and simulation modes", () => {
    const source = readFileSync(
      "extensions/vscode/webview/visualEditor.tsx",
      "utf8",
    );
    const stylesheet = readFileSync(
      "extensions/vscode/webview/visualEditor.css",
      "utf8",
    );

    expect(source).toContain("applyNodeChanges");
    expect(source).toContain("onNodesChange");
    expect(source).toContain("sourceHandle");
    expect(source).toContain("targetHandle");
    expect(source).toContain("transitionEdge");
    expect(source).toContain("getNodeBoundaryAnchor");
    expect(source).toContain("getRoundedOrthogonalTransitionPath");
    expect(source).toContain("sourceNodeRect");
    expect(source).toContain("targetNodeRect");
    expect(source).not.toContain(
      "M ${sourceX},${sourceY} L ${labelCenter.x},${labelCenter.y} L ${targetX},${targetY}",
    );
    expect(source).toContain("transition-edge-label");
    expect(source).toContain("height: 82");
    expect(source).toContain("getTransitionLabelSize");
    expect(source).not.toContain("width: 248");
    expect(source).not.toContain("height: 104");
    expect(stylesheet).toContain("height: 100%");
    expect(stylesheet).not.toContain("width: 248px");
    expect(source).toContain("labelPositions");
    expect(source).toContain("LAYOUT_UPDATED");
    expect(source).toContain("panOnDrag={true}");
    expect(source).toContain("selectionOnDrag={false}");
    expect(source).not.toContain("panOnDrag={uiMode === \"simulation\"}");
    expect(source).not.toContain("transitionLabelNode");
    expect(source).not.toContain("fitView");
    expect(source).toContain("Simulation");
    expect(source).not.toContain('data-testid="state-list"');
    expect(source).not.toContain('data-testid="transition-list"');
    expect(source).not.toContain('data-testid="diagnostic-list"');
    expect(source).not.toContain('data-testid="export-panel"');
    expect(source).not.toContain(">Viewer<");
  });
});
