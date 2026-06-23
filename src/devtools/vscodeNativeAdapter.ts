import {
  findCreateMachineCalls,
  type SourceRange,
  type SourceTextEdit,
} from "./sourceReader";
import {
  createMobxstateLayoutTextEdit,
  type MobxstateLayoutPosition,
} from "./layoutMetadata";
import {
  createVisualEditorSession,
  type VisualEditorDraftCommandMessage,
} from "./visualEditorSession";
import {
  createVscodeDevtoolsShell,
  type VscodeDevtoolsDiagnostic,
  type VscodeDevtoolsDisposable,
  type VscodeDevtoolsHost,
  type VscodeDevtoolsShell,
  vscodeDevtoolsCommandIds,
} from "./vscodeExtensionShell";
import {
  createVscodeDevtoolsWebviewHtml,
  type VscodeDevtoolsWebviewAssetOptions,
  getVscodeDevtoolsPanelTitle,
  getVscodeDevtoolsPanelViewType,
} from "./vscodeWebviewUi";

export interface VscodeNativeUri {
  toString(): string;
}

export type VscodeNativePosition = unknown;

export type VscodeNativeRange = unknown;

export interface VscodeNativeDiagnostic {
  source?: string;
  code?: string;
}

export interface VscodeNativeCommand {
  readonly title: string;
  readonly command: string;
}

export interface VscodeNativeCodeLens {
  readonly range: VscodeNativeRange;
  readonly command?: VscodeNativeCommand;
}

export interface VscodeNativeCodeLensProvider {
  provideCodeLenses(
    document: VscodeNativeTextDocument,
  ): readonly VscodeNativeCodeLens[];
}

export interface VscodeNativeDiagnosticCollection extends VscodeDevtoolsDisposable {
  set(
    uri: VscodeNativeUri,
    diagnostics: readonly VscodeNativeDiagnostic[],
  ): void;
}

export interface VscodeNativeTextDocument {
  readonly uri: VscodeNativeUri;
  readonly version: number;
  readonly languageId?: string;
  getText(): string;
  positionAt(offset: number): VscodeNativePosition;
}

export interface VscodeNativeTextEditor {
  readonly document: VscodeNativeTextDocument;
}

export interface VscodeNativeWebview {
  html: string;
  asWebviewUri?(uri: VscodeNativeUri): VscodeNativeUri;
  postMessage(message: unknown): boolean | Promise<boolean>;
  onDidReceiveMessage?(
    listener: (message: unknown) => void | Promise<void>,
  ): VscodeDevtoolsDisposable;
}

export interface VscodeNativeWebviewPanel extends VscodeDevtoolsDisposable {
  readonly webview: VscodeNativeWebview;
}

export interface VscodeNativeWorkspaceEdit {
  replace(
    uri: VscodeNativeUri,
    range: VscodeNativeRange,
    text: string,
  ): void;
}

export interface VscodeNativeExtensionContext {
  readonly subscriptions: VscodeDevtoolsDisposable[];
  readonly extensionUri?: VscodeNativeUri;
}

