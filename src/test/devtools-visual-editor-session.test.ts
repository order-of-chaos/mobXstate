import { describe, expect, it } from "vitest";

import {
  createVisualEditorSession,
  type VisualEditorDraftCommandMessage,
} from "../index";

const config = {
  id: "editor",
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "loading",
      },
    },
    loading: {},
  },
};

describe("visual editor session", () => {
  it("creates draft snapshots with export text and undo/redo state", () => {
    const session = createVisualEditorSession(config);
    const snapshot = session.getSnapshot();

    expect(snapshot.type).toBe("DRAFT_UPDATED");
    expect(snapshot.graph.nodes.map((node) => node.id)).toContain("editor.idle");
    expect(snapshot.exportText).toContain("createMachine({");
    expect(snapshot.exportText).toContain('id: "editor"');
    expect(snapshot.canUndo).toBe(false);
    expect(snapshot.canRedo).toBe(false);
    expect(snapshot.isDirty).toBe(false);
  });

  it("handles state and transition commands through a webview-safe protocol", () => {
    const session = createVisualEditorSession(config);

    const addState = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "addState",
      params: {
        parentPath: [],
        key: "ready",
      },
    });
    const addTransition = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "addTransition",
      params: {
        sourcePath: ["loading"],
        trigger: {
          kind: "on",
          key: "DONE",
        },
        transition: {
          target: "ready",
        },
      },
    });

    expect(addState.commandResult?.ok).toBe(true);
    expect(addTransition.commandResult?.ok).toBe(true);
    expect(addTransition.graph.nodes.map((node) => node.id)).toContain(
      "editor.ready",
    );
    expect(
      addTransition.graph.edges.find((edge) => edge.trigger.key === "DONE")
        ?.target,
    ).toBe("ready");
    expect(addTransition.canUndo).toBe(true);
    expect(addTransition.exportText).toContain("DONE");
  });

  it("supports rename, remove, undo and redo commands", () => {
    const session = createVisualEditorSession(config);

    session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "renameState",
      params: {
        path: ["loading"],
        newKey: "pending",
      },
    });
    const undo = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "undo",
    });
    const redo = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "redo",
    });

    expect(undo.graph.nodes.map((node) => node.id)).toContain("editor.loading");
    expect(undo.canRedo).toBe(true);
    expect(redo.graph.nodes.map((node) => node.id)).toContain("editor.pending");
    expect(redo.canUndo).toBe(true);
  });

  it("returns command failures without mutating the draft", () => {
    const session = createVisualEditorSession(config);
    const before = session.getSnapshot().exportText;

    const after = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "addState",
      params: {
        parentPath: [],
        key: "idle",
      },
    });

    expect(after.commandResult).toEqual({
      ok: false,
      command: "add_state",
      message: 'State "idle" already exists in "editor".',
    });
    expect(after.exportText).toBe(before);
  });

  it("ignores unknown webview messages with a stable failure snapshot", () => {
    const session = createVisualEditorSession(config);
    const response = session.handleMessage({
      type: "DRAFT_COMMAND",
      command: "missingCommand",
    } as unknown as VisualEditorDraftCommandMessage);

    expect(response.commandResult).toBeUndefined();
    expect(response.error).toContain("Unsupported visual editor command");
  });
});
