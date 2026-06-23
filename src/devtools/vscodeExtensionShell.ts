import type { DevtoolsDiagnostic } from "./machineAnalyzer";
import type {
  SourceDiagnostic,
  SourceDocumentSnapshot,
  SourceDocumentUpdate,
  SourceMachine,
  SourceRange,
  SourceTextEdit,
} from "./sourceReader";
import type { TypegenResult } from "./typeCompiler";
import {
  createDevtoolsWorkerProtocol,
  devtoolsWorkerProtocolVersion,
  type DevtoolsWorkerMethod,
  type DevtoolsWorkerProtocol,
  type DevtoolsWorkerRequest,
  type DevtoolsWorkerResponse,
} from "./workerProtocol";

export const vscodeDevtoolsCommandIds = {
  openViewer: "mobxstate.openViewer",
  openVisualEditor: "mobxstate.openVisualEditor",
  generateTypegen: "mobxstate.generateTypegen",
  checkCurrentFile: "mobxstate.checkCurrentFile",
  exportMachineConfig: "mobxstate.exportMachineConfig",
} as const;

export type VscodeDevtoolsCommandId =
  (typeof vscodeDevtoolsCommandIds)[keyof typeof vscodeDevtoolsCommandIds];

export type VscodeDevtoolsPanelMode = "viewer" | "visualEditor";

export interface VscodeDevtoolsDocument {
  readonly uri: string;
  readonly text: string;
  readonly version: number;
  readonly languageId?: string;
}

export interface VscodeDevtoolsDisposable {
  dispose(): void;
}

export interface VscodeDevtoolsDiagnostic {
  readonly source: "mobxstate";
  readonly code?: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly range?: SourceRange;
}

export interface VscodeDevtoolsPanelPayload {
  readonly type: "LOAD_MACHINE";
  readonly mode: VscodeDevtoolsPanelMode;
  readonly uri: string;
  readonly documentVersion: number;
  readonly machine: SourceMachine;
  readonly diagnostics: readonly VscodeDevtoolsDiagnostic[];
}

export interface VscodeDevtoolsHost {
  getActiveDocument(): VscodeDevtoolsDocument | undefined;
  registerCommand(
    commandId: VscodeDevtoolsCommandId,
    handler: () => Promise<VscodeDevtoolsCommandResult>,
  ): VscodeDevtoolsDisposable;
  setDiagnostics(
    uri: string,
    diagnostics: readonly VscodeDevtoolsDiagnostic[],
  ): void;
  showPanel(payload: VscodeDevtoolsPanelPayload): void | Promise<void>;
  writeFile(uri: string, text: string): void | Promise<void>;
  applyTextEdits(
    uri: string,
    edits: readonly SourceTextEdit[],
  ): void | Promise<void>;
  showInformationMessage?(message: string): void | Promise<void>;
  showErrorMessage?(message: string): void | Promise<void>;
}

export type VscodeDevtoolsCommandResultKind =
  | "checked"
  | "panel_opened"
  | "typegen_written"
  | "exported"
  | "edit_applied"
  | "no_active_document"
  | "worker_error";

export interface VscodeDevtoolsCommandResult {
  readonly kind: VscodeDevtoolsCommandResultKind;
  readonly uri?: string;
  readonly machineId?: string;
  readonly panelMode?: VscodeDevtoolsPanelMode;
  readonly typegenUri?: string;
  readonly text?: string;
  readonly diagnostics?: readonly VscodeDevtoolsDiagnostic[];
  readonly update?: SourceDocumentUpdate;
  readonly error?: string;
}

export interface VscodeDevtoolsShell {
  dispose(): void;
  checkCurrentFile(): Promise<VscodeDevtoolsCommandResult>;
  openViewer(): Promise<VscodeDevtoolsCommandResult>;
  openVisualEditor(): Promise<VscodeDevtoolsCommandResult>;
  generateTypegen(): Promise<VscodeDevtoolsCommandResult>;
  exportMachineConfig(): Promise<VscodeDevtoolsCommandResult>;
  applyAcceptedTextEdits(
    uri: string,
    version: number,
    edits: readonly SourceTextEdit[],
  ): Promise<SourceDocumentUpdate | VscodeDevtoolsCommandResult>;
}

interface ActiveAnalysis {
  readonly document: VscodeDevtoolsDocument;
  readonly snapshot: SourceDocumentSnapshot;
  readonly machine: SourceMachine | undefined;
  readonly diagnostics: readonly VscodeDevtoolsDiagnostic[];
}

const sourceName = "mobxstate";

const pathEquals = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  return left.length === right.length && left.every((part, index) => part === right[index]);
};