export interface VscodeNativeApi {
  readonly commands: {
    registerCommand(
      commandId: string,
      handler: () => Promise<unknown>,
    ): VscodeDevtoolsDisposable;
  };
  readonly languages: {
    createDiagnosticCollection(name: string): VscodeNativeDiagnosticCollection;
    registerCodeLensProvider?(
      selector: unknown,
      provider: VscodeNativeCodeLensProvider,
    ): VscodeDevtoolsDisposable;
  };
  readonly window: {
    readonly activeTextEditor?: VscodeNativeTextEditor;
    createWebviewPanel(
      viewType: string,
      title: string,
      showOptions: unknown,
      options: unknown,
    ): VscodeNativeWebviewPanel;
    showInformationMessage?(message: string): void | Promise<unknown>;
    showErrorMessage?(message: string): void | Promise<unknown>;
  };
  readonly workspace: {
    readonly fs: {
      writeFile(uri: VscodeNativeUri, content: Uint8Array): void | Promise<void>;
    };
    openTextDocument(
      uri: VscodeNativeUri,
    ): VscodeNativeTextDocument | Promise<VscodeNativeTextDocument>;
    applyEdit(edit: VscodeNativeWorkspaceEdit): boolean | Promise<boolean>;
  };
  readonly Uri: {
    parse(uri: string): VscodeNativeUri;
    joinPath?(base: VscodeNativeUri, ...pathSegments: string[]): VscodeNativeUri;
  };
  readonly Position: new (
    line: number,
    character: number,
  ) => VscodeNativePosition;
  readonly Range: new (
    start: VscodeNativePosition,
    end: VscodeNativePosition,
  ) => VscodeNativeRange;
  readonly Diagnostic: new (
    range: VscodeNativeRange,
    message: string,
    severity: unknown,
  ) => VscodeNativeDiagnostic;
  readonly CodeLens?: new (
    range: VscodeNativeRange,
    command?: VscodeNativeCommand,
  ) => VscodeNativeCodeLens;
  readonly DiagnosticSeverity: {
    readonly Error: unknown;
    readonly Warning: unknown;
    readonly Information: unknown;
  };
  readonly WorkspaceEdit: new () => VscodeNativeWorkspaceEdit;
  readonly ViewColumn: {
    readonly Beside: unknown;
  };
}

export interface VscodeNativeExtension extends VscodeDevtoolsDisposable {
  readonly shell: VscodeDevtoolsShell;
  readonly diagnostics: VscodeNativeDiagnosticCollection;
}

interface VisualEditorLayoutUpdatedMessage {
  readonly type: "LAYOUT_UPDATED";
  readonly positions: Readonly<Record<string, MobxstateLayoutPosition>>;
  readonly labelPositions?: Readonly<Record<string, MobxstateLayoutPosition>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readLayoutPositions = (
  value: unknown,
): Readonly<Record<string, MobxstateLayoutPosition>> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const positions: Record<string, MobxstateLayoutPosition> = {};

  Object.entries(value).forEach(([id, position]) => {
    if (!isRecord(position)) {
      return;
    }

    const x = position.x;
    const y = position.y;
    if (id.length > 0 && typeof x === "number" && typeof y === "number") {
      positions[id] = { x, y };
    }
  });

  return positions;
};

const isLayoutUpdatedMessage = (
  message: unknown,
): message is VisualEditorLayoutUpdatedMessage => {
  if (!isRecord(message) || message.type !== "LAYOUT_UPDATED") {
    return false;
  }

  return readLayoutPositions(message.positions) !== undefined;
};

const mapSeverity = (
  api: VscodeNativeApi,
  severity: VscodeDevtoolsDiagnostic["severity"],
): unknown => {
  if (severity === "error") {
    return api.DiagnosticSeverity.Error;
  }

  if (severity === "warning") {
    return api.DiagnosticSeverity.Warning;
  }

  return api.DiagnosticSeverity.Information;
};

const toNativeRange = (
  api: VscodeNativeApi,
  document: VscodeNativeTextDocument | undefined,
  range: SourceRange | undefined,
): VscodeNativeRange => {
  if (!range) {
    return new api.Range(new api.Position(0, 0), new api.Position(0, 0));
  }

  if (document) {
    return new api.Range(
      document.positionAt(range.start),
      document.positionAt(range.end),
    );
  }

  return new api.Range(
    new api.Position(0, range.start),
    new api.Position(0, range.end),
  );
};

const toNativeDiagnostic = (
  api: VscodeNativeApi,
  document: VscodeNativeTextDocument | undefined,
  diagnostic: VscodeDevtoolsDiagnostic,
): VscodeNativeDiagnostic => {
  const nativeDiagnostic = new api.Diagnostic(
    toNativeRange(api, document, diagnostic.range),
    diagnostic.message,
    mapSeverity(api, diagnostic.severity),
  );

  nativeDiagnostic.source = diagnostic.source;
  nativeDiagnostic.code = diagnostic.code;
  return nativeDiagnostic;
};

