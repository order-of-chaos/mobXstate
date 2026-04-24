import { computed as mobxComputed, runInAction } from "mobx";

import type {
  EventObject,
  Machine,
  MachineAction,
  MachineActionObject,
  MachineActionReference,
  MachineCondition,
  MachineDelay,
  MachineDelayTransition,
  MachineEffect,
  MachineGuard,
  MachineInvokeConfig,
  MachineOptions,
  MachineSendEvent,
  MachineStateNodeConfig,
  MachineStateValue,
  MachineTransition,
  MachineTransitionConfig,
  RuntimeMachine,
  TypegenConstraint,
  TypegenDisabled,
} from "./stateMachine";

export enum MachineActorStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2,
}

export interface MachineSnapshot<Event extends EventObject> {
  readonly value: MachineStateValue;
  readonly event: Event | undefined;
  matches(state: MachineStateValue): boolean;
}

export class MachineCleanupError extends Error {
  public readonly errors: readonly unknown[];

  constructor(message: string, errors: readonly unknown[]) {
    super(message);
    this.name = "MachineCleanupError";
    this.errors = [...errors];
  }
}

type RuntimeOptions<Scope extends object, Event extends EventObject> = {
  actions?: Record<string, MachineAction<Scope, Event>>;
  guards?: Record<string, MachineGuard<Scope, Event>>;
  effects?: Record<string, MachineEffect<Scope, Event>>;
  delays?: Record<string, MachineDelay<Scope, Event>>;
};

export interface MachineActorConfig {
  readonly strict?: boolean;
}

type Callable = (...args: unknown[]) => unknown;

type MachineSubscriber<Event extends EventObject> = (
  snapshot: MachineSnapshot<Event>,
) => void;

interface RuntimeNode<Event extends EventObject> {
  readonly key: string;
  readonly path: string[];
  readonly config: MachineStateNodeConfig<Event>;
  readonly parent: RuntimeNode<Event> | undefined;
  readonly children: Map<string, RuntimeNode<Event>>;
}

interface PickedTransition<Event extends EventObject> {
  readonly transition: MachineTransitionConfig<Event>;
  readonly index: number;
}

interface SelectedTransition<Event extends EventObject>
  extends PickedTransition<Event> {
  readonly source: RuntimeNode<Event>;
}

interface InvokeActor<Event extends EventObject> {
  readonly id: string;
  readonly autoForward: boolean;
  send(event: Event): void;
  stop(): void;
}

interface NodeEffects<Event extends EventObject> {
  readonly timers: Set<ReturnType<typeof setTimeout>>;
  readonly invokes: Map<string, InvokeActor<Event>>;
}

interface SendActionObject extends MachineActionObject {
  type: "xstate.send";
  event: unknown;
  to?: unknown;
}

const pathKey = (path: readonly string[]): string => path.join(".");

const pathsEqual = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  return left.length === right.length && left.every((part, index) => part === right[index]);
};

const isDescendantPath = (
  path: readonly string[],
  parent: readonly string[],
): boolean => {
  return parent.every((part, index) => path[index] === part);
};

const commonPath = (paths: readonly string[][]): string[] => {
  const [first] = paths;
  if (!first) {
    return [];
  }

  const result: string[] = [];
  for (let index = 0; index < first.length; index += 1) {
    const part = first[index];
    if (paths.every((path) => path[index] === part)) {
      result.push(part);
      continue;
    }

    break;
  }

  return result;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return isObjectRecord(value) && typeof value.then === "function";
};

const isCallable = (value: unknown): value is Callable => {
  return typeof value === "function";
};

const isRuntimeMachine = (value: unknown): value is RuntimeMachine => {
  return (
    isObjectRecord(value) &&
    typeof value.id === "string" &&
    isObjectRecord(value.config)
  );
};

const isSendActionObject = (
  action: MachineActionObject,
): action is SendActionObject => action.type === "xstate.send";

const isActionObject = (value: unknown): value is MachineActionObject => {
  return isObjectRecord(value) && typeof value.type === "string";
};

const findPropertyDescriptor = (
  source: object,
  name: string,
): PropertyDescriptor | undefined => {
  let current: object | null = source;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) {
      return descriptor;
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
};

const normalizeActionReferences = (
  value: MachineActionReference | undefined,
): Array<string | MachineActionObject> => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const normalizeInvokeConfigs = <Event extends EventObject>(
  value: MachineStateNodeConfig<Event>["invoke"],
): Array<MachineInvokeConfig<Event> | RuntimeMachine> => {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.map((invokeConfig) => {
    if (typeof invokeConfig === "string") {
      return {
        id: invokeConfig,
        src: invokeConfig,
      };
    }

    return invokeConfig;
  });
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

const hasStateChildren = <Event extends EventObject>(
  node: RuntimeNode<Event>,
): boolean => {
  return Array.from(node.children.values()).some((child) => !isHistoryNode(child));
};

const isParallelNode = <Event extends EventObject>(
  node: RuntimeNode<Event>,
): boolean => node.config.type === "parallel";

const isFinalNode = <Event extends EventObject>(
  node: RuntimeNode<Event>,
): boolean => node.config.type === "final";

const isHistoryNode = <Event extends EventObject>(
  node: RuntimeNode<Event>,
): boolean => node.config.type === "history" || node.config.history !== undefined;

const toRuntimeOptions = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  value: MachineOptions<Scope, Event, Typegen> | undefined,
): RuntimeOptions<Scope, Event> => {
  return (value ?? {}) as unknown as RuntimeOptions<Scope, Event>;
};

const createNodeTree = <Event extends EventObject>(
  key: string,
  path: string[],
  config: MachineStateNodeConfig<Event>,
  parent: RuntimeNode<Event> | undefined,
  nodes: Map<string, RuntimeNode<Event>>,
): RuntimeNode<Event> => {
  const node: RuntimeNode<Event> = {
    key,
    path,
    config,
    parent,
    children: new Map(),
  };

  nodes.set(pathKey(path), node);

  Object.entries(config.states ?? {}).forEach(([childKey, childConfig]) => {
    node.children.set(
      childKey,
      createNodeTree(childKey, [...path, childKey], childConfig, node, nodes),
    );
  });

  return node;
};