const isSourceDocumentUpdate = (
  value: SourceDocumentSnapshot | SourceDocumentUpdate,
): value is SourceDocumentUpdate => {
  return "snapshot" in value && "kind" in value;
};

const unwrapWorkerResponse = <Result>(
  response: DevtoolsWorkerResponse,
): Result | VscodeDevtoolsCommandResult => {
  if (!response.ok) {
    return {
      kind: "worker_error",
      error: response.error.message,
    };
  }

  return response.result as Result;
};

const isCommandResult = (
  value: unknown,
): value is VscodeDevtoolsCommandResult => {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }

  return [
    "checked",
    "panel_opened",
    "typegen_written",
    "exported",
    "edit_applied",
    "no_active_document",
    "worker_error",
  ].includes(String(value.kind));
};

const createRequestFactory = (): ((
  method: DevtoolsWorkerMethod,
  params?: unknown,
) => DevtoolsWorkerRequest) => {
  let nextId = 0;

  return (method, params) => {
    nextId += 1;
    return {
      protocol: devtoolsWorkerProtocolVersion,
      id: `vscode-${nextId}`,
      method,
      params,
    };
  };
};

const mapSourceDiagnostic = (
  diagnostic: SourceDiagnostic,
): VscodeDevtoolsDiagnostic => {
  return {
    source: sourceName,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.range === undefined ? {} : { range: diagnostic.range }),
  };
};

const findDiagnosticRange = (
  machine: SourceMachine,
  diagnostic: DevtoolsDiagnostic,
): SourceRange | undefined => {
  if (diagnostic.path !== undefined) {
    return machine.ranges.states.find((stateRange) =>
      pathEquals(stateRange.path, diagnostic.path ?? []),
    )?.range;
  }

  return undefined;
};

const mapMachineDiagnostic = (
  machine: SourceMachine,
  diagnostic: DevtoolsDiagnostic,
): VscodeDevtoolsDiagnostic => {
  const range = findDiagnosticRange(machine, diagnostic);
  return {
    source: sourceName,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(range === undefined ? {} : { range }),
  };
};

const collectDiagnostics = (
  snapshot: SourceDocumentSnapshot,
): readonly VscodeDevtoolsDiagnostic[] => {
  return [
    ...snapshot.diagnostics.map(mapSourceDiagnostic),
    ...snapshot.machines.flatMap((machine) => {
      return machine.graph.diagnostics.map((diagnostic) =>
        mapMachineDiagnostic(machine, diagnostic),
      );
    }),
  ];
};

export const getVscodeDevtoolsTypegenUri = (uri: string): string => {
  const match = /^(.*)\.(?:[cm]?tsx?)$/.exec(uri);
  if (!match) {
    return `${uri}.typegen.ts`;
  }

  return `${match[1]}.typegen.ts`;
};

