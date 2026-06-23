import { describe, expect, it } from "vitest";

import {
  compileMobxstateTypes,
  createMachine,
  shouldWriteTypegenFile,
  type MachineOptions,
} from "../index";

type LoaderEvent =
  | { type: "START"; userId: string }
  | { type: "RETRY" }
  | { type: "done.invoke.loadUser"; data: string };

interface LoaderStore {
  readonly canStart: boolean;
}

const loaderMachine = createMachine<LoaderEvent>({
  id: "loader",
  initial: "idle",
  states: {
    idle: {
      on: {
        START: {
          target: "loading",
          cond: "canStart",
          actions: "recordStart",
        },
      },
    },
    loading: {
      invoke: {
        id: "loadUser",
        src: "loadUser",
        onDone: {
          target: "ready",
          actions: "assignUser",
        },
      },
      after: {
        RETRY_DELAY: {
          target: "idle",
        },
      },
    },
    ready: {},
  },
});

const loaderOptions: MachineOptions<LoaderStore, LoaderEvent> = {
  actions: {
    recordStart() {
      return undefined;
    },
  },
  guards: {
    canStart() {
      return true;
    },
  },
};

describe("devtools type compiler", () => {
  it("compiles stable typegen data from a machine config", () => {
    const result = compileMobxstateTypes({
      config: loaderMachine.config,
      analysisOptions: {
        machineOptions: loaderOptions,
        strictImplementations: true,
      },
    });
    const [typegen] = result.machines;

    expect(typegen).toBeDefined();
    expect(typegen?.matchesStates).toEqual(["idle", "loading", "ready"]);
    expect(typegen?.internalEvents).toEqual([
      "done.invoke.loadUser",
      "mobxstate.after(RETRY_DELAY)#loader.loading",
    ]);
    expect(typegen?.invokeSrcNameMap).toEqual({
      loadUser: "loadUser",
    });
    expect(typegen?.eventsCausingActions).toEqual({
      assignUser: ["done.invoke.loadUser"],
      recordStart: ["START"],
    });
    expect(typegen?.eventsCausingGuards).toEqual({
      canStart: ["START"],
    });
    expect(typegen?.eventsCausingDelays).toEqual({
      RETRY_DELAY: ["START"],
    });
    expect(typegen?.eventsCausingEffects).toEqual({
      loadUser: ["START"],
    });
    expect(typegen?.missingImplementations).toEqual({
      actions: ["assignUser"],
      delays: ["RETRY_DELAY"],
      effects: ["loadUser"],
      guards: [],
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "MBS001",
      "MBS003",
      "MBS004",
    ]);
  });

  it("prints a deterministic Typegen module", () => {
    const result = compileMobxstateTypes({
      config: loaderMachine.config,
      name: "LoaderTypegen",
      analysisOptions: {
        machineOptions: loaderOptions,
        strictImplementations: true,
      },
    });

    expect(result.moduleText).toContain("export interface LoaderTypegen");
    expect(result.moduleText).toContain('"@@mobxstate/typegen": true;');
    expect(result.moduleText).toContain('"recordStart": "START";');
    expect(result.moduleText).toContain(
      '"loadUser": "START";',
    );
    expect(result.moduleText).toContain(
      '"mobxstate.after(RETRY_DELAY)#loader.loading": { type: "mobxstate.after(RETRY_DELAY)#loader.loading" };',
    );
    expect(result.moduleText).toContain(
      'export type LoaderTypegenMatchesStates = LoaderTypegen["matchesStates"] & MachineStateValue;',
    );
  });

  it("detects no-op typegen writes", () => {
    const result = compileMobxstateTypes({
      config: loaderMachine.config,
    });

    expect(shouldWriteTypegenFile(undefined, result.moduleText)).toEqual({
      shouldWrite: true,
      reason: "missing",
    });
    expect(shouldWriteTypegenFile(result.moduleText, result.moduleText)).toEqual({
      shouldWrite: false,
      reason: "unchanged",
    });
    expect(shouldWriteTypegenFile("old", result.moduleText)).toEqual({
      shouldWrite: true,
      reason: "changed",
    });
  });
});
