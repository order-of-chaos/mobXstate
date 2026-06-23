import { describe, expect, it } from "vitest";

import {
  createVscodeDevtoolsExtension,
  createVscodeDevtoolsWebviewHtml,
  decodeMobxstateLayoutComment,
  vscodeDevtoolsCommandIds,
  type SourceTextEdit,
  type VscodeDevtoolsPanelPayload,
} from "../index";

const source = `import { createMachine } from "@orderofchaos/mobxstate";

export const machine = createMachine({
  id: "nativeAdapter",
  initial: "idle",
  states: {
    idle: {
      on: {
        START: { target: "loading" },
        FAIL: { target: "missing" }
      }
    },
    loading: {},
    ready: { type: "final" }
  }
});
`;

class FakePosition {
  public constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

class FakeRange {
  public readonly start: FakePosition;

  public readonly end: FakePosition;

  public constructor(start: unknown, end: unknown) {
    this.start = start as FakePosition;
    this.end = end as FakePosition;
  }
}

class FakeDiagnostic {
  public source = "";

  public code: string | undefined;

  public readonly range: FakeRange;

  public constructor(
    range: unknown,
    public readonly message: string,
    public readonly severity: unknown,
  ) {
    this.range = range as FakeRange;
  }
}

class FakeCodeLens {
  public constructor(
    range: unknown,
    public readonly command: {
      readonly title: string;
      readonly command: string;
    } | undefined,
  ) {
    this.range = range as FakeRange;
  }

  public readonly range: FakeRange;
}

class FakeWorkspaceEdit {
  public readonly replacements: Array<{
    readonly uri: FakeUri;
    readonly range: FakeRange;
    readonly text: string;
  }> = [];

  public replace(uri: unknown, range: unknown, text: string): void {
    this.replacements.push({
      uri: uri as FakeUri,
      range: range as FakeRange,
      text,
    });
  }
}

class FakeUri {
  private constructor(private readonly value: string) {}

  public static parse(value: string): FakeUri {
    return new FakeUri(value);
  }

  public toString(): string {
    return this.value;
  }
}

class FakeTextDocument {
  public constructor(
    public readonly uri: FakeUri,
    private readonly text: string,
    public readonly version = 1,
    public readonly languageId = "typescript",
  ) {}

  public getText(): string {
    return this.text;
  }