export const createVscodeDevtoolsShell = (
  host: VscodeDevtoolsHost,
  protocol: DevtoolsWorkerProtocol = createDevtoolsWorkerProtocol(),
): VscodeDevtoolsShell => {
  const makeRequest = createRequestFactory();

  const getActiveDocument = async (): Promise<
    VscodeDevtoolsDocument | VscodeDevtoolsCommandResult
  > => {
    const document = host.getActiveDocument();
    if (!document) {
      await host.showErrorMessage?.("No active MobXstate document.");
      return {
        kind: "no_active_document",
        error: "No active document.",
      };
    }

    return document;
  };

  const analyzeActiveDocument = async (): Promise<
    ActiveAnalysis | VscodeDevtoolsCommandResult
  > => {
    const document = await getActiveDocument();
    if (isCommandResult(document)) {
      return document;
    }

    const response = protocol.handleRequest(
      makeRequest("analyzeFile", {
        uri: document.uri,
        text: document.text,
        version: document.version,
        displayedMachineIndex: 0,
      }),
    );
    const result = unwrapWorkerResponse<SourceDocumentSnapshot | SourceDocumentUpdate>(
      response,
    );

    if (isCommandResult(result)) {
      await host.showErrorMessage?.(result.error ?? "MobXstate worker failed.");
      return result;
    }

    const snapshot = isSourceDocumentUpdate(result) ? result.snapshot : result;
    const machine = isSourceDocumentUpdate(result)
      ? result.displayedMachine ?? snapshot.machines[0]
      : snapshot.machines[0];
    const diagnostics = collectDiagnostics(snapshot);
    host.setDiagnostics(document.uri, diagnostics);

    return {
      document,
      snapshot,
      machine,
      diagnostics,
    };
  };

  const openPanel = async (
    mode: VscodeDevtoolsPanelMode,
  ): Promise<VscodeDevtoolsCommandResult> => {
    const analysis = await analyzeActiveDocument();
    if (isCommandResult(analysis)) {
      return analysis;
    }

    if (!analysis.machine) {
      return {
        kind: "worker_error",
        uri: analysis.document.uri,
        error: "No createMachine call was found in the active document.",
      };
    }

    await host.showPanel({
      type: "LOAD_MACHINE",
      mode,
      uri: analysis.document.uri,
      documentVersion: analysis.document.version,
      machine: analysis.machine,
      diagnostics: analysis.diagnostics,
    });

    return {
      kind: "panel_opened",
      uri: analysis.document.uri,
      panelMode: mode,
      machineId: analysis.machine.id,
      diagnostics: analysis.diagnostics,
    };
  };

  const checkCurrentFile = async (): Promise<VscodeDevtoolsCommandResult> => {
    const analysis = await analyzeActiveDocument();
    if (isCommandResult(analysis)) {
      return analysis;
    }

    return {
      kind: "checked",
      uri: analysis.document.uri,
      machineId: analysis.machine?.id,
      diagnostics: analysis.diagnostics,
    };
  };

  const openViewer = async (): Promise<VscodeDevtoolsCommandResult> => {
    return openPanel("viewer");
  };

  const openVisualEditor = async (): Promise<VscodeDevtoolsCommandResult> => {
    return openPanel("visualEditor");
  };

  const generateTypegen = async (): Promise<VscodeDevtoolsCommandResult> => {
    const analysis = await analyzeActiveDocument();
    if (isCommandResult(analysis)) {
      return analysis;
    }

    const result = unwrapWorkerResponse<TypegenResult>(
      protocol.handleRequest(
        makeRequest("compileTypegen", {
          uri: analysis.document.uri,
          machineIndex: analysis.machine?.machineIndex ?? 0,
        }),
      ),
    );
    if (isCommandResult(result)) {
      return result;
    }

    const typegenUri = getVscodeDevtoolsTypegenUri(analysis.document.uri);
    await host.writeFile(typegenUri, result.moduleText);
    await host.showInformationMessage?.("MobXstate typegen updated.");

    return {
      kind: "typegen_written",
      uri: analysis.document.uri,
      typegenUri,
      machineId: analysis.machine?.id,
      diagnostics: analysis.diagnostics,
    };
  };

  const exportMachineConfig = async (): Promise<VscodeDevtoolsCommandResult> => {
    const analysis = await analyzeActiveDocument();
    if (isCommandResult(analysis)) {
      return analysis;
    }

    const result = unwrapWorkerResponse<{ readonly text: string }>(
      protocol.handleRequest(
        makeRequest("formatExport", {
          uri: analysis.document.uri,
          machineIndex: analysis.machine?.machineIndex ?? 0,
        }),
      ),
    );
    if (isCommandResult(result)) {
      return result;
    }

    return {
      kind: "exported",
      uri: analysis.document.uri,
      machineId: analysis.machine?.id,
      text: result.text,
      diagnostics: analysis.diagnostics,
    };
  };

  const applyAcceptedTextEdits = async (
    uri: string,
    version: number,
    edits: readonly SourceTextEdit[],
  ): Promise<SourceDocumentUpdate | VscodeDevtoolsCommandResult> => {
    await host.applyTextEdits(uri, edits);
    const result = unwrapWorkerResponse<SourceDocumentUpdate>(
      protocol.handleRequest(
        makeRequest("applyAcceptedTextEdits", {
          uri,
          version,
          edits,
        }),
      ),
    );

    if (isCommandResult(result)) {
      return result;
    }

    host.setDiagnostics(uri, collectDiagnostics(result.snapshot));
    return result;
  };

  const disposables = [
    host.registerCommand(vscodeDevtoolsCommandIds.openViewer, openViewer),
    host.registerCommand(vscodeDevtoolsCommandIds.openVisualEditor, openVisualEditor),
    host.registerCommand(vscodeDevtoolsCommandIds.generateTypegen, generateTypegen),
    host.registerCommand(vscodeDevtoolsCommandIds.checkCurrentFile, checkCurrentFile),
    host.registerCommand(
      vscodeDevtoolsCommandIds.exportMachineConfig,
      exportMachineConfig,
    ),
  ];

  return {
    dispose() {
      disposables.forEach((disposable) => disposable.dispose());
    },
    checkCurrentFile,
    openViewer,
    openVisualEditor,
    generateTypegen,
    exportMachineConfig,
    applyAcceptedTextEdits,
  };
};
