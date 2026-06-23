import type { SourceRange, SourceTextEdit } from "./sourceReader";
import {
  createVscodeDevtoolsShell,
  type VscodeDevtoolsDiagnostic,
  type VscodeDevtoolsDisposable,
  type VscodeDevtoolsHost,
  type VscodeDevtoolsPanelMode,
  type VscodeDevtoolsPanelPayload,
  type VscodeDevtoolsShell,
} from "./vscodeExtensionShell";

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

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const serializePayload = (payload: VscodeDevtoolsPanelPayload): string => {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
};

const getPanelTitle = (mode: VscodeDevtoolsPanelMode): string => {
  return mode === "viewer" ? "MobXstate Viewer" : "MobXstate Visual Editor";
};

const getPanelViewType = (mode: VscodeDevtoolsPanelMode): string => {
  return mode === "viewer" ? "mobxstate.viewer" : "mobxstate.visualEditor";
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

export const createVscodeDevtoolsWebviewHtml = (
  payload: VscodeDevtoolsPanelPayload,
): string => {
  const serialized = serializePayload(payload);
  const title = getPanelTitle(payload.mode);
  const machineId = escapeHtml(payload.machine.id);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: var(--vscode-font-family, system-ui, sans-serif); }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    main { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr); gap: 1px; min-height: 100vh; background: var(--vscode-panel-border); }
    section { background: var(--vscode-editor-background); padding: 12px; overflow: auto; }
    h1, h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { padding: 5px 0; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; }
    .meta { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 12px; }
    .diag { color: var(--vscode-errorForeground); }
    @media (max-width: 640px) { main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <script type="application/json" id="mobxstate-payload">${serialized}</script>
  <main>
    <section>
      <h1>MobXstate Devtools</h1>
      <div class="meta">${machineId}</div>
      <h2>States</h2>
      <ul id="states"></ul>
    </section>
    <section>
      <h2>Transitions</h2>
      <ul id="transitions"></ul>
      <h2>Diagnostics</h2>
      <ul id="diagnostics"></ul>
    </section>
  </main>
  <script>
    const payloadElement = document.getElementById("mobxstate-payload");
    const statesElement = document.getElementById("states");
    const transitionsElement = document.getElementById("transitions");
    const diagnosticsElement = document.getElementById("diagnostics");

    const renderList = (element, values, formatter) => {
      element.replaceChildren(...values.map((value) => {
        const item = document.createElement("li");
        item.textContent = formatter(value);
        return item;
      }));
    };

    const render = (payload) => {
      renderList(statesElement, payload.machine.graph.nodes, (node) => node.id);
      renderList(
        transitionsElement,
        payload.machine.graph.edges,
        (edge) => edge.sourcePath.join(".") + " -> " + (edge.target || "(none)")
      );
      renderList(
        diagnosticsElement,
        payload.diagnostics,
        (diagnostic) => diagnostic.code ? diagnostic.code + ": " + diagnostic.message : diagnostic.message
      );
    };

    render(JSON.parse(payloadElement.textContent));
    window.addEventListener("message", (event) => render(event.data));
  </script>
</body>
</html>`;
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
        getPanelViewType(payload.mode),
        getPanelTitle(payload.mode),
        api.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      context?.subscriptions.push(panel);
      panel.webview.html = createVscodeDevtoolsWebviewHtml(payload);
      await panel.webview.postMessage(payload);
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
