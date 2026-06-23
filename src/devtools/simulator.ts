import type {
  EventObject,
  MachineSendEvent,
  MachineStateValue,
} from "../MobXStateMachine";
import type { GraphModel } from "./machineAnalyzer";
import type { RuntimeBridge, RuntimeModel } from "./runtimeBridge";

export interface SimulatorEventCandidate {
  readonly type: string;
  readonly enabled: boolean;
}

export interface SimulatorHistoryEntry<Event extends EventObject = EventObject> {
  readonly index: number;
  readonly status: RuntimeModel<Event>["status"];
  readonly state: MachineStateValue | undefined;
  readonly event: Event | undefined;
  readonly activePaths: readonly (readonly string[])[];
  readonly activeNodeIds: readonly string[];
}

export interface SimulatorSendSuccess<Event extends EventObject = EventObject> {
  readonly ok: true;
  readonly event: MachineSendEvent<Event>;
  readonly model: RuntimeModel<Event>;
}

export interface SimulatorSendFailure {
  readonly ok: false;
  readonly message: string;
}

export type SimulatorSendResult<Event extends EventObject = EventObject> =
  | SimulatorSendSuccess<Event>
  | SimulatorSendFailure;

export interface SimulatorController<Event extends EventObject = EventObject> {
  getModel(): RuntimeModel<Event>;
  getEventPalette(): readonly SimulatorEventCandidate[];
  getHistory(): readonly SimulatorHistoryEntry<Event>[];
  clearHistory(): void;
  sendEventType(type: string): SimulatorSendResult<Event>;
  sendEventObject(event: Event): SimulatorSendResult<Event>;
  sendEventJson(json: string): SimulatorSendResult<Event>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export interface SimulatorControllerOptions {
  readonly maxHistory?: number;
}

const defaultMaxHistory = 100;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isEventObject = (value: unknown): value is EventObject => {
  return isObjectRecord(value) && typeof value.type === "string";
};

const getAllEventTypes = (
  graph: Pick<GraphModel, "edges"> | undefined,
): string[] => {
  if (!graph) {
    return [];
  }

  const eventTypes = new Set<string>();
  graph.edges.forEach((edge) => {
    if (edge.trigger.kind === "on" && edge.trigger.key !== undefined) {
      eventTypes.add(edge.trigger.key);
    }
  });

  return Array.from(eventTypes);
};

export const createSimulatorEventPalette = <Event extends EventObject>(
  model: RuntimeModel<Event>,
  graph?: Pick<GraphModel, "edges">,
): readonly SimulatorEventCandidate[] => {
  const enabledTypes = new Set(model.eventCandidates);
  const allEventTypes = getAllEventTypes(graph);
  const paletteTypes = allEventTypes.length > 0 ? allEventTypes : model.eventCandidates;

  return paletteTypes.map((type) => {
    return {
      type,
      enabled: model.status === "running" && enabledTypes.has(type),
    };
  });
};

const sameEvent = (
  left: EventObject | undefined,
  right: EventObject | undefined,
): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.type !== right.type) {
    return false;
  }

  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  const rightRecord = right as unknown as Record<string, unknown>;

  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => rightRecord[key] === value)
  );
};

const sameStateValue = (
  left: MachineStateValue | undefined,
  right: MachineStateValue | undefined,
): boolean => {
  if (left === right) {
    return true;
  }

  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }

  if (!left || !right) {
    return false;
  }

  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => sameStateValue(value, right[key]))
  );
};

const sameHistoryEntry = <Event extends EventObject>(
  entry: SimulatorHistoryEntry<Event>,
  model: RuntimeModel<Event>,
): boolean => {
  return (
    entry.status === model.status &&
    sameStateValue(entry.state, model.state) &&
    sameEvent(entry.event, model.event) &&
    entry.activeNodeIds.length === model.activeNodeIds.length &&
    entry.activeNodeIds.every((nodeId, index) => nodeId === model.activeNodeIds[index])
  );
};

const createHistoryEntry = <Event extends EventObject>(
  index: number,
  model: RuntimeModel<Event>,
): SimulatorHistoryEntry<Event> => {
  return {
    index,
    status: model.status,
    state: model.state,
    event: model.event,
    activePaths: model.activePaths,
    activeNodeIds: model.activeNodeIds,
  };
};

export const createSimulatorController = <Event extends EventObject>(
  bridge: RuntimeBridge<Event>,
  graph?: Pick<GraphModel, "id" | "nodes" | "edges">,
  options: SimulatorControllerOptions = {},
): SimulatorController<Event> => {
  const maxHistory = options.maxHistory ?? defaultMaxHistory;
  const listeners = new Set<() => void>();
  const history: Array<SimulatorHistoryEntry<Event>> = [];
  let nextHistoryIndex = 0;

  const getModel = (): RuntimeModel<Event> => bridge.getModel(graph);

  const notify = (): void => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const recordCurrentModel = (): void => {
    const model = getModel();
    const lastEntry = history[history.length - 1];

    if (lastEntry && sameHistoryEntry(lastEntry, model)) {
      return;
    }

    history.push(createHistoryEntry(nextHistoryIndex, model));
    nextHistoryIndex += 1;

    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }

    notify();
  };

  const send = (
    event: MachineSendEvent<Event>,
  ): SimulatorSendResult<Event> => {
    if (bridge.getStatus() !== "running") {
      return {
        ok: false,
        message: "Cannot send events while runtime is not running.",
      };
    }

    try {
      bridge.send(event);
      return {
        ok: true,
        event,
        model: getModel(),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to send event.",
      };
    }
  };

  const unsubscribe = bridge.subscribe(recordCurrentModel);

  return {
    getModel,
    getEventPalette() {
      return createSimulatorEventPalette(getModel(), graph);
    },
    getHistory() {
      return [...history];
    },
    clearHistory() {
      history.length = 0;
      nextHistoryIndex = 0;
      recordCurrentModel();
    },
    sendEventType(type) {
      return send(type as MachineSendEvent<Event>);
    },
    sendEventObject(event) {
      return send(event);
    },
    sendEventJson(json) {
      let parsed: unknown;

      try {
        parsed = JSON.parse(json);
      } catch {
        return {
          ok: false,
          message: "Event JSON is invalid.",
        };
      }

      if (!isEventObject(parsed)) {
        return {
          ok: false,
          message: 'Event JSON must be an object with a string "type" field.',
        };
      }

      return send(parsed as Event);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener();

      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
};
