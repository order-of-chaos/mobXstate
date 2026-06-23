import type {
  EventObject,
  MachineConfig,
  MachineDelayTransition,
  MachineInvokeReference,
  MachineStateNodeConfig,
  MachineTransition,
  MachineTransitionConfig,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine/stateMachine";
import {
  machineConfigToGraph,
  validateMachineConfigForDevtools,
  type DevtoolsDiagnostic,
  type GraphModel,
  type GraphTransitionEdge,
  type GraphTransitionKind,
} from "./machineAnalyzer";

export type DraftCommandType =
  | "add_state"
  | "rename_state"
  | "remove_state"
  | "set_state_type"
  | "set_initial_state"
  | "add_transition"
  | "update_transition"
  | "remove_transition"
  | "undo"
  | "redo";

export interface DraftCommandSuccess {
  readonly ok: true;
  readonly command: DraftCommandType;
  readonly graph: GraphModel;
  readonly diagnostics: readonly DevtoolsDiagnostic[];
}

export interface DraftCommandFailure {
  readonly ok: false;
  readonly command: DraftCommandType;
  readonly message: string;
}

export type DraftCommandResult = DraftCommandSuccess | DraftCommandFailure;

export interface DraftTransitionTrigger {
  readonly kind: GraphTransitionKind;
  readonly key?: string;
  readonly invokeId?: string;
}

export type DraftTransitionPatch<Event extends EventObject = EventObject> =
  Partial<MachineTransitionConfig<Event>>;

export interface DraftModel<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  getConfig(): MachineConfig<Event, Typegen>;
  exportConfig(): MachineConfig<Event, Typegen>;
  getGraph(): GraphModel;
  getDiagnostics(): readonly DevtoolsDiagnostic[];
  isDirty(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  addState(
    parentPath: readonly string[],
    key: string,
    stateConfig?: MachineStateNodeConfig<Event>,
  ): DraftCommandResult;
  renameState(path: readonly string[], newKey: string): DraftCommandResult;
  removeState(path: readonly string[]): DraftCommandResult;
  setStateType(
    path: readonly string[],
    type: MachineStateNodeConfig<Event>["type"] | undefined,
    history?: MachineStateNodeConfig<Event>["history"],
  ): DraftCommandResult;
  setInitialState(
    parentPath: readonly string[],
    initialState: string | undefined,
  ): DraftCommandResult;
  addTransition(
    sourcePath: readonly string[],
    trigger: DraftTransitionTrigger,
    transition: MachineTransitionConfig<Event>,
  ): DraftCommandResult;
  updateTransition(
    edgeId: string,
    patch: DraftTransitionPatch<Event>,
  ): DraftCommandResult;
  removeTransition(edgeId: string): DraftCommandResult;
  undo(): DraftCommandResult;
  redo(): DraftCommandResult;
}

interface HistoryEntry<Event extends EventObject, Typegen extends TypegenConstraint> {
  readonly command: DraftCommandType;
  readonly before: MachineConfig<Event, Typegen>;
  readonly after: MachineConfig<Event, Typegen>;
}

interface TransitionSlot<Event extends EventObject> {
  get(): MachineTransition<Event> | MachineDelayTransition<Event> | undefined;
  set(value: MachineTransition<Event> | MachineDelayTransition<Event>): void;
  clear(): void;
}

const pathKey = (path: readonly string[]): string => path.join(".");

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const cloneValue = <Value>(value: Value): Value => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as Value;
  }

  if (isObjectRecord(value)) {
    const result: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, child]) => {
      result[key] = cloneValue(child);
    });

    return result as Value;
  }

  return value;
};

const normalizeTransition = <Event extends EventObject>(
  value: MachineTransition<Event> | MachineDelayTransition<Event> | undefined,
): Array<MachineTransitionConfig<Event>> => {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [{ target: value }];
  }

  return Array.isArray(value) ? value : [value];
};

const compactTransitionValue = <Event extends EventObject>(
  transitions: readonly MachineTransitionConfig<Event>[],
):
  | MachineTransitionConfig<Event>
  | Array<MachineTransitionConfig<Event>>
  | undefined => {
  if (transitions.length === 0) {
    return undefined;
  }

  return transitions.length === 1 ? transitions[0] : [...transitions];
};

const isValidStateKey = (key: string): boolean => {
  return key.length > 0 && key.trim() === key && !key.includes(".");
};