const getWebviewMediaUri = (
  api: VscodeNativeApi,
  context: VscodeNativeExtensionContext | undefined,
  panel: VscodeNativeWebviewPanel,
  filename: string,
): string | undefined => {
  if (!context?.extensionUri || !api.Uri.joinPath || !panel.webview.asWebviewUri) {
    return undefined;
  }

  return panel.webview
    .asWebviewUri(api.Uri.joinPath(context.extensionUri, "media", filename))
    .toString();
};

const getWebviewAssetOptions = (
  api: VscodeNativeApi,
  context: VscodeNativeExtensionContext | undefined,
  panel: VscodeNativeWebviewPanel,
): VscodeDevtoolsWebviewAssetOptions => {
  return {
    scriptUri: getWebviewMediaUri(
      api,
      context,
      panel,
      "mobxstate-visual-editor.js",
    ),
    styleUri: getWebviewMediaUri(
      api,
      context,
      panel,
      "mobxstate-visual-editor.css",
    ),
  };
};

const getWebviewPanelOptions = (
  api: VscodeNativeApi,
  context: VscodeNativeExtensionContext | undefined,
): Record<string, unknown> => {
  const mediaRoot =
    context?.extensionUri && api.Uri.joinPath
      ? api.Uri.joinPath(context.extensionUri, "media")
      : undefined;

  return {
    enableScripts: true,
    retainContextWhenHidden: true,
    ...(mediaRoot ? { localResourceRoots: [mediaRoot] } : {}),
  };
};

const codeLensDocumentSelector = [
  { language: "typescript", scheme: "file" },
  { language: "typescriptreact", scheme: "file" },
  { language: "javascript", scheme: "file" },
  { language: "javascriptreact", scheme: "file" },
];

const createOpenVisualEditorCodeLensProvider = (
  api: VscodeNativeApi,
  rememberDocument: (
    document: VscodeNativeTextDocument,
  ) => VscodeNativeTextDocument,
): VscodeNativeCodeLensProvider | undefined => {
  if (!api.CodeLens) {
    return undefined;
  }

  return {
    provideCodeLenses(document) {
      const rememberedDocument = rememberDocument(document);
      return findCreateMachineCalls(rememberedDocument.getText()).map((range) => {
        return new api.CodeLens!(
          toNativeRange(api, rememberedDocument, {
            start: range.start,
            end: range.start,
          }),
          {
            title: "Open Visual Editor",
            command: vscodeDevtoolsCommandIds.openVisualEditor,
          },
        );
      });
    },
  };
};

