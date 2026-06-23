import { describe, expect, it } from "vitest";

import {
  createDraftModel,
  createMachine,
  validateMachineConfigForDevtools,
  type MachineConfig,
} from "../index";

type DraftEvent =
  | { type: "START" }
  | { type: "DONE" }
  | { type: "RESET" };

describe("devtools draft model", () => {
  it("edits a cloned config and exports a valid MachineConfig", () => {
    const sourceConfig: MachineConfig<DraftEvent> = {
      id: "draft",
      initial: "idle",
      states: {
        idle: {},
      },
    };

    const draft = createDraftModel(sourceConfig);

    expect(draft.addState([], "loading").ok).toBe(true);
    expect(
      draft.addTransition(["idle"], { kind: "on", key: "START" }, {
        target: "loading",
        actions: "recordStart",
      }),
    ).toMatchObject({ ok: true });
    expect(
      draft.addTransition(["loading"], { kind: "on", key: "DONE" }, {
        target: "idle",
      }),
    ).toMatchObject({ ok: true });

    const exported = draft.exportConfig();

    expect(sourceConfig.states).toEqual({ idle: {} });
    expect(exported.states?.loading).toEqual({
      on: {
        DONE: {
          target: "idle",
        },
      },
    });
    expect(validateMachineConfigForDevtools(exported)).toEqual([]);
    expect(createMachine(exported).id).toBe("draft");
    expect(draft.isDirty()).toBe(true);
  });

  it("renames a state and rewrites transition targets", () => {
    const draft = createDraftModel<DraftEvent>({
      id: "rename",
      initial: "idle",
      states: {
        idle: {
          on: {
            START: "active",
          },
        },
        active: {
          on: {
            RESET: "idle",
          },
        },
      },
    });

    expect(draft.renameState(["active"], "working")).toMatchObject({ ok: true });

    const renamed = draft.exportConfig();
    expect(renamed.states?.active).toBeUndefined();
    expect(renamed.states?.working).toBeDefined();
    expect(renamed.states?.idle?.on?.START).toEqual({
      target: "working",
    });
    expect(draft.getDiagnostics()).toEqual([]);

    expect(draft.undo()).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.active).toBeDefined();
    expect(draft.canRedo()).toBe(true);

    expect(draft.redo()).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.working).toBeDefined();
  });

  it("adds a connected state and transition as one undoable command", () => {
    const draft = createDraftModel<DraftEvent>({
      id: "connected",
      initial: "idle",
      states: {
        idle: {},
      },
    });

    expect(
      draft.addConnectedState(
        ["idle"],
        [],
        "ready",
        { kind: "on", key: "DONE" },
        { target: "ready" },
      ),
    ).toMatchObject({ ok: true, command: "add_connected_state" });

    expect(draft.exportConfig().states?.ready).toEqual({});
    expect(draft.exportConfig().states?.idle?.on?.DONE).toEqual({
      target: "ready",
    });
    expect(
      draft.getGraph().edges.find((edge) => edge.trigger.key === "DONE"),
    ).toMatchObject({
      sourcePath: ["idle"],
      targetPath: ["ready"],
    });

    expect(draft.undo()).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.ready).toBeUndefined();
    expect(draft.exportConfig().states?.idle?.on).toBeUndefined();
  });

  it("removes states and keeps validation diagnostics visible", () => {
    const draft = createDraftModel<DraftEvent>({
      id: "remove",
      initial: "idle",
      states: {
        idle: {
          on: {
            START: "obsolete",
          },
        },
        obsolete: {},
      },
    });

    expect(draft.removeState(["obsolete"])).toMatchObject({ ok: true });
    expect(draft.getDiagnostics().map((diagnostic) => diagnostic.code)).toEqual([
      "unknown_transition_target",
    ]);

    expect(draft.undo()).toMatchObject({ ok: true });
    expect(draft.getDiagnostics()).toEqual([]);
  });

  it("updates and removes transitions by graph edge id", () => {
    const draft = createDraftModel<DraftEvent>({
      id: "edges",
      initial: "idle",
      states: {
        idle: {
          on: {
            START: "loading",
          },
        },
        loading: {},
        done: {},
      },
    });
    const edge = draft.getGraph().edges.find((candidate) => {
      return candidate.trigger.kind === "on" && candidate.trigger.key === "START";
    });

    expect(edge).toBeDefined();
    expect(
      draft.updateTransition(edge?.id ?? "", {
        target: "done",
        description: "finish immediately",
      }),
    ).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.idle?.on?.START).toEqual({
      target: "done",
      description: "finish immediately",
    });

    const updatedEdge = draft.getGraph().edges.find((candidate) => {
      return candidate.trigger.kind === "on" && candidate.trigger.key === "START";
    });
    expect(draft.removeTransition(updatedEdge?.id ?? "")).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.idle?.on).toEqual({});

    expect(draft.undo()).toMatchObject({ ok: true });
    expect(draft.exportConfig().states?.idle?.on?.START).toEqual({
      target: "done",
      description: "finish immediately",
    });
  });

  it("reports command failures without changing the draft", () => {
    const draft = createDraftModel<DraftEvent>({
      id: "failures",
      initial: "idle",
      states: {
        idle: {},
      },
    });

    expect(draft.addState([], "idle")).toEqual({
      ok: false,
      command: "add_state",
      message: 'State "idle" already exists in "failures".',
    });
    expect(draft.renameState([], "root")).toEqual({
      ok: false,
      command: "rename_state",
      message: "Root machine state cannot be renamed.",
    });
    expect(draft.canUndo()).toBe(false);
    expect(draft.exportConfig()).toEqual({
      id: "failures",
      initial: "idle",
      states: {
        idle: {},
      },
    });
  });
});
