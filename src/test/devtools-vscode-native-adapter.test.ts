import { describe, expect, it } from "vitest";

import {
  createVscodeDevtoolsExtension,
  createVscodeDevtoolsWebviewHtml,
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
  const panels: Array<{
    readonly viewType: string;
    readonly title: string;
    readonly html: string;
    readonly messages: VscodeDevtoolsPanelPayload[];
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
    },
    window: {
      activeTextEditor: {
        document,
      },
      createWebviewPanel(viewType: string, title: string) {
        const messages: VscodeDevtoolsPanelPayload[] = [];
        const panel = {
          viewType,
          title,
          html: "",
          messages,
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
            postMessage(message: VscodeDevtoolsPanelPayload) {
              messages.push(message);
              return Promise.resolve(true);
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
    expect(panel?.messages[0]?.type).toBe("LOAD_MACHINE");
    expect(panel?.messages[0]?.machine.id).toBe("nativeAdapter");
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
        const html = createVscodeDevtoolsWebviewHtml(payload!);
        expect(html).toContain("MobXstate Devtools");
        expect(html).toContain("nativeAdapter");
        expect(html).toContain('data-mobxstate-devtools-ui="vscode-webview"');
        expect(html).toContain('data-panel-mode="visualEditor"');
        expect(html).toContain('data-testid="state-list"');
        expect(html).toContain('data-testid="transition-list"');
        expect(html).toContain('data-testid="diagnostic-list"');
        expect(html).toContain("stateCount");
        expect(html).toContain("transitionCount");
        expect(html).not.toContain("<script>{");
        extension.dispose();
      });
  });
});