const eventFromType = <Event extends EventObject>(type: string): Event => {
  return { type } as unknown as Event;
};

const doneStateEvent = <Event extends EventObject>(
  machineId: string,
  node: RuntimeNode<Event>,
): Event => {
  const suffix = node.path.length > 0 ? `.${pathKey(node.path)}` : "";
  return eventFromType(`done.state.${machineId}${suffix}`);
};

const doneInvokeEvent = <Event extends EventObject>(
  id: string,
  data?: unknown,
): Event => {
  return { type: `done.invoke.${id}`, data } as unknown as Event;
};

const errorInvokeEvent = <Event extends EventObject>(
  id: string,
  data: unknown,
): Event => {
  return { type: `error.platform.${id}`, data } as unknown as Event;
};

export class MachineActor<
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  public status = MachineActorStatus.NotStarted;

  public snapshot: MachineSnapshot<Event> | undefined;

  private readonly root: RuntimeNode<Event>;

  private readonly nodes = new Map<string, RuntimeNode<Event>>();

  private readonly options: RuntimeOptions<Scope, Event>;

  private readonly subscribers = new Set<MachineSubscriber<Event>>();

  private readonly stopSubscribers = new Set<() => void>();

  private readonly effects = new Map<string, NodeEffects<Event>>();

  private readonly history = new Map<string, MachineStateValue>();

  private readonly completed = new Set<string>();

  private activePaths: string[][] = [];

  private queue: Event[] = [];

  private processing = false;

  private rootDoneNotified = false;

  constructor(
    private readonly machine: Machine<Event, Typegen>,
    options: MachineOptions<Scope, Event, Typegen> | undefined,
    private readonly scope: Scope | undefined,
    private readonly onDone?: (event: Event) => void,
    private readonly config: MachineActorConfig = {},
  ) {
    this.options = toRuntimeOptions(options);
    this.root = createNodeTree(
      machine.id,
      [],
      machine.config,
      undefined,
      this.nodes,
    );
    this.validateMachineConfig();
  }

  private validateMachineConfig = (): void => {
    Array.from(this.nodes.values()).forEach((node) => {
      this.validateInitialState(node);
      this.validateHistoryState(node);
      this.validateStateTransitions(node);
    });
  };

  private validateInitialState = (node: RuntimeNode<Event>): void => {
    const initial = node.config.initial;
    if (initial === undefined || node.children.has(initial)) {
      return;
    }

    throw new Error(
      `Unknown initial state "${initial}" in state "${this.formatNodePath(node)}" of machine "${this.machine.id}".`,
    );
  };

  private validateHistoryState = (node: RuntimeNode<Event>): void => {
    if (node.config.history !== "deep") {
      return;
    }

    throw new Error(
      `Deep history is not supported in state "${this.formatNodePath(node)}" of machine "${this.machine.id}".`,
    );
  };

  private validateStateTransitions = (node: RuntimeNode<Event>): void => {
    Object.values(node.config.on ?? {}).forEach((transition) => {
      this.validateTransitionTargets(node, transition);
    });

    this.validateTransitionTargets(node, node.config.always);

    Object.values(node.config.after ?? {}).forEach((transition) => {
      this.validateTransitionTargets(node, transition);
    });

    this.validateTransitionTargets(node, node.config.onDone);

    normalizeInvokeConfigs(node.config.invoke).forEach((invokeConfig) => {
      if (isRuntimeMachine(invokeConfig)) {
        return;
      }

      this.validateTransitionTargets(node, invokeConfig.onDone);
      this.validateTransitionTargets(node, invokeConfig.onError);
    });
  };

  private validateTransitionTargets = (
    source: RuntimeNode<Event>,
    value: MachineTransition<Event> | MachineDelayTransition<Event> | undefined,
  ): void => {
    normalizeTransition(value).forEach((transition) => {
      if (transition.target === undefined) {
        return;
      }

      if (this.resolveTargetNode(source, transition.target)) {
        return;
      }

      throw new Error(
        `Unknown transition target "${transition.target}" from state "${this.formatNodePath(source)}" in machine "${this.machine.id}".`,
      );
    });
  };

  private validateStrictImplementations = (): void => {
    if (this.config.strict !== true) {
      return;
    }

    Array.from(this.nodes.values()).forEach((node) => {
      this.validateActionImplementations(node, node.config.entry);
      this.validateActionImplementations(node, node.config.exit);

      Object.values(node.config.on ?? {}).forEach((transition) => {
        this.validateTransitionImplementations(node, transition);
      });

      this.validateTransitionImplementations(node, node.config.always);

      Object.entries(node.config.after ?? {}).forEach(([delayName, transition]) => {
        this.validateDelayImplementation(node, delayName);
        this.validateTransitionImplementations(node, transition);
      });

      this.validateTransitionImplementations(node, node.config.onDone);

      normalizeInvokeConfigs(node.config.invoke).forEach((invokeConfig) => {
        if (isRuntimeMachine(invokeConfig)) {
          return;
        }

        this.validateEffectImplementation(node, invokeConfig.src);
        this.validateTransitionImplementations(node, invokeConfig.onDone);
        this.validateTransitionImplementations(node, invokeConfig.onError);
      });
    });
  };

  private validateTransitionImplementations = (
    source: RuntimeNode<Event>,
    value: MachineTransition<Event> | MachineDelayTransition<Event> | undefined,
  ): void => {
    normalizeTransition(value).forEach((transition) => {
      this.validateGuardImplementation(source, transition.cond);
      this.validateActionImplementations(source, transition.actions);
    });
  };

  private validateActionImplementations = (
    source: RuntimeNode<Event>,
    value: MachineActionReference | undefined,
  ): void => {
    normalizeActionReferences(value).forEach((action) => {
      if (typeof action !== "string" && isSendActionObject(action)) {
        return;
      }

      const name = typeof action === "string" ? action : action.type;
      if (this.hasActionImplementation(name)) {
        return;
      }

      this.throwMissingImplementation("action", name, source);
    });
  };

  private validateGuardImplementation = (
    source: RuntimeNode<Event>,
    condition: MachineCondition<Event> | undefined,
  ): void => {
    if (!condition || typeof condition === "function") {
      return;
    }

    const name = typeof condition === "string" ? condition : condition.type;
    if (this.hasGuardImplementation(name)) {
      return;
    }

    this.throwMissingImplementation("guard", name, source);
  };

  private validateDelayImplementation = (
    source: RuntimeNode<Event>,
    delayName: string,
  ): void => {
    if (Number.isFinite(Number(delayName)) || this.hasDelayImplementation(delayName)) {
      return;
    }

    this.throwMissingImplementation("delay", delayName, source);
  };

  private validateEffectImplementation = (
    source: RuntimeNode<Event>,
    name: string,
  ): void => {
    if (this.hasEffectImplementation(name)) {
      return;
    }

    this.throwMissingImplementation("effect", name, source);
  };

  private hasActionImplementation = (name: string): boolean => {
    return (
      this.hasCallableScopeMember(name) ||
      this.options.actions?.[name] !== undefined
    );
  };

  private hasGuardImplementation = (name: string): boolean => {
    return (
      this.hasCallableScopeMember(name) ||
      this.hasScopeGetter(name) ||
      this.hasScopeValue(name, "boolean") ||
      this.options.guards?.[name] !== undefined
    );
  };

  private hasDelayImplementation = (name: string): boolean => {
    return (
      this.hasCallableScopeMember(name) ||
      this.hasScopeGetter(name) ||
      this.hasScopeValue(name, "number") ||
      this.options.delays?.[name] !== undefined
    );
  };

  private hasEffectImplementation = (name: string): boolean => {
    return (
      this.hasCallableScopeMember(name) ||
      this.options.effects?.[name] !== undefined
    );
  };

  private hasCallableScopeMember = (name: string): boolean => {
    const descriptor = this.getScopeDescriptor(name);
    return isCallable(descriptor?.value);
  };

  private hasScopeGetter = (name: string): boolean => {
    return isCallable(this.getScopeDescriptor(name)?.get);
  };

  private hasScopeValue = (
    name: string,
    type: "boolean" | "number",
  ): boolean => {
    const descriptor = this.getScopeDescriptor(name);
    return descriptor?.get === undefined && typeof descriptor?.value === type;
  };

  private getScopeDescriptor = (name: string): PropertyDescriptor | undefined => {
    return this.scope ? findPropertyDescriptor(this.scope, name) : undefined;
  };

  private throwMissingImplementation = (
    kind: "action" | "guard" | "delay" | "effect",
    name: string,
    source: RuntimeNode<Event>,
  ): never => {
    throw new Error(
      `Missing ${kind} implementation "${name}" referenced from state "${this.formatNodePath(source)}" in machine "${this.machine.id}".`,
    );
  };

  private formatNodePath = (node: RuntimeNode<Event>): string => {
    return pathKey(node.path) || this.machine.id;
  };

  public subscribe = (
    subscriber: MachineSubscriber<Event>,
  ): (() => void) => {
    this.subscribers.add(subscriber);

    if (this.snapshot) {
      subscriber(this.snapshot);
    }

    return () => {
      this.subscribers.delete(subscriber);
    };
  };

  public onStop = (subscriber: () => void): (() => void) => {
    this.stopSubscribers.add(subscriber);

    return () => {
      this.stopSubscribers.delete(subscriber);
    };
  };

  public canRestoreStateValue = (value: MachineStateValue): boolean => {
    return this.getLeafPathsFromValue(this.root, value) !== undefined;
  };

  public start = (value?: MachineStateValue): MachineActorStatus => {
    if (this.status === MachineActorStatus.Running) {
      return this.status;
    }

    this.validateStrictImplementations();

    this.status = MachineActorStatus.Running;
    this.rootDoneNotified = false;
    this.completed.clear();
    this.activePaths = this.resolveInitialValue(value);

    const initEvent = eventFromType<Event>("xstate.init");
    this.processing = true;
    try {
      this.runMacrostep(() => {
        this.enterNode(this.root, initEvent);
        this.getEntryNodes([], this.activePaths).forEach((node) => {
          this.enterNode(node, initEvent);
        });
        this.processStableTransitions(initEvent);
        this.publish(initEvent);
      });
      this.processing = false;
      this.flushQueue();
    } catch (error) {
      this.processing = false;
      this.stopAfterRuntimeError(error);
    }

    return this.status;
  };

  public stop = (): void => {
    if (this.status !== MachineActorStatus.Running) {
      return;
    }

    const stopEvent = eventFromType<Event>("xstate.stop");
    try {
      this.runMacrostep(() => {
        this.getExitNodes(this.root, []).forEach((node) => {
          this.exitNode(node, stopEvent);
        });
        this.exitNode(this.root, stopEvent);
        this.finishStop();
      });
    } catch (error) {
      this.stopAllEffects();
      this.finishStop();
      throw error;
    }
  };

  public send = (event: MachineSendEvent<Event>): void => {
    if (this.status !== MachineActorStatus.Running) {
      return;
    }

    const normalizedEvent = this.toEvent(event);
    if (this.processing) {
      this.queue.push(normalizedEvent);
      return;
    }

    this.processing = true;
    try {
      this.runMacrostep(() => {
        this.processQueuedEvent(normalizedEvent);
      });
      this.processing = false;
      this.flushQueue();
    } catch (error) {
      this.processing = false;
      this.stopAfterRuntimeError(error);
    }
  };

  private flushQueue = (): void => {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (
        this.status === MachineActorStatus.Running &&
        this.queue.length > 0
      ) {
        const event = this.queue.shift();
        if (event) {
          this.runMacrostep(() => {
            this.processQueuedEvent(event);
          });
        }
      }
      this.processing = false;
    } catch (error) {
      this.processing = false;
      this.stopAfterRuntimeError(error);
    }
  };

  private runMacrostep = <Result>(run: () => Result): Result => {
    return runInAction(run);
  };

  private stopAfterRuntimeError = (error: unknown): never => {
    this.queue = [];

    let cleanupError: MachineCleanupError | undefined;
    try {
      this.stopAllEffects();
    } catch (stopError) {
      if (stopError instanceof MachineCleanupError) {
        cleanupError = stopError;
      } else {
        cleanupError = this.createCleanupError([stopError]);
      }
    }

    this.finishStop();

    if (cleanupError) {
      throw new MachineCleanupError(
        `State machine "${this.machine.id}" stopped after a runtime error, but cleanup also failed.`,
        [error, ...cleanupError.errors],
      );
    }

    throw error;
  };

  private finishStop = (): void => {
    this.activePaths = [];
    this.status = MachineActorStatus.Stopped;
    this.stopSubscribers.forEach((subscriber) => subscriber());
  };

  private processQueuedEvent = (event: Event): void => {
    this.processEvent(event);
    this.forwardEventToInvokedMachines(event);
    this.processStableTransitions(event);
  };

  private processEvent = (event: Event): void => {
    const selectedTransitions = this.selectTransitions(event);

    selectedTransitions.forEach((selected) => {
      if (this.isTransitionSourceActive(selected.source)) {
        this.executeTransition(selected.source, selected.transition, event);
      }
    });
  };

  private selectTransitions = (event: Event): Array<SelectedTransition<Event>> => {
    const transitions: Array<SelectedTransition<Event>> = [];
    const dedupe = new Set<string>();

    this.activePaths.forEach((path) => {
      let node: RuntimeNode<Event> | undefined = this.getNode(path);

      while (node) {
        const transition = this.pickTransition(node.config.on?.[event.type], event);

        if (transition) {
          const key = `${pathKey(node.path)}:${transition.index}`;
          if (!dedupe.has(key)) {
            dedupe.add(key);
            transitions.push({
              ...transition,
              source: node,
            });
          }
          break;
        }

        node = node.parent;
      }
    });

    return transitions
      .sort((left, right) => right.source.path.length - left.source.path.length)
      .filter((transition, index, list) => {
        return !list.slice(0, index).some((other) => {
          return (
            isDescendantPath(transition.source.path, other.source.path) ||
            isDescendantPath(other.source.path, transition.source.path)
          );
        });
      });
  };

  private processStableTransitions = (event: Event): void => {
    let steps = 0;

    while (this.status === MachineActorStatus.Running && steps < 100) {
      steps += 1;

      const doneTransition = this.findDoneTransition();
      if (doneTransition) {
        this.executeTransition(
          doneTransition.source,
          doneTransition.transition,
          doneStateEvent(this.machine.id, doneTransition.source),
        );
        continue;
      }

      const alwaysTransition = this.findAlwaysTransition(event);
      if (alwaysTransition) {
        this.executeTransition(
          alwaysTransition.source,
          alwaysTransition.transition,
          event,
        );
        continue;
      }

      this.notifyRootDone();
      return;
    }

    if (steps >= 100) {
      throw new Error("State machine transient transitions did not stabilize.");
    }
  };

  private findDoneTransition = (): SelectedTransition<Event> | undefined => {
    const doneNodes = Array.from(this.nodes.values())
      .filter((node) => node.config.onDone && this.isNodeDone(node))
      .sort((left, right) => right.path.length - left.path.length);

    for (const node of doneNodes) {
      const key = pathKey(node.path);
      if (this.completed.has(key)) {
        continue;
      }

      const event = doneStateEvent<Event>(this.machine.id, node);
      const transition = this.pickTransition(node.config.onDone, event);
      if (transition) {
        this.completed.add(key);
        return {
          ...transition,
          source: node,
        };
      }
    }

    return undefined;
  };

  private findAlwaysTransition = (
    event: Event,
  ): SelectedTransition<Event> | undefined => {
    for (const path of this.activePaths) {
      let node: RuntimeNode<Event> | undefined = this.getNode(path);

      while (node) {
        const transition = this.pickTransition(node.config.always, event);
        if (transition) {
          return {
            ...transition,
            source: node,
          };
        }

        node = node.parent;
      }
    }

    return undefined;
  };

  private pickTransition = (
    value: MachineTransition<Event> | MachineDelayTransition<Event> | undefined,
    event: Event,
  ): PickedTransition<Event> | undefined => {
    const transitions = normalizeTransition(value);

    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index];
      if (this.isConditionAllowed(transition.cond, event)) {
        return { transition, index };
      }
    }

    return undefined;
  };

  private executeTransition = (
    source: RuntimeNode<Event>,
    transition: MachineTransitionConfig<Event>,
    event: Event,
  ): void => {
    const targets =
      transition.target === undefined
        ? []
        : this.resolveTargetLeafPaths(source, transition.target);

    if (transition.target === undefined) {
      this.executeActions(transition.actions, event);
      return;
    }

    const boundary = this.getExitBoundary(source, targets, transition);
    const exitNodes = this.getExitNodes(source, boundary);
    this.storeHistory(exitNodes);
    exitNodes.forEach((node) => {
      this.exitNode(node, event);
    });

    const retainedPaths = this.activePaths.filter((path) => {
      return !isDescendantPath(path, source.path);
    });

    this.activePaths = retainedPaths;
    this.executeActions(transition.actions, event);
    this.activePaths = this.mergeActivePaths([...retainedPaths, ...targets]);

    this.getEntryNodes(boundary, targets).forEach((node) => {
      this.enterNode(node, event);
    });

    this.publish(event);
  };

  private getExitBoundary = (
    source: RuntimeNode<Event>,
    targets: readonly string[][],
    transition: MachineTransitionConfig<Event>,
  ): string[] => {
    if (targets.length === 0) {
      return transition.internal === true
        ? source.path
        : source.parent?.path ?? [];
    }

    if (transition.internal === true) {
      return source.path;
    }

    const boundary = commonPath([source.path, ...targets]);
    const isSelfTransition =
      targets.length === 1 && pathsEqual(source.path, targets[0]);

    if (isSelfTransition) {
      return source.parent?.path ?? [];
    }

    return boundary;
  };

  private getExitNodes = (
    source: RuntimeNode<Event>,
    boundary: readonly string[],
  ): Array<RuntimeNode<Event>> => {
    const nodes = new Map<string, RuntimeNode<Event>>();

    this.activePaths
      .filter((path) => isDescendantPath(path, source.path))
      .forEach((path) => {
        for (let length = path.length; length > boundary.length; length -= 1) {
          const node = this.getNode(path.slice(0, length));
          nodes.set(pathKey(node.path), node);
        }
      });

    return Array.from(nodes.values()).sort(
      (left, right) => right.path.length - left.path.length,
    );
  };

  private getEntryNodes = (
    boundary: readonly string[],
    targets: readonly string[][],
  ): Array<RuntimeNode<Event>> => {
    const nodes = new Map<string, RuntimeNode<Event>>();

    targets.forEach((target) => {
      for (let length = boundary.length + 1; length <= target.length; length += 1) {
        const node = this.getNode(target.slice(0, length));
        nodes.set(pathKey(node.path), node);
      }
    });

    return Array.from(nodes.values()).sort(
      (left, right) => left.path.length - right.path.length,
    );
  };

  private enterNode = (node: RuntimeNode<Event>, event: Event): void => {
    this.executeActions(node.config.entry, event);
    this.startInvokes(node, event);
    if (this.status === MachineActorStatus.Running && this.isTransitionSourceActive(node)) {
      this.startDelayedTransitions(node, event);
    }
  };

  private exitNode = (node: RuntimeNode<Event>, event: Event): void => {
    this.stopNodeEffects(node);
    this.executeActions(node.config.exit, event);
    this.clearCompletedNodes(node);
  };

  private executeActions = (
    value: MachineActionReference | undefined,
    event: Event,
  ): void => {
    normalizeActionReferences(value).forEach((action) => {
      if (typeof action === "string") {
        this.executeNamedAction(action, { type: action }, event);
        return;
      }

      if (isSendActionObject(action)) {
        this.executeSendAction(action, event);
        return;
      }

      this.executeNamedAction(action.type, action, event);
    });
  };

  private executeNamedAction = (
    name: string,
    action: MachineActionObject,
    event: Event,
  ): void => {
    if (!this.scope) {
      return;
    }

    const scope = this.scope;
    const storeAction = this.getScopeMember(name);

    if (isCallable(storeAction)) {
      runInAction(() => {
        storeAction.call(scope, event, {
          action,
          event,
        });
      });
      return;
    }

    const implementation = this.options.actions?.[name];
    if (!implementation) {
      return;
    }

    runInAction(() => {
      implementation.call(scope, event, {
        action,
        event,
      });
    });
  };

  private executeSendAction = (
    action: SendActionObject,
    currentEvent: Event,
  ): void => {
    const event = isActionObject(action.event)
      ? this.toEvent(action.event as unknown as Event)
      : typeof action.event === "string"
        ? eventFromType<Event>(action.event)
        : currentEvent;

    if (typeof action.to === "string") {
      this.sendToInvoke(action.to, event);
      return;
    }

    this.send(event);
  };

  private isConditionAllowed = (
    condition: MachineCondition<Event> | undefined,
    event: Event,
  ): boolean => {
    if (!condition) {
      return true;
    }

    if (typeof condition === "function") {
      return mobxComputed(() =>
        condition(undefined, event, {
          cond: "inline",
          event,
        }),
      ).get();
    }

    const name = typeof condition === "string" ? condition : condition.type;
    if (!this.scope) {
      return false;
    }

    const scope = this.scope;

    const storeGuard = mobxComputed<boolean | undefined>(() => {
      const member = this.getScopeMember(name);

      if (isCallable(member)) {
        return Boolean(
          member.call(scope, event, {
            cond: condition,
            event,
          }),
        );
      }

      return typeof member === "boolean" ? member : undefined;
    }).get();

    if (storeGuard !== undefined) {
      return storeGuard;
    }

    const implementation = this.options.guards?.[name];
    if (!implementation) {
      return false;
    }

    return mobxComputed(() =>
      implementation.call(scope, event, {
        cond: condition,
        event,
      }),
    ).get();
  };

  private startDelayedTransitions = (
    node: RuntimeNode<Event>,
    event: Event,
  ): void => {
    Object.entries(node.config.after ?? {}).forEach(([delayName, transition]) => {
      const delay = this.resolveDelay(delayName, event);
      if (delay === undefined) {
        return;
      }

      const timer = setTimeout(() => {
        if (
          this.status !== MachineActorStatus.Running ||
          !this.isTransitionSourceActive(node)
        ) {
          return;
        }

        const delayedEvent = eventFromType<Event>(
          `xstate.after(${delayName})#${this.machine.id}.${pathKey(node.path)}`,
        );
        const picked = this.pickTransition(transition, delayedEvent);

        if (picked) {
          this.processing = true;
          try {
            this.runMacrostep(() => {
              this.executeTransition(node, picked.transition, delayedEvent);
              this.processStableTransitions(delayedEvent);
            });
            this.processing = false;
            this.flushQueue();
          } catch (error) {
            this.processing = false;
            this.stopAfterRuntimeError(error);
          }
        }
      }, delay);

      this.getEffects(node).timers.add(timer);
    });
  };

  private resolveDelay = (
    delayName: string,
    event: Event,
  ): number | undefined => {
    const numericDelay = Number(delayName);
    if (Number.isFinite(numericDelay)) {
      return numericDelay;
    }

    if (this.scope) {
      const scope = this.scope;
      const storeDelay = mobxComputed<number | undefined>(() => {
        const member = this.getScopeMember(delayName);

        if (typeof member === "number") {
          return member;
        }

        if (isCallable(member)) {
          const value = member.call(scope, event);
          return typeof value === "number" ? value : undefined;
        }

        return undefined;
      }).get();

      if (storeDelay !== undefined) {
        return storeDelay;
      }
    }

    const delay = this.options.delays?.[delayName];
    if (typeof delay === "number") {
      return delay;
    }

    if (typeof delay === "function" && this.scope) {
      const scope = this.scope;
      return mobxComputed(() => delay.call(scope, event)).get();
    }

    return undefined;
  };

  private startInvokes = (node: RuntimeNode<Event>, event: Event): void => {
    normalizeInvokeConfigs(node.config.invoke).forEach((invokeConfig, index) => {
      const normalized =
        isRuntimeMachine(invokeConfig)
          ? {
              id: invokeConfig.id,
              src: invokeConfig.id,
            }
          : invokeConfig;

      const id = normalized.id ?? `${pathKey(node.path)}:invoke:${index}`;
      const actor = isRuntimeMachine(invokeConfig)
        ? this.createInvokedMachineActor(id, invokeConfig, normalized.autoForward)
        : this.createInvokeActor(node, id, normalized, event);

      if (actor) {
        this.getEffects(node).invokes.set(id, actor);
      }
    });
  };

  private createInvokeActor = (
    node: RuntimeNode<Event>,
    id: string,
    invokeConfig: MachineInvokeConfig<Event>,
    event: Event,
  ): InvokeActor<Event> | undefined => {
    if (!this.scope) {
      return undefined;
    }

    const scope = this.scope;
    const storeEffect = this.getScopeMember(invokeConfig.src);

    if (isCallable(storeEffect)) {
      return this.createEffectActorFromResult(node, id, invokeConfig, () => {
        return storeEffect.call(scope, event, {
          src: invokeConfig.src,
        });
      });
    }

    const effect = this.options.effects?.[invokeConfig.src];
    if (effect) {
      return this.createEffectActorFromResult(node, id, invokeConfig, () => {
        return effect.call(scope, event, {
          src: invokeConfig.src,
        });
      });
    }

    return undefined;
  };

  private createEffectActorFromResult = (
    node: RuntimeNode<Event>,
    id: string,
    invokeConfig: MachineInvokeConfig<Event>,
    run: () => unknown,
  ): InvokeActor<Event> | undefined => {
    let result: unknown;

    try {
      result = runInAction(run);
    } catch (error) {
      this.handleInvokeError(node, invokeConfig, id, error);
      return undefined;
    }

    return this.resolveEffectResult(node, id, invokeConfig, result);
  };

  private resolveEffectResult = (
    node: RuntimeNode<Event>,
    id: string,
    invokeConfig: MachineInvokeConfig<Event>,
    result: unknown,
  ): InvokeActor<Event> | undefined => {
    if (isPromiseLike(result)) {
      let active = true;

      result.then(
        (data) => {
          if (active && this.isTransitionSourceActive(node)) {
            this.handleInvokeDone(node, invokeConfig, id, data);
          }
        },
        (error) => {
          if (active && this.isTransitionSourceActive(node)) {
            this.handleInvokeError(node, invokeConfig, id, error);
          }
        },
      );

      return {
        id,
        autoForward: invokeConfig.autoForward ?? false,
        send: () => undefined,
        stop: () => {
          active = false;
        },
      };
    }

    if (isRuntimeMachine(result)) {
      return this.createInvokedMachineActor(
        id,
        result,
        invokeConfig.autoForward,
        (doneEvent) => {
          this.handleInvokeDone(node, invokeConfig, id, doneEvent);
        },
      );
    }

    if (isCallable(result)) {
      return {
        id,
        autoForward: invokeConfig.autoForward ?? false,
        send: () => undefined,
        stop: () => {
          runInAction(() => {
            result();
          });
        },
      };
    }

    if (result !== undefined && this.config.strict === true) {
      this.throwInvalidInvokeReturn(invokeConfig.src, node);
    }

    return undefined;
  };

  private throwInvalidInvokeReturn = (
    name: string,
    source: RuntimeNode<Event>,
  ): never => {
    throw new Error(
      `Invalid effect return value from "${name}" in state "${this.formatNodePath(source)}" of machine "${this.machine.id}". Expected void, cleanup function, promise-like object or child machine.`,
    );
  };

  private createInvokedMachineActor = (
    id: string,
    machine: RuntimeMachine,
    autoForward: boolean | undefined,
    onDone?: (event: Event) => void,
  ): InvokeActor<Event> => {
    const actor = new MachineActor<object, Event>(
      machine as Machine<Event>,
      undefined,
      undefined,
      onDone ?? ((event) => this.send(event)),
      this.config,
    );
    actor.start();

    return {
      id,
      autoForward: autoForward ?? false,
      send: (event) => {
        actor.send(event);
      },
      stop: () => {
        actor.stop();
      },
    };
  };

  private handleInvokeDone = (
    node: RuntimeNode<Event>,
    invokeConfig: MachineInvokeConfig<Event>,
    id: string,
    data: unknown,
  ): void => {
    const event = doneInvokeEvent<Event>(id, data);
    const transition = this.pickTransition(invokeConfig.onDone, event);

    this.processing = true;
    try {
      this.runMacrostep(() => {
        if (transition && this.isTransitionSourceActive(node)) {
          this.executeTransition(node, transition.transition, event);
        } else {
          this.send(event);
        }
        this.processStableTransitions(event);
      });
      this.processing = false;
      this.flushQueue();
    } catch (error) {
      this.processing = false;
      this.stopAfterRuntimeError(error);
    }
  };

  private handleInvokeError = (
    node: RuntimeNode<Event>,
    invokeConfig: MachineInvokeConfig<Event>,
    id: string,
    error: unknown,
  ): void => {
    const event = errorInvokeEvent<Event>(id, error);
    const transition = this.pickTransition(invokeConfig.onError, event);

    this.processing = true;
    try {
      this.runMacrostep(() => {
        if (transition && this.isTransitionSourceActive(node)) {
          this.executeTransition(node, transition.transition, event);
        } else {
          this.send(event);
        }
        this.processStableTransitions(event);
      });
      this.processing = false;
      this.flushQueue();
    } catch (error) {
      this.processing = false;
      this.stopAfterRuntimeError(error);
    }
  };

  private sendToInvoke = (id: string, event: Event): void => {
    this.effects.forEach((effects) => {
      effects.invokes.get(id)?.send(event);
    });
  };

  private forwardEventToInvokedMachines = (event: Event): void => {
    this.effects.forEach((effects) => {
      effects.invokes.forEach((actor) => {
        if (actor.autoForward) {
          actor.send(event);
        }
      });
    });
  };

  private stopNodeEffects = (node: RuntimeNode<Event>): void => {
    const effects = this.effects.get(pathKey(node.path));
    if (!effects) {
      return;
    }

    const errors: unknown[] = [];
    effects.timers.forEach((timer) => clearTimeout(timer));
    effects.invokes.forEach((actor) => {
      this.collectCleanupError(errors, () => {
        actor.stop();
      });
    });
    this.effects.delete(pathKey(node.path));

    if (errors.length > 0) {
      throw this.createCleanupError(errors);
    }
  };

  private stopAllEffects = (): void => {
    const errors: unknown[] = [];

    Array.from(this.effects.keys()).forEach((key) => {
      const effects = this.effects.get(key);
      if (!effects) {
        return;
      }

      effects.timers.forEach((timer) => clearTimeout(timer));
      effects.invokes.forEach((actor) => {
        this.collectCleanupError(errors, () => {
          actor.stop();
        });
      });
      this.effects.delete(key);
    });

    if (errors.length > 0) {
      throw this.createCleanupError(errors);
    }
  };

  private collectCleanupError = (
    errors: unknown[],
    cleanup: () => void,
  ): void => {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
    }
  };

  private createCleanupError = (
    errors: readonly unknown[],
  ): MachineCleanupError => {
    return new MachineCleanupError(
      `State machine "${this.machine.id}" cleanup failed with ${errors.length} error(s).`,
      errors,
    );
  };

  private getEffects = (node: RuntimeNode<Event>): NodeEffects<Event> => {
    const key = pathKey(node.path);
    const existing = this.effects.get(key);
    if (existing) {
      return existing;
    }

    const effects: NodeEffects<Event> = {
      timers: new Set(),
      invokes: new Map(),
    };
    this.effects.set(key, effects);
    return effects;
  };

  private storeHistory = (exitNodes: readonly RuntimeNode<Event>[]): void => {
    const historyNodes = new Map<string, RuntimeNode<Event>>();

    exitNodes.forEach((node) => {
      if (this.hasHistoryChild(node)) {
        historyNodes.set(pathKey(node.path), node);
      }

      if (node.parent && this.hasHistoryChild(node.parent)) {
        historyNodes.set(pathKey(node.parent.path), node.parent);
      }
    });

    historyNodes.forEach((node) => {
      this.history.set(pathKey(node.path), this.valueFromNode(node));
    });
  };

  private hasHistoryChild = (node: RuntimeNode<Event>): boolean => {
    return Array.from(node.children.values()).some((child) => isHistoryNode(child));
  };

  private resolveTargetLeafPaths = (
    source: RuntimeNode<Event>,
    target: string,
  ): string[][] => {
    const node = this.resolveTargetNode(source, target);

    if (!node) {
      return [];
    }

    if (isHistoryNode(node)) {
      return this.resolveHistoryLeafPaths(node);
    }

    return this.getInitialLeafPaths(node);
  };

  private resolveTargetNode = (
    source: RuntimeNode<Event>,
    target: string,
  ): RuntimeNode<Event> | undefined => {
    const normalized = target.startsWith(`#${this.machine.id}.`)
      ? target.slice(this.machine.id.length + 2)
      : target.startsWith("#")
        ? target.slice(1)
        : target;

    const relative = normalized.startsWith(".");
    const segments = normalized
      .replace(/^\./, "")
      .split(".")
      .filter(Boolean);

    if (segments[0] === this.machine.id) {
      segments.shift();
    }

    const candidates: string[][] = [];
    if (relative) {
      candidates.push([...source.path, ...segments]);
    } else {
      candidates.push([...(source.parent?.path ?? []), ...segments]);
      candidates.push([...source.path, ...segments]);
      candidates.push(segments);
    }

    for (const candidate of candidates) {
      const node = this.nodes.get(pathKey(candidate));
      if (node) {
        return node;
      }
    }

    return undefined;
  };

  private resolveHistoryLeafPaths = (node: RuntimeNode<Event>): string[][] => {
    const parent = node.parent;
    if (!parent) {
      return this.getInitialLeafPaths(this.root);
    }

    const storedValue = this.history.get(pathKey(parent.path));
    if (storedValue !== undefined) {
      const restored = this.getLeafPathsFromValue(parent, storedValue);
      if (restored) {
        return restored;
      }
    }

    return this.getInitialLeafPaths(parent);
  };

  private resolveInitialValue = (
    value: MachineStateValue | undefined,
  ): string[][] => {
    if (value === undefined) {
      return this.getInitialLeafPaths(this.root);
    }

    const restored = this.getLeafPathsFromValue(this.root, value);
    return restored ?? this.getInitialLeafPaths(this.root);
  };

  private getInitialLeafPaths = (node: RuntimeNode<Event>): string[][] => {
    if (isHistoryNode(node)) {
      return this.resolveHistoryLeafPaths(node);
    }

    const stateChildren = Array.from(node.children.values()).filter(
      (child) => !isHistoryNode(child),
    );

    if (stateChildren.length === 0) {
      return [node.path];
    }

    if (isParallelNode(node)) {
      return stateChildren.flatMap((child) => this.getInitialLeafPaths(child));
    }

    const initialChild =
      (node.config.initial
        ? node.children.get(node.config.initial)
        : undefined) ?? stateChildren[0];

    return this.getInitialLeafPaths(initialChild);
  };

  private getLeafPathsFromValue = (
    parent: RuntimeNode<Event>,
    value: MachineStateValue,
  ): string[][] | undefined => {
    const stateChildren = Array.from(parent.children.values()).filter(
      (child) => !isHistoryNode(child),
    );

    if (typeof value === "string") {
      if (stateChildren.length === 0) {
        return value === parent.key ? [parent.path] : undefined;
      }

      if (isParallelNode(parent)) {
        return undefined;
      }

      const segments = value.split(".").filter(Boolean);
      if (segments.length === 0) {
        return undefined;
      }

      const node = this.nodes.get(pathKey([...parent.path, ...segments]));
      if (!node || isHistoryNode(node)) {
        return undefined;
      }

      return this.getInitialLeafPaths(node);
    }

    if (stateChildren.length === 0) {
      return undefined;
    }

    const entries = Object.entries(value);
    const childrenByKey = new Map(
      stateChildren.map((child) => [child.key, child]),
    );

    if (isParallelNode(parent)) {
      if (entries.length !== stateChildren.length) {
        return undefined;
      }

      const paths: string[][] = [];
      for (const [key, childValue] of entries) {
        const child = childrenByKey.get(key);
        if (!child) {
          return undefined;
        }

        const childPaths = this.getLeafPathsFromValue(child, childValue);
        if (!childPaths) {
          return undefined;
        }

        paths.push(...childPaths);
      }

      return paths;
    }

    if (entries.length !== 1) {
      return undefined;
    }

    const [[key, childValue]] = entries;
    const child = childrenByKey.get(key);
    if (!child) {
      return undefined;
    }

    return this.getLeafPathsFromValue(child, childValue);
  };

  private isTransitionSourceActive = (node: RuntimeNode<Event>): boolean => {
    if (node.path.length === 0) {
      return this.activePaths.length > 0;
    }

    return this.activePaths.some((path) => isDescendantPath(path, node.path));
  };

  private isNodeDone = (node: RuntimeNode<Event>): boolean => {
    if (!this.isTransitionSourceActive(node)) {
      return false;
    }

    if (isFinalNode(node)) {
      return this.activePaths.some((path) => pathsEqual(path, node.path));
    }

    const stateChildren = Array.from(node.children.values()).filter(
      (child) => !isHistoryNode(child),
    );

    if (stateChildren.length === 0) {
      return false;
    }

    if (isParallelNode(node)) {
      return stateChildren.every((child) => this.isNodeDone(child));
    }

    const activeChild = stateChildren.find((child) => {
      return this.activePaths.some((path) => isDescendantPath(path, child.path));
    });

    return activeChild ? this.isNodeDone(activeChild) : false;
  };

  private notifyRootDone = (): void => {
    if (this.rootDoneNotified || !this.onDone || !this.isNodeDone(this.root)) {
      return;
    }

    this.rootDoneNotified = true;
    this.onDone(doneInvokeEvent(this.machine.id));
  };

  private clearCompletedNodes = (node: RuntimeNode<Event>): void => {
    const key = pathKey(node.path);

    Array.from(this.completed).forEach((completedKey) => {
      if (
        completedKey === key ||
        (key !== "" && completedKey.startsWith(`${key}.`))
      ) {
        this.completed.delete(completedKey);
      }
    });

    if (node.path.length === 0) {
      this.rootDoneNotified = false;
    }
  };

  private publish = (event: Event): void => {
    const value = this.valueFromNode(this.root);
    const snapshot: MachineSnapshot<Event> = {
      value,
      event,
      matches: (state) => matchesStateValue(value, state),
    };

    this.snapshot = snapshot;
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
  };

  private valueFromNode = (node: RuntimeNode<Event>): MachineStateValue => {
    const stateChildren = Array.from(node.children.values()).filter((child) => {
      return (
        !isHistoryNode(child) &&
        this.activePaths.some((path) => isDescendantPath(path, child.path))
      );
    });

    if (stateChildren.length === 0) {
      return node.key;
    }

    if (isParallelNode(node)) {
      return Object.fromEntries(
        stateChildren.map((child) => [child.key, this.valueFromNode(child)]),
      );
    }

    const [activeChild] = stateChildren;
    const childValue = this.valueFromNode(activeChild);

    return hasStateChildren(activeChild) || isParallelNode(activeChild)
      ? { [activeChild.key]: childValue }
      : activeChild.key;
  };

  private getNode = (path: readonly string[]): RuntimeNode<Event> => {
    const node = this.nodes.get(pathKey(path));
    if (!node) {
      throw new Error(`Unknown state node: ${pathKey(path)}`);
    }

    return node;
  };

  private mergeActivePaths = (paths: readonly string[][]): string[][] => {
    const result = new Map<string, string[]>();
    paths.forEach((path) => {
      if (path.length > 0) {
        result.set(pathKey(path), path);
      }
    });
    return Array.from(result.values());
  };

  private getScopeMember = (name: string): unknown => {
    if (!this.scope) {
      return undefined;
    }

    return (this.scope as Record<string, unknown>)[name];
  };

  private toEvent = (event: MachineSendEvent<Event>): Event => {
    return typeof event === "string" ? eventFromType(event) : event;
  };
}