  public positionAt(offset: number): FakePosition {
    const lines = this.text.slice(0, offset).split("\n");
    return new FakePosition(lines.length - 1, lines[lines.length - 1]?.length ?? 0);
  }
}

const createFakeVscode = () => {
  const document = new FakeTextDocument(
    FakeUri.parse("file:///workspace/machine.ts"),
    source,
  );
  const commands = new Map<string, () => Promise<unknown>>();
  const diagnostics = new Map<string, readonly FakeDiagnostic[]>();
  const codeLensProviders: Array<{
    readonly selector: unknown;
    readonly provider: {
      provideCodeLenses(document: FakeTextDocument): readonly FakeCodeLens[];
    };
  }> = [];
  const panels: Array<{
    readonly viewType: string;
    readonly title: string;
    readonly html: string;
    readonly messages: unknown[];
    receive(message: unknown): Promise<void>;
  }> = [];
  const writes: Array<{ readonly uri: string; readonly text: string }> = [];
  const appliedEdits: FakeWorkspaceEdit[] = [];
  const subscriptions: Array<{ dispose(): void }> = [];

  const api = {
    commands: {
      registerCommand(commandId: string, handler: () => Promise<unknown>) {
        commands.set(commandId, handler);
        return {
          dispose() {
            commands.delete(commandId);
          },
        };
      },
    },
    languages: {
      createDiagnosticCollection() {
        return {
          set(uri: FakeUri, nextDiagnostics: readonly FakeDiagnostic[]) {
            diagnostics.set(uri.toString(), nextDiagnostics);
          },
          dispose() {
            diagnostics.clear();
          },
        };
      },
      registerCodeLensProvider(
        selector: unknown,
        provider: {
          provideCodeLenses(document: FakeTextDocument): readonly FakeCodeLens[];
        },
      ) {
        const entry = { selector, provider };
        codeLensProviders.push(entry);
        return {
          dispose() {
            const index = codeLensProviders.indexOf(entry);
            if (index >= 0) {
              codeLensProviders.splice(index, 1);
            }
          },
        };
      },
    },
    window: {
      activeTextEditor: {
        document,
      },
      createWebviewPanel(viewType: string, title: string) {
        const messages: unknown[] = [];
        const listeners: Array<(message: unknown) => void | Promise<void>> = [];
        const panel = {
          viewType,
          title,
          html: "",
          messages,
          async receive(message: unknown) {
            await Promise.all(listeners.map((listener) => listener(message)));
          },
        };
        panels.push(panel);
        return {
          webview: {
            set html(value: string) {
              panel.html = value;
            },
            get html() {
              return panel.html;
            },
            postMessage(message: unknown) {
              messages.push(message);
              return Promise.resolve(true);
            },
            onDidReceiveMessage(listener: (message: unknown) => void) {
              listeners.push(listener);
              return {
                dispose() {
                  const index = listeners.indexOf(listener);
                  if (index >= 0) {
                    listeners.splice(index, 1);
                  }
                },
              };
            },
          },
          dispose() {
            return undefined;
          },
        };
      },
      showInformationMessage() {
        return undefined;
      },
      showErrorMessage() {
        return undefined;
      },
    },
    workspace: {
      fs: {
        writeFile(uri: FakeUri, bytes: Uint8Array) {
          writes.push({
            uri: uri.toString(),
            text: new TextDecoder().decode(bytes),
          });
        },
      },
      openTextDocument(uri: FakeUri) {
        expect(uri.toString()).toBe(document.uri.toString());
        return Promise.resolve(document);
      },
      applyEdit(edit: FakeWorkspaceEdit) {
        appliedEdits.push(edit);
        return Promise.resolve(true);
      },
    },
    Uri: FakeUri,
    Position: FakePosition,
    Range: FakeRange,
    Diagnostic: FakeDiagnostic,
    CodeLens: FakeCodeLens,
    DiagnosticSeverity: {
      Error: "error",
      Warning: "warning",
      Information: "info",
    },
    WorkspaceEdit: FakeWorkspaceEdit,
    ViewColumn: {
      Beside: "beside",
    },
  };

  return {
    api,
    document,
    commands,
    diagnostics,
    codeLensProviders,
    panels,
    writes,
    appliedEdits,
    context: { subscriptions },
  };
};

describe("VS Code native devtools adapter", () => {
  it("registers native commands and disposes them through extension context", () => {
    const harness = createFakeVscode();
    const extension = createVscodeDevtoolsExtension(
      harness.api,
      harness.context,
    );

    expect(Array.from(harness.commands.keys()).sort()).toEqual(
      Object.values(vscodeDevtoolsCommandIds).sort(),
    );
    expect(harness.context.subscriptions).toContain(extension);

    extension.dispose();
    expect(harness.commands.size).toBe(0);
  });

  it("registers CodeLens links for opening the visual editor from createMachine", () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    expect(harness.codeLensProviders).toHaveLength(1);
    const codeLenses = harness.codeLensProviders[0]?.provider.provideCodeLenses(
      harness.document,
    );

    expect(codeLenses).toHaveLength(1);
    expect(codeLenses?.[0]?.command).toEqual({
      title: "Open Visual Editor",
      command: vscodeDevtoolsCommandIds.openVisualEditor,
    });
    expect(codeLenses?.[0]?.range.start.line).toBe(2);
  });

  it("maps diagnostics into a native diagnostic collection", async () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    await harness.commands.get(vscodeDevtoolsCommandIds.checkCurrentFile)?.();
    const diagnostics = harness.diagnostics.get(harness.document.uri.toString());

    expect(diagnostics?.map((diagnostic) => diagnostic.code)).toContain(
      "unknown_transition_target",
    );
    expect(diagnostics?.[0]?.source).toBe("mobxstate");
    expect(diagnostics?.[0]?.range.start.line).toBeGreaterThan(0);
  });