const fail = (
  command: DraftCommandType,
  message: string,
): DraftCommandFailure => {
  return {
    ok: false,
    command,
    message,
  };
};

const success = (
  command: DraftCommandType,
  graph: GraphModel,
): DraftCommandSuccess => {
  return {
    ok: true,
    command,
    graph,
    diagnostics: graph.diagnostics,
  };
};

const getStateConfig = <Event extends EventObject>(
  config: MachineStateNodeConfig<Event>,
  path: readonly string[],
): MachineStateNodeConfig<Event> | undefined => {
  let current: MachineStateNodeConfig<Event> | undefined = config;

  for (const segment of path) {
    current = current?.states?.[segment];
    if (!current) {
      return undefined;
    }
  }

  return current;
};

const getParentStateConfig = <Event extends EventObject>(
  config: MachineStateNodeConfig<Event>,
  path: readonly string[],
): MachineStateNodeConfig<Event> | undefined => {
  return path.length === 0 ? undefined : getStateConfig(config, path.slice(0, -1));
};

const getStateMap = <Event extends EventObject>(
  config: MachineStateNodeConfig<Event>,
): Record<string, MachineStateNodeConfig<Event>> => {
  if (!config.states) {
    config.states = {};
  }

  return config.states;
};

const replaceStateKey = <Event extends EventObject>(
  states: Record<string, MachineStateNodeConfig<Event>>,
  oldKey: string,
  newKey: string,
): void => {
  const nextStates: Record<string, MachineStateNodeConfig<Event>> = {};

  Object.entries(states).forEach(([key, value]) => {
    nextStates[key === oldKey ? newKey : key] = value;
  });

  Object.keys(states).forEach((key) => {
    delete states[key];
  });
  Object.assign(states, nextStates);
};

const startsWithPath = (
  path: readonly string[],
  prefix: readonly string[],
): boolean => {
  return prefix.every((segment, index) => path[index] === segment);
};

const rewriteTarget = (
  machineId: string,
  sourcePath: readonly string[],
  target: string,
  oldPath: readonly string[],
  newPath: readonly string[],
  resolvedTargetPath: readonly string[] | undefined,
): string => {
  if (!resolvedTargetPath || !startsWithPath(resolvedTargetPath, oldPath)) {
    return target;
  }

  const nextTargetPath = [
    ...newPath,
    ...resolvedTargetPath.slice(oldPath.length),
  ];

  if (target.startsWith("#")) {
    return `#${machineId}.${pathKey(nextTargetPath)}`;
  }

  const sourceParentPath = sourcePath.slice(0, -1);
  if (startsWithPath(nextTargetPath, sourceParentPath)) {
    const relativeToSourceParent = nextTargetPath.slice(sourceParentPath.length);
    if (relativeToSourceParent.length > 0) {
      return pathKey(relativeToSourceParent);
    }
  }

  return pathKey(nextTargetPath);
};

const updateTransitionTarget = <Event extends EventObject>(
  transition: MachineTransitionConfig<Event>,
  edge: GraphTransitionEdge,
  machineId: string,
  oldPath: readonly string[],
  newPath: readonly string[],
): MachineTransitionConfig<Event> => {
  if (!transition.target) {
    return transition;
  }

  return {
    ...transition,
    target: rewriteTarget(
      machineId,
      edge.sourcePath,
      transition.target,
      oldPath,
      newPath,
      edge.targetPath,
    ),
  };
};

const getInvokeConfigs = <Event extends EventObject>(
  node: MachineStateNodeConfig<Event>,
): Array<MachineInvokeReference<Event>> => {
  if (!node.invoke) {
    return [];
  }

  return Array.isArray(node.invoke) ? node.invoke : [node.invoke];
};

const setInvokeConfigs = <Event extends EventObject>(
  node: MachineStateNodeConfig<Event>,
  invokes: Array<MachineInvokeReference<Event>>,
): void => {
  if (invokes.length === 0) {
    delete node.invoke;
    return;
  }

  node.invoke = invokes.length === 1 ? invokes[0] : invokes;
};

const getInvokeId = <Event extends EventObject>(
  sourcePath: readonly string[],
  invoke: MachineInvokeReference<Event>,
  index: number,
): string | undefined => {
  if (typeof invoke === "string") {
    return invoke;
  }

  if ("src" in invoke) {
    return invoke.id ?? `${pathKey(sourcePath)}:invoke:${index}`;
  }

  return invoke.id;
};

