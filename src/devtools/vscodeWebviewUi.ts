import type {
  VscodeDevtoolsPanelMode,
  VscodeDevtoolsPanelPayload,
} from "./vscodeExtensionShell";

export interface VscodeDevtoolsWebviewAssetOptions {
  readonly scriptUri?: string;
  readonly styleUri?: string;
}

const defaultScriptUri = "media/mobxstate-visual-editor.js";
const defaultStyleUri = "media/mobxstate-visual-editor.css";

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

export const getVscodeDevtoolsPanelTitle = (
  mode: VscodeDevtoolsPanelMode,
): string => {
  return mode === "viewer" ? "MobXstate Viewer" : "MobXstate Visual Editor";
};

export const getVscodeDevtoolsPanelViewType = (
  mode: VscodeDevtoolsPanelMode,
): string => {
  return mode === "viewer" ? "mobxstate.viewer" : "mobxstate.visualEditor";
};

export const createVscodeDevtoolsWebviewHtml = (
  payload: VscodeDevtoolsPanelPayload,
  assets: VscodeDevtoolsWebviewAssetOptions = {},
): string => {
  const title = getVscodeDevtoolsPanelTitle(payload.mode);
  const serialized = serializePayload(payload);
  const machineId = escapeHtml(payload.machine.id);
  const scriptUri = escapeHtml(assets.scriptUri ?? defaultScriptUri);
  const styleUri = escapeHtml(assets.styleUri ?? defaultStyleUri);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <script type="application/json" id="mobxstate-payload">${serialized}</script>
  <div id="mobxstate-webview-root">
    <main
      class="shell"
      data-mobxstate-devtools-ui="vscode-webview"
      data-panel-mode="${payload.mode}"
      data-ui-mode="editor"
    >
      <header class="topbar">
        <div class="machine-title">
          <h1>MobXstate Devtools</h1>
          <span id="machine-id">${machineId}</span>
        </div>
        <div class="mode-tabs" role="tablist" aria-label="Editor mode">
          <button type="button" role="tab" data-ui-mode="editor">Editor</button>
          <button type="button" role="tab" data-ui-mode="simulation">Simulation</button>
        </div>
      </header>
      <section class="graph-workspace">
        <section class="graph-pane" data-testid="state-graph">
          <div class="graph-empty">Loading graph...</div>
        </section>
        <aside class="inspector-pane">
          <div class="editor-toolbar" data-testid="editor-toolbar">
            <button type="button" data-editor-command="undo">Undo</button>
            <button type="button" data-editor-command="redo">Redo</button>
          </div>
          <form data-testid="state-inspector-form">
            <button type="button" data-editor-command="addState">Add state</button>
          </form>
          <form data-testid="transition-inspector-form">
            <button type="button" data-editor-command="addTransition">Add transition</button>
          </form>
        </aside>
      </section>
    </main>
  </div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
};
