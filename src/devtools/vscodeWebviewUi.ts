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

    .editor-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }

    .tool-button {
      min-height: 28px;
      padding: 4px 9px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 6px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }

    .tool-button.secondary {
      color: var(--vscode-foreground);
      background: var(--vscode-button-secondaryBackground, var(--vscode-sideBar-background));
    }

    .tool-button:disabled {
      opacity: 0.48;
      cursor: default;
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

    .editor-form {
      display: grid;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .editor-form label {
      display: grid;
      gap: 3px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .editor-form input,
    .editor-form select,
    .editor-form textarea {
      width: 100%;
      min-height: 28px;
      padding: 4px 6px;
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }

    .editor-form textarea {
      min-height: 126px;
      resize: vertical;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 12px);
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
        <div class="editor-toolbar" data-testid="editor-toolbar">
          <button class="tool-button secondary" type="button" data-editor-command="undo" id="undo-button">Undo</button>
          <button class="tool-button secondary" type="button" data-editor-command="redo" id="redo-button">Redo</button>
          <button class="tool-button" type="button" data-editor-command="export" id="focus-export-button">Export</button>
        </div>
        <div class="stats" id="stats"></div>
        <div class="pane-header">
          <h2>Transitions</h2>
          <span class="count" id="transition-count"></span>
        </div>
        <ul class="list" data-testid="transition-list" id="transition-list"></ul>
        <form class="editor-form" data-testid="transition-inspector-form" id="transition-form">
          <h2>Transition</h2>
          <label>Source path
            <input name="sourcePath" autocomplete="off" placeholder="idle">
          </label>
          <label>Trigger kind
            <select name="triggerKind">
              <option value="on">on</option>
              <option value="after">after</option>
              <option value="always">always</option>
              <option value="onDone">onDone</option>
              <option value="onError">onError</option>
            </select>
          </label>
          <label>Trigger key
            <input name="triggerKey" autocomplete="off" placeholder="START">
          </label>
          <label>Target
            <input name="target" autocomplete="off" placeholder="loading">
          </label>
          <label>Actions
            <input name="actions" autocomplete="off" placeholder="recordStart">
          </label>
          <label>Guard
            <input name="cond" autocomplete="off" placeholder="canStart">
          </label>
          <button class="tool-button" type="submit" data-editor-command="addTransition">Add transition</button>
          <button class="tool-button secondary" type="button" data-editor-command="updateTransition" id="update-transition-button">Update selected</button>
          <button class="tool-button secondary" type="button" data-editor-command="removeTransition" id="remove-transition-button">Remove selected</button>
        </form>
      </section>
      <aside class="pane">
        <div class="pane-header">
          <h2>Inspector</h2>
        </div>
        <section class="inspector" id="inspector"></section>
        <form class="editor-form" data-testid="state-inspector-form" id="state-form">
          <h2>State</h2>
          <label>Parent path
            <input name="parentPath" autocomplete="off" placeholder="checkout.payment">
          </label>
          <label>State key
            <input name="key" autocomplete="off" placeholder="loading">
          </label>
          <label>Rename selected to
            <input name="renameKey" autocomplete="off" placeholder="pending">
          </label>
          <label>State type
            <select name="stateType">
              <option value="">auto</option>
              <option value="atomic">atomic</option>
              <option value="compound">compound</option>
              <option value="parallel">parallel</option>
              <option value="final">final</option>
              <option value="history">history</option>
            </select>
          </label>
          <button class="tool-button" type="submit" data-editor-command="addState">Add state</button>
          <button class="tool-button secondary" type="button" data-editor-command="renameState" id="rename-state-button">Rename selected</button>
          <button class="tool-button secondary" type="button" data-editor-command="removeState" id="remove-state-button">Remove selected</button>
          <button class="tool-button secondary" type="button" data-editor-command="setStateType" id="set-state-type-button">Set type</button>
        </form>
        <form class="editor-form" data-testid="export-panel" id="export-form">
          <h2>Export</h2>
          <textarea readonly id="export-output" spellcheck="false"></textarea>
        </form>
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
    const stateFormElement = document.getElementById("state-form");
    const transitionFormElement = document.getElementById("transition-form");
    const exportOutputElement = document.getElementById("export-output");
    const undoButtonElement = document.getElementById("undo-button");
    const redoButtonElement = document.getElementById("redo-button");
    const renameStateButtonElement = document.getElementById("rename-state-button");
    const removeStateButtonElement = document.getElementById("remove-state-button");
    const setStateTypeButtonElement = document.getElementById("set-state-type-button");
    const updateTransitionButtonElement = document.getElementById("update-transition-button");
    const removeTransitionButtonElement = document.getElementById("remove-transition-button");
    const focusExportButtonElement = document.getElementById("focus-export-button");
    const modeTabElements = Array.from(document.querySelectorAll("[data-mode]"));
    const vscodeApi = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
    let selectedNodeId = "";
    let selectedEdgeId = "";
    let latestDraft = undefined;

    const clear = (element) => element.replaceChildren();
    const text = (value) => value === undefined || value === null || value === "" ? "(none)" : String(value);
    const pathText = (path) => path && path.length > 0 ? path.join(".") : "(root)";
    const parsePath = (value) => value.split(".").map((part) => part.trim()).filter(Boolean);
    const serializePath = (path) => path && path.length > 0 ? path.join(".") : "";
    const formValue = (form, name) => String(new FormData(form).get(name) || "").trim();

    const postDraftCommand = (command, params) => {
      if (!vscodeApi) {
        return;
      }

      vscodeApi.postMessage({
        type: "DRAFT_COMMAND",
        command,
        params,
      });
    };

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

    const renderStats = (graph, diagnostics) => {
      const stateCount = graph.nodes.length;
      const transitionCount = graph.edges.length;
      const diagnosticCount = diagnostics.length;
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
      const isDraftUpdate = payload.type === "DRAFT_UPDATED";
      const graph = isDraftUpdate ? payload.graph : payload.machine.graph;
      const nodes = graph.nodes;
      const edges = graph.edges;
      const diagnostics = isDraftUpdate ? payload.diagnostics : payload.diagnostics;
      latestDraft = isDraftUpdate ? payload : latestDraft;
      selectedNodeId = selectedNodeId || (nodes[0] ? nodes[0].id : "");
      const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0];
      const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) || edges[0];
      selectedEdgeId = selectedEdge ? selectedEdge.id : "";

      const panelMode = isDraftUpdate ? rootElement.dataset.panelMode : payload.mode;
      rootElement.dataset.panelMode = panelMode;
      modeTabElements.forEach((button) => {
        button.setAttribute("aria-selected", button.dataset.mode === panelMode ? "true" : "false");
      });
      stateCountElement.textContent = String(nodes.length);
      transitionCountElement.textContent = String(edges.length);
      diagnosticCountElement.textContent = String(diagnostics.length);
      renderStats(graph, diagnostics);
      undoButtonElement.disabled = isDraftUpdate ? !payload.canUndo : true;
      redoButtonElement.disabled = isDraftUpdate ? !payload.canRedo : true;
      renameStateButtonElement.disabled = !selectedNode;
      removeStateButtonElement.disabled = !selectedNode || selectedNode.path.length === 0;
      setStateTypeButtonElement.disabled = !selectedNode;
      updateTransitionButtonElement.disabled = !selectedEdge;
      removeTransitionButtonElement.disabled = !selectedEdge;
      exportOutputElement.value = isDraftUpdate ? payload.exportText : "";

      if (selectedNode) {
        stateFormElement.elements.parentPath.value = serializePath(selectedNode.path.slice(0, -1));
        stateFormElement.elements.renameKey.value = selectedNode.key;
        stateFormElement.elements.stateType.value = selectedNode.declaredType || selectedNode.type || "";
      }

      if (selectedEdge) {
        transitionFormElement.elements.sourcePath.value = serializePath(selectedEdge.sourcePath);
        transitionFormElement.elements.triggerKind.value = selectedEdge.trigger.kind;
        transitionFormElement.elements.triggerKey.value = selectedEdge.trigger.key || "";
        transitionFormElement.elements.target.value = selectedEdge.target || "";
        transitionFormElement.elements.actions.value = selectedEdge.actions.join(", ");
        transitionFormElement.elements.cond.value = selectedEdge.guard || "";
      }

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
            edge.id === selectedEdgeId,
            () => {
              selectedEdgeId = edge.id;
              render(payload);
            }
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

    undoButtonElement.addEventListener("click", () => postDraftCommand("undo"));
    redoButtonElement.addEventListener("click", () => postDraftCommand("redo"));
    focusExportButtonElement.addEventListener("click", () => exportOutputElement.focus());

    stateFormElement.addEventListener("submit", (event) => {
      event.preventDefault();
      postDraftCommand("addState", {
        parentPath: parsePath(formValue(stateFormElement, "parentPath")),
        key: formValue(stateFormElement, "key"),
      });
    });

    renameStateButtonElement.addEventListener("click", () => {
      const selected = latestDraft?.graph.nodes.find((node) => node.id === selectedNodeId);
      if (!selected) {
        return;
      }

      postDraftCommand("renameState", {
        path: selected.path,
        newKey: formValue(stateFormElement, "renameKey"),
      });
    });

    removeStateButtonElement.addEventListener("click", () => {
      const selected = latestDraft?.graph.nodes.find((node) => node.id === selectedNodeId);
      if (selected) {
        postDraftCommand("removeState", { path: selected.path });
      }
    });

    setStateTypeButtonElement.addEventListener("click", () => {
      const selected = latestDraft?.graph.nodes.find((node) => node.id === selectedNodeId);
      if (!selected) {
        return;
      }

      postDraftCommand("setStateType", {
        path: selected.path,
        type: formValue(stateFormElement, "stateType"),
      });
    });

    transitionFormElement.addEventListener("submit", (event) => {
      event.preventDefault();
      postDraftCommand("addTransition", {
        sourcePath: parsePath(formValue(transitionFormElement, "sourcePath")),
        trigger: {
          kind: formValue(transitionFormElement, "triggerKind"),
          key: formValue(transitionFormElement, "triggerKey"),
        },
        transition: {
          target: formValue(transitionFormElement, "target"),
          actions: formValue(transitionFormElement, "actions"),
          cond: formValue(transitionFormElement, "cond"),
        },
      });
    });

    updateTransitionButtonElement.addEventListener("click", () => {
      if (!selectedEdgeId) {
        return;
      }

      postDraftCommand("updateTransition", {
        edgeId: selectedEdgeId,
        patch: {
          target: formValue(transitionFormElement, "target"),
          actions: formValue(transitionFormElement, "actions"),
          cond: formValue(transitionFormElement, "cond"),
        },
      });
    });

    removeTransitionButtonElement.addEventListener("click", () => {
      if (selectedEdgeId) {
        postDraftCommand("removeTransition", { edgeId: selectedEdgeId });
      }
    });

    render(JSON.parse(payloadElement.textContent));
    window.addEventListener("message", (event) => render(event.data));
  </script>
</body>
</html>`;
};