const findInvokeConfig = <Event extends EventObject>(
  node: MachineStateNodeConfig<Event>,
  sourcePath: readonly string[],
  invokeId: string,
):
  | {
      readonly invokes: Array<MachineInvokeReference<Event>>;
      readonly index: number;
      readonly invoke: MachineInvokeReference<Event>;
    }
  | undefined => {
  const invokes = getInvokeConfigs(node);
  const index = invokes.findIndex((invoke, invokeIndex) => {
    return getInvokeId(sourcePath, invoke, invokeIndex) === invokeId;
  });

  if (index < 0) {
    return undefined;
  }

  const invoke = invokes[index];
  if (!invoke) {
    return undefined;
  }

  return {
    invokes,
    index,
    invoke,
  };
};

const getTransitionSlot = <
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  config: MachineConfig<Event, Typegen>,
  sourcePath: readonly string[],
  trigger: DraftTransitionTrigger,
): TransitionSlot<Event> | undefined => {
  const node = getStateConfig(config, sourcePath);
  if (!node) {
    return undefined;
  }

  if (trigger.kind === "on") {
    if (!trigger.key) {
      return undefined;
    }

    const key = trigger.key;
    return {
      get: () => node.on?.[key],
      set: (value) => {
        if (!node.on) {
          node.on = {};
        }
        node.on[key] = value;
      },
      clear: () => {
        if (node.on) {
          delete node.on[key];
        }
      },
    };
  }

  if (trigger.kind === "after") {
    if (!trigger.key) {
      return undefined;
    }

    const key = trigger.key;
    return {
      get: () => node.after?.[key],
      set: (value) => {
        if (!node.after) {
          node.after = {};
        }
        node.after[key] = value;
      },
      clear: () => {
        if (node.after) {
          delete node.after[key];
        }
      },
    };
  }

  if (trigger.kind === "always") {
    return {
      get: () => node.always,
      set: (value) => {
        node.always = value;
      },
      clear: () => {
        delete node.always;
      },
    };
  }

  if (trigger.kind === "onDone" && !trigger.invokeId) {
    return {
      get: () => node.onDone,
      set: (value) => {
        node.onDone = value;
      },
      clear: () => {
        delete node.onDone;
      },
    };
  }

  if (
    (trigger.kind === "onDone" || trigger.kind === "onError") &&
    trigger.invokeId
  ) {
    const found = findInvokeConfig(node, sourcePath, trigger.invokeId);
    if (!found || typeof found.invoke === "string" || !("src" in found.invoke)) {
      return undefined;
    }

    const invoke = found.invoke;

    return {
      get: () => (trigger.kind === "onDone" ? invoke.onDone : invoke.onError),
      set: (value) => {
        if (trigger.kind === "onDone") {
          invoke.onDone = value;
        } else {
          invoke.onError = value;
        }
        setInvokeConfigs(node, found.invokes);
      },
      clear: () => {
        if (trigger.kind === "onDone") {
          delete invoke.onDone;
        } else {
          delete invoke.onError;
        }
        setInvokeConfigs(node, found.invokes);
      },
    };
  }

  return undefined;
};

const writeTransitionAtIndex = <Event extends EventObject>(
  slot: TransitionSlot<Event>,
  index: number,
  transition: MachineTransitionConfig<Event> | undefined,
): boolean => {
  const transitions = normalizeTransition(slot.get());
  if (index < 0 || index >= transitions.length) {
    return false;
  }

  if (transition) {
    transitions[index] = transition;
  } else {
    transitions.splice(index, 1);
  }

  const nextValue = compactTransitionValue(transitions);
  if (nextValue) {
    slot.set(nextValue);
  } else {
    slot.clear();
  }

  return true;
};

