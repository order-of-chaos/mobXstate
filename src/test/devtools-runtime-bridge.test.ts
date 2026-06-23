import { describe, expect, it } from "vitest";

import {
  createMachine,
  createRuntimeBridge,
  machineConfigToGraph,
  MobXStateMachine,
} from "../index";

type LightEvent = { type: "NEXT" } | { type: "RESET" };

const lightMachine = createMachine<LightEvent>({
  id: "light",
  initial: "red",
  on: {
    RESET: "red",
  },
  states: {
    red: {
      on: {
        NEXT: "green",
      },
    },
    green: {
      on: {
        NEXT: "yellow",
      },
    },
    yellow: {
      on: {
        NEXT: "red",
      },
    },
  },
});

class LightState extends MobXStateMachine<LightState, LightEvent> {
  constructor() {
    super(lightMachine, { deferStart: false });
  }
}

describe("devtools runtime bridge", () => {
  it("creates runtime models from a MobXStateMachine instance", async () => {
    const light = new LightState();
    await light.ready;

    const bridge = createRuntimeBridge(light);
    const graph = machineConfigToGraph(lightMachine.config);

    try {
      expect(bridge.getModel(graph)).toMatchObject({
        status: "running",
        state: "red",
        activePaths: [["red"]],
        activeNodeIds: ["light", "light.red"],
        eventCandidates: ["RESET", "NEXT"],
      });

      bridge.send("NEXT");

      expect(bridge.getModel(graph)).toMatchObject({
        status: "running",
        state: "green",
        activePaths: [["green"]],
        activeNodeIds: ["light", "light.green"],
        eventCandidates: ["RESET", "NEXT"],
      });
    } finally {
      bridge.dispose();
      light.stopMachine();
    }
  });

  it("notifies subscribers and tracks stop status", async () => {
    const light = new LightState();
    await light.ready;

    const bridge = createRuntimeBridge(light);
    const seenStates: Array<string | undefined> = [];

    try {
      const unsubscribe = bridge.subscribe(() => {
        const state = bridge.getState();
        seenStates.push(typeof state === "string" ? state : undefined);
      });

      bridge.send("NEXT");
      unsubscribe();
      bridge.send("NEXT");
      bridge.stop();

      expect(seenStates).toEqual(["red", "green"]);
      expect(bridge.getStatus()).toBe("stopped");
    } finally {
      bridge.dispose();
      light.stopMachine();
    }
  });
});
