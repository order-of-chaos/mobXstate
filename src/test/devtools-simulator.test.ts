import { makeObservable, observable } from "mobx";
import { describe, expect, it } from "vitest";

import {
  createMachine,
  createRuntimeBridge,
  createSimulatorController,
  machineConfigToGraph,
  MobXStateMachine,
  type MachineOptions,
} from "../index";

type PlayerEvent =
  | { type: "PLAY" }
  | { type: "STOP" }
  | { type: "SET_VOLUME"; value: number };

const playerMachine = createMachine<PlayerEvent>({
  id: "player",
  initial: "idle",
  states: {
    idle: {
      on: {
        PLAY: "playing",
        SET_VOLUME: {
          target: "configured",
          actions: "setVolume",
        },
      },
    },
    configured: {
      on: {
        PLAY: "playing",
      },
    },
    playing: {
      on: {
        STOP: "idle",
      },
    },
  },
});

const playerOptions: MachineOptions<PlayerState, PlayerEvent> = {
  actions: {
    setVolume(event) {
      if (event.type === "SET_VOLUME") {
        this.volume = event.value;
      }
    },
  },
};

class PlayerState extends MobXStateMachine<PlayerState, PlayerEvent> {
  public volume = 0;

  constructor() {
    super(playerMachine, playerOptions, { deferStart: false });

    makeObservable(this, {
      volume: observable,
    });
  }
}

describe("devtools simulator controller", () => {
  it("builds an event palette and sends payloadless event types", async () => {
    const player = new PlayerState();
    await player.ready;

    const bridge = createRuntimeBridge(player);
    const graph = machineConfigToGraph(playerMachine.config);
    const simulator = createSimulatorController(bridge, graph);

    try {
      expect(simulator.getEventPalette()).toEqual([
        { type: "PLAY", enabled: true },
        { type: "SET_VOLUME", enabled: true },
        { type: "STOP", enabled: false },
      ]);

      const result = simulator.sendEventType("PLAY");

      expect(result).toMatchObject({
        ok: true,
        event: "PLAY",
        model: {
          state: "playing",
          activeNodeIds: ["player", "player.playing"],
        },
      });
      expect(simulator.getEventPalette()).toEqual([
        { type: "PLAY", enabled: false },
        { type: "SET_VOLUME", enabled: false },
        { type: "STOP", enabled: true },
      ]);
      expect(simulator.getHistory().map((entry) => entry.state)).toEqual([
        "idle",
        "playing",
      ]);
    } finally {
      simulator.dispose();
      bridge.dispose();
      player.stopMachine();
    }
  });

  it("sends object events and JSON events without evaluating source code", async () => {
    const player = new PlayerState();
    await player.ready;

    const bridge = createRuntimeBridge(player);
    const graph = machineConfigToGraph(playerMachine.config);
    const simulator = createSimulatorController(bridge, graph);

    try {
      const objectResult = simulator.sendEventObject({
        type: "SET_VOLUME",
        value: 7,
      });

      expect(objectResult).toMatchObject({
        ok: true,
        model: {
          state: "configured",
        },
      });
      expect(player.volume).toBe(7);

      const jsonResult = simulator.sendEventJson('{"type":"PLAY"}');

      expect(jsonResult).toMatchObject({
        ok: true,
        model: {
          state: "playing",
        },
      });
      expect(simulator.sendEventJson("{")).toEqual({
        ok: false,
        message: "Event JSON is invalid.",
      });
      expect(simulator.sendEventJson('{"value":1}')).toEqual({
        ok: false,
        message: 'Event JSON must be an object with a string "type" field.',
      });
    } finally {
      simulator.dispose();
      bridge.dispose();
      player.stopMachine();
    }
  });

  it("keeps bounded snapshot history for UI playback", async () => {
    const player = new PlayerState();
    await player.ready;

    const bridge = createRuntimeBridge(player);
    const graph = machineConfigToGraph(playerMachine.config);
    const simulator = createSimulatorController(bridge, graph, { maxHistory: 2 });

    try {
      simulator.sendEventType("PLAY");
      simulator.sendEventType("STOP");

      expect(
        simulator.getHistory().map((entry) => ({
          index: entry.index,
          state: entry.state,
          event: entry.event?.type,
        })),
      ).toEqual([
        { index: 1, state: "playing", event: "PLAY" },
        { index: 2, state: "idle", event: "STOP" },
      ]);

      simulator.clearHistory();

      expect(
        simulator.getHistory().map((entry) => ({
          index: entry.index,
          state: entry.state,
          event: entry.event?.type,
        })),
      ).toEqual([{ index: 0, state: "idle", event: "STOP" }]);
    } finally {
      simulator.dispose();
      bridge.dispose();
      player.stopMachine();
    }
  });
});