export const createVscodeDevtoolsExtension = (
  api: VscodeNativeApi,
  context?: VscodeNativeExtensionContext,
): VscodeNativeExtension => {
  const diagnosticsCollection =
    api.languages.createDiagnosticCollection("mobxstate");
  const documents = new Map<string, VscodeNativeTextDocument>();

  const parseUri = (uri: string): VscodeNativeUri => api.Uri.parse(uri);

  const rememberDocument = (
    document: VscodeNativeTextDocument,
  ): VscodeNativeTextDocument => {
    documents.set(document.uri.toString(), document);
    return document;
  };

  const host: VscodeDevtoolsHost = {
    getActiveDocument() {
      const document = api.window.activeTextEditor?.document;
      if (!document) {
        return undefined;
      }

      rememberDocument(document);
      return {
        uri: document.uri.toString(),
        text: document.getText(),
        version: document.version,
        languageId: document.languageId,
      };
    },
    registerCommand(commandId, handler) {
      return api.commands.registerCommand(commandId, handler);
    },
    setDiagnostics(uri, diagnostics) {
      const nativeUri = parseUri(uri);
      const document = documents.get(uri);
      diagnosticsCollection.set(
        nativeUri,
        diagnostics.map((diagnostic) =>
          toNativeDiagnostic(api, document, diagnostic),
        ),
      );
    },
    async showPanel(payload) {
      const panel = api.window.createWebviewPanel(
        getVscodeDevtoolsPanelViewType(payload.mode),
        getVscodeDevtoolsPanelTitle(payload.mode),
        api.ViewColumn.Beside,
        getWebviewPanelOptions(api, context),
      );

      context?.subscriptions.push(panel);
      panel.webview.html = createVscodeDevtoolsWebviewHtml(
        payload,
        getWebviewAssetOptions(api, context, panel),
      );
      await panel.webview.postMessage(payload);

      if (payload.mode === "visualEditor" && panel.webview.onDidReceiveMessage) {
        const session = createVisualEditorSession(payload.machine.config);
        const disposable = panel.webview.onDidReceiveMessage(async (message) => {
          if (isLayoutUpdatedMessage(message)) {
            const nativeUri = parseUri(payload.uri);
            const document = rememberDocument(
              await api.workspace.openTextDocument(nativeUri),
            );
            const workspaceEdit = new api.WorkspaceEdit();
            const edit = createMobxstateLayoutTextEdit(
              document.getText(),
              payload.machine.ranges.config,
              {
                positions: readLayoutPositions(message.positions) ?? {},
                labelPositions: readLayoutPositions(message.labelPositions),
              },
            );

            workspaceEdit.replace(
              nativeUri,
              toNativeRange(api, document, edit.range),
              edit.text,
            );

            const applied = await api.workspace.applyEdit(workspaceEdit);
            if (!applied) {
              throw new Error("VS Code rejected MobXstate layout edits.");
            }

            await panel.webview.postMessage({ type: "LAYOUT_SAVED" });
            return;
          }

          await panel.webview.postMessage(
            session.handleMessage(message as VisualEditorDraftCommandMessage),
          );
        });
        context?.subscriptions.push(disposable);
        await panel.webview.postMessage(session.getSnapshot());
      }
    },
    async writeFile(uri, text) {
      await api.workspace.fs.writeFile(parseUri(uri), new TextEncoder().encode(text));
    },
    async applyTextEdits(uri, edits) {
      const nativeUri = parseUri(uri);
      const document = rememberDocument(
        await api.workspace.openTextDocument(nativeUri),
      );
      const workspaceEdit = new api.WorkspaceEdit();

      edits.forEach((edit: SourceTextEdit) => {
        workspaceEdit.replace(
          nativeUri,
          toNativeRange(api, document, edit.range),
          edit.text,
        );
      });

      const applied = await api.workspace.applyEdit(workspaceEdit);
      if (!applied) {
        throw new Error("VS Code rejected MobXstate source edits.");
      }
    },
    async showInformationMessage(message) {
      await api.window.showInformationMessage?.(message);
    },
    async showErrorMessage(message) {
      await api.window.showErrorMessage?.(message);
    },
  };

  const shell = createVscodeDevtoolsShell(host);
  const codeLensProvider = createOpenVisualEditorCodeLensProvider(
    api,
    rememberDocument,
  );
  const codeLensDisposable =
    codeLensProvider && api.languages.registerCodeLensProvider
      ? api.languages.registerCodeLensProvider(
          codeLensDocumentSelector,
          codeLensProvider,
        )
      : undefined;
  const extension: VscodeNativeExtension = {
    shell,
    diagnostics: diagnosticsCollection,
    dispose() {
      codeLensDisposable?.dispose();
      shell.dispose();
      diagnosticsCollection.dispose();
    },
  };

  if (codeLensDisposable) {
    context?.subscriptions.push(codeLensDisposable);
  }
  context?.subscriptions.push(extension);
  return extension;
};