const pathMatches = (
  value: MachineStateValue,
  segments: readonly string[],
): boolean => {
  if (segments.length === 0) {
    return true;
  }

  if (typeof value === "string") {
    return segments.length === 1 && value === segments[0];
  }

  const [head, ...tail] = segments;
  const child = value[head];

  return child === undefined ? false : pathMatches(child, tail);
};

export const matchesStateValue = (
  value: MachineStateValue,
  state: MachineStateValue,
): boolean => {
  if (typeof state === "string") {
    if (state.includes(".")) {
      return pathMatches(value, state.split(".").filter(Boolean));
    }

    if (typeof value === "string") {
      return value === state;
    }

    return Object.prototype.hasOwnProperty.call(value, state);
  }

  if (typeof value === "string") {
    return false;
  }

  return Object.entries(state).every(([key, childState]) => {
    const childValue = value[key];
    return childValue === undefined
      ? false
      : matchesStateValue(childValue, childState);
  });
};

export const createMachineActor = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  machine: Machine<Event, Typegen>,
  options: MachineOptions<Scope, Event, Typegen> | undefined,
  scope: Scope | undefined,
  onDone?: (event: Event) => void,
  config?: MachineActorConfig,
): MachineActor<Scope, Event, Typegen> => {
  return new MachineActor(machine, options, scope, onDone, config);
};
