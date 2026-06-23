import { autorun } from "mobx";

import {
  MachineActorStatus,
  type IMachineState,
  type MachineSnapshot,
} from "../MobXStateMachine";
import type {
  EventObject,
  MachineSendEvent,
  MachineStateValue,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine";
import type { GraphModel } from "./machineAnalyzer";

export type RuntimeModelStatus =
  | "not_started"
  | "running"
  | "stopped"
  | "error";

export interface RuntimeModel<Event extends EventObject = EventObject> {
  readonly status: RuntimeModelStatus;
  readonly state: MachineStateValue | undefined;
  readonly snapshot: MachineSnapshot<Event> | undefined;
  readonly event: Event | undefined;
  readonly activePaths: readonly (readonly string[])[];
  readonly activeNodeIds: readonly string[];
  readonly eventCandidates: readonly string[];
}

export interface RuntimeBridge<Event extends EventObject = EventObject> {
  getState(): MachineStateValue | undefined;
  getSnapshot(): MachineSnapshot<Event> | undefined;
  getStatus(): RuntimeModelStatus;
  getModel(graph?: Pick<GraphModel, "id" | "nodes" | "edges">): RuntimeModel<Event>;
  send(event: MachineSendEvent<Event>): void;
  start(state?: MachineStateValue): Promise<unknown>;
  stop(): void;
  restart(): Promise<unknown>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

type RuntimeBridgeSource<
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Pick<
  IMachineState<Scope, Event, Typegen>,
  | "state"
  | "snapshot"
  | "ready"
  | "send"
  | "startMachine"
  | "stopMachine"
  | "restart"
>;

const pathKey = (path: readonly string[]): string => path.join(".");

const machineStateValueToLeafPaths = (
  value: MachineStateValue | undefined,
): string[][] => {
  if (value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return [[value]];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    return machineStateValueToLeafPaths(child).map((path) => [key, ...path]);
  });
};

const getActiveSourceKeys = (
  activePaths: readonly (readonly string[])[],
): Set<string> => {
  const keys = new Set<string>([""]);

  activePaths.forEach((path) => {
    for (let index = 1; index <= path.length; index += 1) {
      keys.add(pathKey(path.slice(0, index)));
    }
  });

  return keys;
};

const getActiveNodeIds = (
  activePaths: readonly (readonly string[])[],
  graph: Pick<GraphModel, "id" | "nodes"> | undefined,
): string[] => {
  const nodeIdsByPath = new Map<string, string>();

  graph?.nodes.forEach((node) => {
    nodeIdsByPath.set(pathKey(node.path), node.id);
  });

  const activeNodeIds = new Set<string>();
  const rootId = graph?.id;
  if (rootId) {
    activeNodeIds.add(rootId);
  }

  activePaths.forEach((path) => {
    for (let index = 1; index <= path.length; index += 1) {
      const key = pathKey(path.slice(0, index));
      activeNodeIds.add(nodeIdsByPath.get(key) ?? key);
    }
  });

  return Array.from(activeNodeIds);
};

const getEventCandidates = (
  activePaths: readonly (readonly string[])[],
  graph: Pick<GraphModel, "edges"> | undefined,
): string[] => {
  if (!graph) {
    return [];
  }

  const activeSourceKeys = getActiveSourceKeys(activePaths);
  const eventTypes = new Set<string>();

  graph.edges.forEach((edge) => {
    if (edge.trigger.kind !== "on" || edge.trigger.key === undefined) {
      return;
    }

    if (activeSourceKeys.has(pathKey(edge.sourcePath))) {
      eventTypes.add(edge.trigger.key);
    }
  });

  return Array.from(eventTypes);
};

export const createRuntimeModel = <Event extends EventObject = EventObject>(
  status: RuntimeModelStatus,
  snapshot: MachineSnapshot<Event> | undefined,
  graph?: Pick<GraphModel, "id" | "nodes" | "edges">,
): RuntimeModel<Event> => {
  const activePaths = machineStateValueToLeafPaths(snapshot?.value);

  return {
    status,
    state: snapshot?.value,
    snapshot,
    event: snapshot?.event,
    activePaths,
    activeNodeIds: getActiveNodeIds(activePaths, graph),
    eventCandidates: getEventCandidates(activePaths, graph),
  };
};

export const createRuntimeBridge = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  source: RuntimeBridgeSource<Scope, Event, Typegen>,
): RuntimeBridge<Event> => {
  const listeners = new Set<() => void>();
  let status: RuntimeModelStatus =
    source.snapshot === undefined ? "not_started" : "running";

  const notify = (
    _state?: MachineStateValue,
    _snapshot?: MachineSnapshot<Event>,
  ): void => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const setStatus = (nextStatus: RuntimeModelStatus): void => {
    if (status === nextStatus) {
      return;
    }

    status = nextStatus;
    notify();
  };

  source.ready
    .then((readyStatus) => {
      if (readyStatus === MachineActorStatus.Running) {
        setStatus("running");
      }
    })
    .catch(() => {
      setStatus("error");
  });

  const disposeAutorun = autorun(() => {
    notify(source.state, source.snapshot);
  });

  return {
    getState() {
      return source.state;
    },
    getSnapshot() {
      return source.snapshot;
    },
    getStatus() {
      return status;
    },
    getModel(graph) {
      return createRuntimeModel(status, source.snapshot, graph);
    },
    send(event) {
      source.send(event);
    },
    async start(state) {
      try {
        const readyStatus = await source.startMachine(state);
        if (readyStatus === MachineActorStatus.Running) {
          setStatus("running");
        }

        return readyStatus;
      } catch (error) {
        setStatus("error");
        throw error;
      }
    },
    stop() {
      try {
        source.stopMachine();
        setStatus("stopped");
      } catch (error) {
        setStatus("error");
        throw error;
      }
    },
    async restart() {
      try {
        const readyStatus = await source.restart();
        if (readyStatus === MachineActorStatus.Running) {
          setStatus("running");
        }

        return readyStatus;
      } catch (error) {
        setStatus("error");
        throw error;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener();

      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
      disposeAutorun();
    },
  };
};
