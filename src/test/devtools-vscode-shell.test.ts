import { describe, expect, it } from "vitest";

import {
  createVscodeDevtoolsShell,
  getVscodeDevtoolsTypegenUri,
  vscodeDevtoolsCommandIds,
  type SourceDocumentUpdate,
  type SourceTextEdit,
  type VscodeDevtoolsCommandId,
  type VscodeDevtoolsCommandResult,
  type VscodeDevtoolsDiagnostic,
  type VscodeDevtoolsDocument,
  type VscodeDevtoolsHost,
  type VscodeDevtoolsPanelPayload,
} from "../index";

const source = `import { createMachine } from "@orderofchaos/mobxstate";

const unrelated = 1;

export const machine = createMachine({
  id: "vscodeMachine",
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

const document: VscodeDevtoolsDocument = {
  uri: "file:///workspace/machine.ts",
  text: source,
  version: 1,
  languageId: "typescript",
};

interface HostHarness {
  readonly host: VscodeDevtoolsHost;
  readonly commands: Map<
    VscodeDevtoolsCommandId,
    () => Promise<VscodeDevtoolsCommandResult>
  >;
  readonly diagnostics: Map<string, readonly VscodeDevtoolsDiagnostic[]>;
  readonly panels: VscodeDevtoolsPanelPayload[];
  readonly writes: Array<{ readonly uri: string; readonly text: string }>;
  readonly edits: Array<{
    readonly uri: string;
    readonly edits: readonly SourceTextEdit[];
  }>;
  activeDocument: VscodeDevtoolsDocument | undefined;
}

const createHostHarness = (
  activeDocument: VscodeDevtoolsDocument | undefined = document,
): HostHarness => {
  const commands = new Map<
    VscodeDevtoolsCommandId,
    () => Promise<VscodeDevtoolsCommandResult>
  >();
  const diagnostics = new Map<string, readonly VscodeDevtoolsDiagnostic[]>();
  const panels: VscodeDevtoolsPanelPayload[] = [];
  const writes: Array<{ readonly uri: string; readonly text: string }> = [];
  const edits: Array<{
    readonly uri: string;
    readonly edits: readonly SourceTextEdit[];
  }> = [];
  const harness: HostHarness = {
    commands,
    diagnostics,
    panels,
    writes,
    edits,
    activeDocument,
    host: {
      getActiveDocument() {
        return harness.activeDocument;
      },
      registerCommand(commandId, handler) {
        commands.set(commandId, handler);
        return {
          dispose() {
            commands.delete(commandId);
          },
        };
      },
      setDiagnostics(uri, nextDiagnostics) {
        diagnostics.set(uri, nextDiagnostics);
      },
      showPanel(payload) {
        panels.push(payload);
      },
      writeFile(uri, text) {
        writes.push({ uri, text });
      },
      applyTextEdits(uri, nextEdits) {
        edits.push({ uri, edits: nextEdits });
      },
    },
  };

  return harness;
};

const runCommand = async (
  harness: HostHarness,
  commandId: VscodeDevtoolsCommandId,
): Promise<VscodeDevtoolsCommandResult> => {
  const command = harness.commands.get(commandId);
  if (!command) {
    throw new Error(`Command ${commandId} was not registered.`);
  }

  return command();
};

describe("VS Code devtools shell", () => {
  it("registers and disposes VS Code command handlers", () => {
    const harness = createHostHarness();
    const shell = createVscodeDevtoolsShell(harness.host);

    expect(Array.from(harness.commands.keys()).sort()).toEqual(
      Object.values(vscodeDevtoolsCommandIds).sort(),
    );

    shell.dispose();
    expect(harness.commands.size).toBe(0);
  });

  it("checks the active document and maps diagnostics to source ranges", async () => {
    const harness = createHostHarness();
    createVscodeDevtoolsShell(harness.host);

    const result = await runCommand(
      harness,
      vscodeDevtoolsCommandIds.checkCurrentFile,
    );

    expect(result.kind).toBe("checked");
    expect(harness.diagnostics.get(document.uri)?.map((item) => item.code)).toContain(
      "unknown_transition_target",
    );
    expect(
      harness.diagnostics.get(document.uri)?.find((item) => {
        return item.code === "unknown_transition_target";
      })?.range?.start,
    ).toBeGreaterThan(0);
  });

  it("opens viewer and visual editor panels through worker-provided machine data", async () => {
    const harness = createHostHarness();
    createVscodeDevtoolsShell(harness.host);

    const viewerResult = await runCommand(
      harness,
      vscodeDevtoolsCommandIds.openViewer,
    );
    const editorResult = await runCommand(
      harness,
      vscodeDevtoolsCommandIds.openVisualEditor,
    );

    expect(viewerResult.kind).toBe("panel_opened");
    expect(editorResult.kind).toBe("panel_opened");
    expect(harness.panels.map((panel) => panel.mode)).toEqual([
      "viewer",
      "visualEditor",
    ]);
    expect(harness.panels[0]?.machine.id).toBe("vscodeMachine");
    expect(harness.panels[1]?.diagnostics.map((item) => item.code)).toContain(
      "unknown_transition_target",
    );
  });

  it("generates typegen through the shared worker protocol and native file write", async () => {
    const harness = createHostHarness();
    createVscodeDevtoolsShell(harness.host);

    const result = await runCommand(
      harness,
      vscodeDevtoolsCommandIds.generateTypegen,
    );

    expect(result.kind).toBe("typegen_written");
    expect(harness.writes).toHaveLength(1);
    expect(harness.writes[0]?.uri).toBe("file:///workspace/machine.typegen.ts");
    expect(harness.writes[0]?.text).toContain('"@@mobxstate/typegen": true;');
    expect(getVscodeDevtoolsTypegenUri(document.uri)).toBe(
      "file:///workspace/machine.typegen.ts",
    );
  });

  it("exports selected machine config without writing source files", async () => {
    const harness = createHostHarness();
    createVscodeDevtoolsShell(harness.host);

    const result = await runCommand(
      harness,
      vscodeDevtoolsCommandIds.exportMachineConfig,
    );

    expect(result.kind).toBe("exported");
    expect(result.text).toContain("createMachine({");
    expect(result.text).toContain('id: "vscodeMachine"');
    expect(harness.writes).toEqual([]);
  });

  it("applies accepted edits only through the host native edit boundary", async () => {
    const harness = createHostHarness();
    const shell = createVscodeDevtoolsShell(harness.host);
    await shell.openViewer();

    const start = source.indexOf('target: "loading"');
    const edit: SourceTextEdit = {
      range: {
        start,
        end: start + 'target: "loading"'.length,
      },
      text: 'target: "ready"',
    };
    const update = await shell.applyAcceptedTextEdits(
      document.uri,
      document.version + 1,
      [edit],
    );

    expect(harness.edits).toEqual([{ uri: document.uri, edits: [edit] }]);
    expect((update as SourceDocumentUpdate).kind).toBe("displayed_machine_updated");
    expect(
      (update as SourceDocumentUpdate).displayedMachine?.graph.edges.find((edge) => {
        return edge.trigger.kind === "on" && edge.trigger.key === "START";
      })?.target,
    ).toBe("ready");
  });
});