class MachineDraftModel<
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> implements DraftModel<Event, Typegen>
{
  private current: MachineConfig<Event, Typegen>;

  private graph: GraphModel;

  private readonly undoStack: Array<HistoryEntry<Event, Typegen>> = [];

  private readonly redoStack: Array<HistoryEntry<Event, Typegen>> = [];

  public constructor(config: MachineConfig<Event, Typegen>) {
    this.current = cloneValue(config);
    this.graph = machineConfigToGraph<object, Event, Typegen>(this.current);
  }

  public getConfig = (): MachineConfig<Event, Typegen> => {
    return cloneValue(this.current);
  };

  public exportConfig = (): MachineConfig<Event, Typegen> => {
    return this.getConfig();
  };

  public getGraph = (): GraphModel => {
    return this.graph;
  };

  public getDiagnostics = (): readonly DevtoolsDiagnostic[] => {
    return this.graph.diagnostics;
  };

  public isDirty = (): boolean => {
    return this.undoStack.length > 0;
  };

  public canUndo = (): boolean => {
    return this.undoStack.length > 0;
  };

  public canRedo = (): boolean => {
    return this.redoStack.length > 0;
  };

  public addState = (
    parentPath: readonly string[],
    key: string,
    stateConfig: MachineStateNodeConfig<Event> = {},
  ): DraftCommandResult => {
    return this.applyCommand("add_state", (config) => {
      if (!isValidStateKey(key)) {
        return `Invalid state key "${key}".`;
      }

      const parent = getStateConfig(config, parentPath);
      if (!parent) {
        return `State "${pathKey(parentPath)}" was not found.`;
      }

      const states = getStateMap(parent);
      if (states[key]) {
        return `State "${key}" already exists in "${pathKey(parentPath) || config.id}".`;
      }

      states[key] = cloneValue(stateConfig);
      return undefined;
    });
  };

  public renameState = (
    path: readonly string[],
    newKey: string,
  ): DraftCommandResult => {
    return this.applyCommand("rename_state", (config) => {
      if (path.length === 0) {
        return "Root machine state cannot be renamed.";
      }

      if (!isValidStateKey(newKey)) {
        return `Invalid state key "${newKey}".`;
      }

      const parent = getParentStateConfig(config, path);
      const oldKey = path[path.length - 1];
      if (!parent?.states?.[oldKey]) {
        return `State "${pathKey(path)}" was not found.`;
      }

      if (parent.states[newKey]) {
        return `State "${newKey}" already exists in "${pathKey(path.slice(0, -1)) || config.id}".`;
      }

      const oldPath = [...path];
      const newPath = [...path.slice(0, -1), newKey];
      const previousGraph = machineConfigToGraph<object, Event, Typegen>(config);

      replaceStateKey(parent.states, oldKey, newKey);
      if (parent.initial === oldKey) {
        parent.initial = newKey;
      }

      this.rewriteTargetsForRenamedState(config, previousGraph, oldPath, newPath);
      return undefined;
    });
  };

  public removeState = (path: readonly string[]): DraftCommandResult => {
    return this.applyCommand("remove_state", (config) => {
      if (path.length === 0) {
        return "Root machine state cannot be removed.";
      }

      const parent = getParentStateConfig(config, path);
      const key = path[path.length - 1];
      if (!parent?.states?.[key]) {
        return `State "${pathKey(path)}" was not found.`;
      }

      delete parent.states[key];

      if (parent.initial === key) {
        const [nextInitial] = Object.keys(parent.states);
        if (nextInitial) {
          parent.initial = nextInitial;
        } else {
          delete parent.initial;
        }
      }

      return undefined;
    });
  };

  public setStateType = (
    path: readonly string[],
    type: MachineStateNodeConfig<Event>["type"] | undefined,
    history?: MachineStateNodeConfig<Event>["history"],
  ): DraftCommandResult => {
    return this.applyCommand("set_state_type", (config) => {
      const state = getStateConfig(config, path);
      if (!state) {
        return `State "${pathKey(path)}" was not found.`;
      }

      if (type === undefined) {
        delete state.type;
      } else {
        state.type = type;
      }

      if (history === undefined) {
        delete state.history;
      } else {
        state.history = history;
      }

      return undefined;
    });
  };

  public setInitialState = (
    parentPath: readonly string[],
    initialState: string | undefined,
  ): DraftCommandResult => {
    return this.applyCommand("set_initial_state", (config) => {
      const parent = getStateConfig(config, parentPath);
      if (!parent) {
        return `State "${pathKey(parentPath)}" was not found.`;
      }

      if (initialState === undefined) {
        delete parent.initial;
        return undefined;
      }

      if (!parent.states?.[initialState]) {
        return `Initial state "${initialState}" was not found in "${pathKey(parentPath) || config.id}".`;
      }

      parent.initial = initialState;
      return undefined;
    });
  };

  public addTransition = (
    sourcePath: readonly string[],
    trigger: DraftTransitionTrigger,
    transition: MachineTransitionConfig<Event>,
  ): DraftCommandResult => {
    return this.applyCommand("add_transition", (config) => {
      const slot = getTransitionSlot(config, sourcePath, trigger);
      if (!slot) {
        return `Transition slot was not found for state "${pathKey(sourcePath)}".`;
      }

      const transitions = normalizeTransition(slot.get());
      transitions.push(cloneValue(transition));
      const nextValue = compactTransitionValue(transitions);
      if (nextValue) {
        slot.set(nextValue);
      }

      return undefined;
    });
  };

  public updateTransition = (
    edgeId: string,
    patch: DraftTransitionPatch<Event>,
  ): DraftCommandResult => {
    return this.applyCommand("update_transition", (config) => {
      const edge = this.graph.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return `Transition "${edgeId}" was not found.`;
      }

      const slot = getTransitionSlot(config, edge.sourcePath, edge.trigger);
      if (!slot) {
        return `Transition slot was not found for "${edgeId}".`;
      }

      const current = normalizeTransition(slot.get())[edge.index];
      if (!current) {
        return `Transition "${edgeId}" was not found.`;
      }

      return writeTransitionAtIndex(slot, edge.index, {
        ...current,
        ...cloneValue(patch),
      })
        ? undefined
        : `Transition "${edgeId}" was not found.`;
    });
  };

  public removeTransition = (edgeId: string): DraftCommandResult => {
    return this.applyCommand("remove_transition", (config) => {
      const edge = this.graph.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return `Transition "${edgeId}" was not found.`;
      }

      const slot = getTransitionSlot(config, edge.sourcePath, edge.trigger);
      if (!slot) {
        return `Transition slot was not found for "${edgeId}".`;
      }

      return writeTransitionAtIndex(slot, edge.index, undefined)
        ? undefined
        : `Transition "${edgeId}" was not found.`;
    });
  };

  public undo = (): DraftCommandResult => {
    const entry = this.undoStack.pop();
    if (!entry) {
      return fail("undo", "There is no draft command to undo.");
    }

    this.redoStack.push(entry);
    this.current = cloneValue(entry.before);
    this.graph = machineConfigToGraph<object, Event, Typegen>(this.current);
    return success("undo", this.graph);
  };

  public redo = (): DraftCommandResult => {
    const entry = this.redoStack.pop();
    if (!entry) {
      return fail("redo", "There is no draft command to redo.");
    }

    this.undoStack.push(entry);
    this.current = cloneValue(entry.after);
    this.graph = machineConfigToGraph<object, Event, Typegen>(this.current);
    return success("redo", this.graph);
  };

  private applyCommand = (
    command: DraftCommandType,
    mutate: (config: MachineConfig<Event, Typegen>) => string | undefined,
  ): DraftCommandResult => {
    const before = cloneValue(this.current);
    const next = cloneValue(this.current);
    const error = mutate(next);

    if (error) {
      return fail(command, error);
    }

    this.current = next;
    this.graph = machineConfigToGraph<object, Event, Typegen>(this.current);
    this.undoStack.push({
      command,
      before,
      after: cloneValue(this.current),
    });
    this.redoStack.length = 0;

    return success(command, this.graph);
  };

  private rewriteTargetsForRenamedState = (
    config: MachineConfig<Event, Typegen>,
    previousGraph: GraphModel,
    oldPath: readonly string[],
    newPath: readonly string[],
  ): void => {
    previousGraph.edges.forEach((edge) => {
      if (!edge.targetPath || !startsWithPath(edge.targetPath, oldPath)) {
        return;
      }

      const slot = getTransitionSlot(config, edge.sourcePath, edge.trigger);
      if (!slot) {
        return;
      }

      const transition = normalizeTransition(slot.get())[edge.index];
      if (!transition) {
        return;
      }

      writeTransitionAtIndex(
        slot,
        edge.index,
        updateTransitionTarget(transition, edge, config.id, oldPath, newPath),
      );
    });
  };
}

export const createDraftModel = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
): DraftModel<Event, Typegen> => {
  return new MachineDraftModel(config);
};

export const validateDraftConfig = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
): readonly DevtoolsDiagnostic[] => {
  return validateMachineConfigForDevtools<object, Event, Typegen>(config);
};
