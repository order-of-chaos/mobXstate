import type { VscodeDevtoolsPanelMode, VscodeDevtoolsPanelPayload } from "./vscodeExtensionShell";

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
): string => {
  const title = getVscodeDevtoolsPanelTitle(payload.mode);
  const serialized = serializePayload(payload);
  const machineId = escapeHtml(payload.machine.id);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    button {
      color: inherit;
      font: inherit;
    }

    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .topbar {
      min-height: 46px;
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      align-items: center;
      gap: 16px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }

    .machine-title {
      min-width: 0;
    }

    .machine-title h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
      overflow-wrap: anywhere;
    }

    .machine-title span {
      display: block;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }

    .mode-tabs {
      display: inline-flex;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 6px;
      overflow: hidden;
      background: var(--vscode-editor-background);
    }

    .mode-tabs button {
      min-width: 72px;
      height: 28px;
      border: 0;
      border-left: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      background: transparent;
      cursor: default;
    }

    .mode-tabs button:first-child {
      border-left: 0;
    }

    .mode-tabs button[aria-selected="true"] {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    .workspace {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(220px, 0.95fr) minmax(280px, 1.3fr) minmax(240px, 0.9fr);
      background: var(--vscode-panel-border);
      gap: 1px;
    }

    .pane {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      padding: 10px;
      background: var(--vscode-editor-background);
    }

    .pane-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      min-height: 24px;
      margin-bottom: 8px;
    }

    .pane h2 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }

    .count {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 4px;
    }

    .item-button {
      width: 100%;
      min-height: 34px;
      padding: 6px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      text-align: left;
      background: var(--vscode-sideBar-background);
      cursor: pointer;
    }

    .item-button:hover,
    .item-button[aria-selected="true"] {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }

    .item-title {
      display: block;
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }

    .item-meta {
      display: block;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 16px;
      overflow-wrap: anywhere;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 10px;
    }

    .stat {
      min-height: 48px;
      padding: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-sideBar-background);
    }

    .stat strong {
      display: block;
      font-size: 17px;
      line-height: 21px;
    }

    .stat span {
      display: block;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 15px;
    }

    .inspector {
      min-height: 160px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-sideBar-background);
    }

    .inspector dl {
      margin: 0;
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 6px 10px;
    }

    .inspector dt {
      color: var(--vscode-descriptionForeground);
    }

    .inspector dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .diagnostic {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border));
    }

    .empty {
      color: var(--vscode-descriptionForeground);
      padding: 8px 0;
    }

    @media (max-width: 860px) {
      .topbar {
        grid-template-columns: 1fr;
      }

      .workspace {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <script type="application/json" id="mobxstate-payload">${serialized}</script>
  <main
    class="shell"
    data-mobxstate-devtools-ui="vscode-webview"
    data-panel-mode="${payload.mode}"
  >
    <header class="topbar">
      <div class="machine-title">
        <h1>MobXstate Devtools</h1>
        <span id="machine-id">${machineId}</span>
      </div>
      <div class="mode-tabs" role="tablist" aria-label="View mode">
        <button type="button" role="tab" data-mode="viewer">Viewer</button>
        <button type="button" role="tab" data-mode="visualEditor">Editor</button>
      </div>
    </header>
    <section class="workspace">
      <aside class="pane">
        <div class="pane-header">
          <h2>States</h2>
          <span class="count" id="state-count"></span>
        </div>
        <ul class="list" data-testid="state-list" id="state-list"></ul>
      </aside>
      <section class="pane">
        <div class="stats" id="stats"></div>
        <div class="pane-header">
          <h2>Transitions</h2>
          <span class="count" id="transition-count"></span>
        </div>
        <ul class="list" data-testid="transition-list" id="transition-list"></ul>
      </section>
      <aside class="pane">
        <div class="pane-header">
          <h2>Inspector</h2>
        </div>
        <section class="inspector" id="inspector"></section>
        <div class="pane-header">
          <h2>Diagnostics</h2>
          <span class="count" id="diagnostic-count"></span>
        </div>
        <ul class="list" data-testid="diagnostic-list" id="diagnostic-list"></ul>
      </aside>
    </section>
  </main>
  <script>
    const payloadElement = document.getElementById("mobxstate-payload");
    const rootElement = document.querySelector("[data-mobxstate-devtools-ui]");
    const stateListElement = document.getElementById("state-list");
    const transitionListElement = document.getElementById("transition-list");
    const diagnosticListElement = document.getElementById("diagnostic-list");
    const stateCountElement = document.getElementById("state-count");
    const transitionCountElement = document.getElementById("transition-count");
    const diagnosticCountElement = document.getElementById("diagnostic-count");
    const inspectorElement = document.getElementById("inspector");
    const statsElement = document.getElementById("stats");
    const modeTabElements = Array.from(document.querySelectorAll("[data-mode]"));
    let selectedNodeId = "";

    const clear = (element) => element.replaceChildren();
    const text = (value) => value === undefined || value === null || value === "" ? "(none)" : String(value);
    const pathText = (path) => path && path.length > 0 ? path.join(".") : "(root)";

    const createListButton = (title, meta, selected, onClick) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const titleElement = document.createElement("span");
      const metaElement = document.createElement("span");
      button.type = "button";
      button.className = "item-button";
      button.setAttribute("aria-selected", selected ? "true" : "false");
      titleElement.className = "item-title";
      metaElement.className = "item-meta";
      titleElement.textContent = title;
      metaElement.textContent = meta;
      button.append(titleElement, metaElement);
      button.addEventListener("click", onClick);
      item.append(button);
      return item;
    };

    const renderInspector = (node) => {
      clear(inspectorElement);
      const list = document.createElement("dl");
      const entries = [
        ["id", node ? node.id : ""],
        ["type", node ? node.type : ""],
        ["path", node ? pathText(node.path) : ""],
        ["initial", node ? node.initial : ""],
        ["entry", node ? node.entryActions.join(", ") : ""],
        ["exit", node ? node.exitActions.join(", ") : ""],
        ["invoke", node ? node.invokeSources.join(", ") : ""],
      ];

      entries.forEach(([label, value]) => {
        const term = document.createElement("dt");
        const definition = document.createElement("dd");
        term.textContent = label;
        definition.textContent = text(value);
        list.append(term, definition);
      });
      inspectorElement.append(list);
    };

    const renderStats = (payload) => {
      const stateCount = payload.machine.graph.nodes.length;
      const transitionCount = payload.machine.graph.edges.length;
      const diagnosticCount = payload.diagnostics.length;
      const values = [
        ["stateCount", stateCount, "states"],
        ["transitionCount", transitionCount, "transitions"],
        ["diagnosticCount", diagnosticCount, "diagnostics"],
      ];

      clear(statsElement);
      values.forEach(([key, value, label]) => {
        const stat = document.createElement("div");
        const strong = document.createElement("strong");
        const span = document.createElement("span");
        stat.className = "stat";
        stat.dataset.stat = key;
        strong.textContent = String(value);
        span.textContent = label;
        stat.append(strong, span);
        statsElement.append(stat);
      });
    };

    const render = (payload) => {
      const nodes = payload.machine.graph.nodes;
      const edges = payload.machine.graph.edges;
      const diagnostics = payload.diagnostics;
      selectedNodeId = selectedNodeId || (nodes[0] ? nodes[0].id : "");
      const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0];

      rootElement.dataset.panelMode = payload.mode;
      modeTabElements.forEach((button) => {
        button.setAttribute("aria-selected", button.dataset.mode === payload.mode ? "true" : "false");
      });
      stateCountElement.textContent = String(nodes.length);
      transitionCountElement.textContent = String(edges.length);
      diagnosticCountElement.textContent = String(diagnostics.length);
      renderStats(payload);

      clear(stateListElement);
      nodes.forEach((node) => {
        stateListElement.append(createListButton(
          node.id,
          node.type + " - " + pathText(node.path),
          node.id === selectedNodeId,
          () => {
            selectedNodeId = node.id;
            render(payload);
          }
        ));
      });

      clear(transitionListElement);
      if (edges.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "No transitions";
        transitionListElement.append(empty);
      } else {
        edges.forEach((edge) => {
          transitionListElement.append(createListButton(
            pathText(edge.sourcePath) + " -> " + text(edge.target),
            edge.trigger.kind + (edge.trigger.key ? " " + edge.trigger.key : ""),
            false,
            () => undefined
          ));
        });
      }

      clear(diagnosticListElement);
      if (diagnostics.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "No diagnostics";
        diagnosticListElement.append(empty);
      } else {
        diagnostics.forEach((diagnostic) => {
          const item = createListButton(
            diagnostic.code || diagnostic.severity,
            diagnostic.message,
            false,
            () => undefined
          );
          item.querySelector("button").classList.add("diagnostic");
          diagnosticListElement.append(item);
        });
      }

      renderInspector(selectedNode);
    };

    render(JSON.parse(payloadElement.textContent));
    window.addEventListener("message", (event) => render(event.data));
  </script>
</body>
</html>`;
};
