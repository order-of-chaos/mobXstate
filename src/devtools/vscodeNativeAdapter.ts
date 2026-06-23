import type { SourceRange, SourceTextEdit } from "./sourceReader";
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
} from "./vscodeExtensionShell";
import {
  createVscodeDevtoolsWebviewHtml,
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
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      context?.subscriptions.push(panel);
      panel.webview.html = createVscodeDevtoolsWebviewHtml(payload);
      await panel.webview.postMessage(payload);

      if (payload.mode === "visualEditor" && panel.webview.onDidReceiveMessage) {
        const session = createVisualEditorSession(payload.machine.config);
        const disposable = panel.webview.onDidReceiveMessage(async (message) => {
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
  const extension: VscodeNativeExtension = {
    shell,
    diagnostics: diagnosticsCollection,
    dispose() {
      shell.dispose();
      diagnosticsCollection.dispose();
    },
  };

  context?.subscriptions.push(extension);
  return extension;
};