  it("opens a webview panel and posts the selected machine payload", async () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    await harness.commands.get(vscodeDevtoolsCommandIds.openViewer)?.();
    const [panel] = harness.panels;

    expect(panel?.viewType).toBe("mobxstate.viewer");
    expect(panel?.title).toBe("MobXstate Viewer");
    expect(panel?.html).toContain("nativeAdapter");
    expect((panel?.messages[0] as VscodeDevtoolsPanelPayload | undefined)?.type).toBe(
      "LOAD_MACHINE",
    );
    expect(
      (panel?.messages[0] as VscodeDevtoolsPanelPayload | undefined)?.machine.id,
    ).toBe("nativeAdapter");
  });

  it("writes typegen through native workspace fs", async () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    await harness.commands.get(vscodeDevtoolsCommandIds.generateTypegen)?.();

    expect(harness.writes).toHaveLength(1);
    expect(harness.writes[0]?.uri).toBe("file:///workspace/machine.typegen.ts");
    expect(harness.writes[0]?.text).toContain('"@@mobxstate/typegen": true;');
  });

  it("applies accepted edits through WorkspaceEdit", async () => {
    const harness = createFakeVscode();
    const extension = createVscodeDevtoolsExtension(
      harness.api,
      harness.context,
    );
    await harness.commands.get(vscodeDevtoolsCommandIds.openViewer)?.();

    const start = source.indexOf('target: "loading"');
    const edit: SourceTextEdit = {
      range: {
        start,
        end: start + 'target: "loading"'.length,
      },
      text: 'target: "ready"',
    };
    const result = await extension.shell.applyAcceptedTextEdits(
      harness.document.uri.toString(),
      2,
      [edit],
    );

    expect(harness.appliedEdits).toHaveLength(1);
    expect(harness.appliedEdits[0]?.replacements[0]?.text).toBe(
      'target: "ready"',
    );
    expect(result.kind).toBe("displayed_machine_updated");
  });

  it("creates deterministic webview HTML seeded with the first payload", () => {
    const harness = createFakeVscode();
    const extension = createVscodeDevtoolsExtension(
      harness.api,
      harness.context,
    );

    expect(createVscodeDevtoolsWebviewHtml).toBeTypeOf("function");
    return harness.commands
      .get(vscodeDevtoolsCommandIds.openVisualEditor)?.()
      .then(() => {
        const payload = harness.panels[0]?.messages[0];
        expect(payload).toBeDefined();
        const html = createVscodeDevtoolsWebviewHtml(
          payload as VscodeDevtoolsPanelPayload,
        );
        expect(html).toContain("MobXstate Devtools");
        expect(html).toContain("nativeAdapter");
        expect(html).toContain('data-mobxstate-devtools-ui="vscode-webview"');
        expect(html).toContain('data-panel-mode="visualEditor"');
        expect(html).toContain('data-ui-mode="editor"');
        expect(html).toContain(">Simulation</button>");
        expect(html).not.toContain(">Viewer</button>");
        expect(html).not.toContain('data-testid="state-list"');
        expect(html).not.toContain('data-testid="transition-list"');
        expect(html).not.toContain('data-testid="diagnostic-list"');
        expect(html).not.toContain('data-testid="export-panel"');
        expect(html).toContain('data-testid="state-graph"');
        expect(html).toContain('id="mobxstate-webview-root"');
        expect(html).toContain("mobxstate-visual-editor.js");
        expect(html).toContain('data-testid="editor-toolbar"');
        expect(html).toContain('data-testid="state-inspector-form"');
        expect(html).toContain('data-testid="transition-inspector-form"');
        expect(html).toContain('data-editor-command="addState"');
        expect(html).toContain('data-editor-command="addTransition"');
        expect(html).toContain('data-editor-command="undo"');
        expect(html).toContain('data-editor-command="redo"');
        expect(html).not.toContain("<script>{");
        extension.dispose();
      });
  });

  it("routes visual editor draft commands through the native webview bridge", async () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    await harness.commands.get(vscodeDevtoolsCommandIds.openVisualEditor)?.();
    const [panel] = harness.panels;
    expect(panel).toBeDefined();

    panel?.receive({
      type: "DRAFT_COMMAND",
      command: "addState",
      params: {
        parentPath: [],
        key: "drafted",
      },
    });

    const lastMessage = panel?.messages[panel.messages.length - 1] as
      | { readonly type?: string; readonly graph?: { readonly nodes: readonly { readonly id: string }[] } }
      | undefined;

    expect(lastMessage?.type).toBe("DRAFT_UPDATED");
    expect(lastMessage?.graph?.nodes.map((node) => node.id)).toContain(
      "nativeAdapter.drafted",
    );
  });

  it("persists visual editor node positions as layout metadata", async () => {
    const harness = createFakeVscode();
    createVscodeDevtoolsExtension(harness.api, harness.context);

    await harness.commands.get(vscodeDevtoolsCommandIds.openVisualEditor)?.();
    const [panel] = harness.panels;
    expect(panel).toBeDefined();

    await panel?.receive({
      type: "LAYOUT_UPDATED",
      positions: {
        "nativeAdapter.idle": { x: 122.8, y: 56.2 },
        "nativeAdapter.loading": { x: 420, y: 160 },
      },
      labelPositions: {
        "nativeAdapter.idle:on:START:0": { x: 260.4, y: 62.6 },
      },
    });

    expect(harness.appliedEdits).toHaveLength(1);
    const replacement = harness.appliedEdits[0]?.replacements[0]?.text;
    const metadata = decodeMobxstateLayoutComment(replacement ?? "");
    expect(replacement).toContain("@mobxstate");
    expect(metadata?.positions["nativeAdapter.idle"]).toEqual({ x: 123, y: 56 });
    expect(metadata?.labelPositions?.["nativeAdapter.idle:on:START:0"]).toEqual({
      x: 260,
      y: 63,
    });
    expect(panel?.messages[panel.messages.length - 1]).toEqual({
      type: "LAYOUT_SAVED",
    });
  });
});
