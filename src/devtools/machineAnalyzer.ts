import type {
  EventObject,
  MachineActionObject,
  MachineActionReference,
  MachineCondition,
  MachineConfig,
  MachineDelayTransition,
  MachineInvokeConfig,
  MachineOptions,
  MachineStateNodeConfig,
  MachineTransition,
  MachineTransitionConfig,
  RuntimeMachine,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine/stateMachine";

export type DevtoolsDiagnosticSeverity = "error" | "warning" | "info";

export type DevtoolsDiagnosticCode =
  | "missing_initial"
  | "unknown_initial"
  | "unsupported_deep_history"
  | "unknown_transition_target"
  | "missing_action_implementation"
  | "missing_guard_implementation"
  | "missing_delay_implementation"
  | "missing_effect_implementation";

export interface DevtoolsDiagnostic {
  readonly code: DevtoolsDiagnosticCode;
  readonly severity: DevtoolsDiagnosticSeverity;
  readonly message: string;
  readonly path?: readonly string[];
  readonly edgeId?: string;
}

export type GraphStateNodeType =
  | "atomic"
  | "compound"
  | "parallel"
  | "final"
  | "history";

export interface GraphStateNode {
  readonly id: string;
  readonly key: string;
  readonly path: readonly string[];
  readonly parentPath?: readonly string[];
  readonly type: GraphStateNodeType;
  readonly declaredType?: string;
  readonly initial?: string;
  readonly history?: MachineStateNodeConfig<EventObject>["history"];
  readonly entryActions: readonly string[];
  readonly exitActions: readonly string[];
  readonly invokeSources: readonly string[];
}

export type GraphTransitionKind = "on" | "after" | "always" | "onDone" | "onError";

export interface GraphTransitionTrigger {
  readonly kind: GraphTransitionKind;
  readonly key?: string;
  readonly invokeId?: string;
}

export interface GraphTransitionEdge {
  readonly id: string;
  readonly sourcePath: readonly string[];
  readonly target?: string;
  readonly targetPath?: readonly string[];
  readonly trigger: GraphTransitionTrigger;
  readonly index: number;
  readonly actions: readonly string[];
  readonly guard?: string;
  readonly internal?: boolean;
  readonly description?: string;
}

export type GraphStoreBindingKind = "action" | "guard" | "delay" | "effect";

export interface GraphStoreBindingReference {
  readonly kind: GraphStoreBindingKind;
  readonly name: string;
  readonly path: readonly string[];
  readonly edgeId?: string;
  readonly implemented?: boolean;
}

export interface GraphModel {
  readonly id: string;
  readonly nodes: readonly GraphStateNode[];
  readonly edges: readonly GraphTransitionEdge[];
  readonly diagnostics: readonly DevtoolsDiagnostic[];
  readonly bindings: readonly GraphStoreBindingReference[];
}

export type NormalizedMachine = GraphModel;

export interface MachineAnalysis {
  readonly graph: GraphModel;
  readonly diagnostics: readonly DevtoolsDiagnostic[];
  readonly normalized: NormalizedMachine;
}

export interface MachineAnalysisOptions<
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly machineOptions?: MachineOptions<Scope, Event, Typegen>;
  readonly storeScope?: Scope;
  readonly strictImplementations?: boolean;
}

interface AnalysisNode<Event extends EventObject> {
  readonly key: string;
  readonly path: readonly string[];
  readonly config: MachineStateNodeConfig<Event>;
  readonly parent: AnalysisNode<Event> | undefined;
  readonly children: Map<string, AnalysisNode<Event>>;
}

interface BindingContext {
  readonly path: readonly string[];
  readonly edgeId?: string;
}

const pathKey = (path: readonly string[]): string => path.join(".");

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
): action is MachineActionObject & { type: "xstate.send" } => {
  return action.type === "xstate.send";
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

const createNodeTree = <Event extends EventObject>(
  key: string,
  path: readonly string[],
  config: MachineStateNodeConfig<Event>,
  parent: AnalysisNode<Event> | undefined,
  nodes: Map<string, AnalysisNode<Event>>,
): AnalysisNode<Event> => {
  const node: AnalysisNode<Event> = {
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

const getMachineNodeId = (
  machineId: string,
  path: readonly string[],
): string => {
  return path.length === 0 ? machineId : `${machineId}.${pathKey(path)}`;
};

const getStateNodeType = <Event extends EventObject>(
  node: AnalysisNode<Event>,
): GraphStateNodeType => {
  if (node.config.type === "parallel") {
    return "parallel";
  }

  if (node.config.type === "final") {
    return "final";
  }

  if (node.config.type === "history" || node.config.history !== undefined) {
    return "history";
  }

  if (node.config.type === "compound") {
    return "compound";
  }

  if (node.config.type === "atomic") {
    return "atomic";
  }

  const hasStateChildren = Array.from(node.children.values()).some((child) => {
    return getStateNodeType(child) !== "history";
  });

  return hasStateChildren ? "compound" : "atomic";
};

const getActionNames = (
  value: MachineActionReference | undefined,
): string[] => {
  return normalizeActionReferences(value)
    .filter((action) => {
      return typeof action === "string" || !isSendActionObject(action);
    })
    .map((action) => {
      return typeof action === "string" ? action : action.type;
    });
};

const getConditionName = <Event extends EventObject>(
  condition: MachineCondition<Event> | undefined,
): string | undefined => {
  if (!condition || typeof condition === "function") {
    return undefined;
  }

  return typeof condition === "string" ? condition : condition.type;
};

const getInvokeSources = <Event extends EventObject>(
  node: AnalysisNode<Event>,
): string[] => {
  return normalizeInvokeConfigs(node.config.invoke).flatMap((invokeConfig) => {
    return isRuntimeMachine(invokeConfig) ? [] : [invokeConfig.src];
  });
};

const toGraphStateNode = <Event extends EventObject>(
  machineId: string,
  node: AnalysisNode<Event>,
): GraphStateNode => {
  return {
    id: getMachineNodeId(machineId, node.path),
    key: node.key,
    path: node.path,
    ...(node.parent ? { parentPath: node.parent.path } : {}),
    type: getStateNodeType(node),
    ...(node.config.type ? { declaredType: node.config.type } : {}),
    ...(node.config.initial ? { initial: node.config.initial } : {}),
    ...(node.config.history !== undefined ? { history: node.config.history } : {}),
    entryActions: getActionNames(node.config.entry),
    exitActions: getActionNames(node.config.exit),
    invokeSources: getInvokeSources(node),
  };
};

const resolveTargetNode = <Event extends EventObject>(
  machineId: string,
  nodes: Map<string, AnalysisNode<Event>>,
  source: AnalysisNode<Event>,
  target: string,
): AnalysisNode<Event> | undefined => {
  const normalized = target.startsWith(`#${machineId}.`)
    ? target.slice(machineId.length + 2)
    : target.startsWith("#")
      ? target.slice(1)
      : target;

  const relative = normalized.startsWith(".");
  const segments = normalized
    .replace(/^\./, "")
    .split(".")
    .filter(Boolean);

  if (segments[0] === machineId) {
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
    const node = nodes.get(pathKey(candidate));
    if (node) {
      return node;
    }
  }

  return undefined;
};

const getScopeDescriptor = (
  scope: object | undefined,
  name: string,
): PropertyDescriptor | undefined => {
  let current: object | null = scope ?? null;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) {
      return descriptor;
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
};

const hasCallableScopeMember = (
  scope: object | undefined,
  name: string,
): boolean => {
  return typeof getScopeDescriptor(scope, name)?.value === "function";
};

const hasScopeGetter = (
  scope: object | undefined,
  name: string,
): boolean => {
  return typeof getScopeDescriptor(scope, name)?.get === "function";
};

const hasScopeValue = (
  scope: object | undefined,
  name: string,
  type: "boolean" | "number",
): boolean => {
  const descriptor = getScopeDescriptor(scope, name);
  return descriptor?.get === undefined && typeof descriptor?.value === type;
};

const hasDefinedMember = (
  source: object | undefined,
  name: string,
): boolean => {
  if (!source || !Object.prototype.hasOwnProperty.call(source, name)) {
    return false;
  }

  return (source as Record<string, unknown>)[name] !== undefined;
};

const hasImplementationInfo = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): boolean => {
  return options.storeScope !== undefined || options.machineOptions !== undefined;
};

const hasImplementation = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  kind: GraphStoreBindingKind,
  name: string,
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): boolean => {
  switch (kind) {
    case "action":
      return (
        hasCallableScopeMember(options.storeScope, name) ||
        hasDefinedMember(options.machineOptions?.actions, name)
      );
    case "guard":
      return (
        hasCallableScopeMember(options.storeScope, name) ||
        hasScopeGetter(options.storeScope, name) ||
        hasScopeValue(options.storeScope, name, "boolean") ||
        hasDefinedMember(options.machineOptions?.guards, name)
      );
    case "delay":
      return (
        hasCallableScopeMember(options.storeScope, name) ||
        hasScopeGetter(options.storeScope, name) ||
        hasScopeValue(options.storeScope, name, "number") ||
        hasDefinedMember(options.machineOptions?.delays, name)
      );
    case "effect":
      return (
        hasCallableScopeMember(options.storeScope, name) ||
        hasDefinedMember(options.machineOptions?.effects, name)
      );
  }
};

const missingImplementationCode = (
  kind: GraphStoreBindingKind,
): DevtoolsDiagnosticCode => {
  switch (kind) {
    case "action":
      return "missing_action_implementation";
    case "guard":
      return "missing_guard_implementation";
    case "delay":
      return "missing_delay_implementation";
    case "effect":
      return "missing_effect_implementation";
  }
};

const addBinding = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  bindings: GraphStoreBindingReference[],
  diagnostics: DevtoolsDiagnostic[],
  kind: GraphStoreBindingKind,
  name: string,
  context: BindingContext,
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): void => {
  const canCheck = hasImplementationInfo(options);
  const implemented = canCheck ? hasImplementation(kind, name, options) : undefined;

  bindings.push({
    kind,
    name,
    path: context.path,
    ...(context.edgeId ? { edgeId: context.edgeId } : {}),
    ...(implemented !== undefined ? { implemented } : {}),
  });

  if (options.strictImplementations === true && implemented === false) {
    diagnostics.push({
      code: missingImplementationCode(kind),
      severity: "error",
      message: `Missing ${kind} implementation "${name}".`,
      path: context.path,
      ...(context.edgeId ? { edgeId: context.edgeId } : {}),
    });
  }
};

const addActionBindings = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  bindings: GraphStoreBindingReference[],
  diagnostics: DevtoolsDiagnostic[],
  actions: MachineActionReference | undefined,
  context: BindingContext,
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): void => {
  getActionNames(actions).forEach((name) => {
    addBinding(bindings, diagnostics, "action", name, context, options);
  });
};

const addTransitionBindings = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  bindings: GraphStoreBindingReference[],
  diagnostics: DevtoolsDiagnostic[],
  transition: MachineTransitionConfig<Event>,
  context: BindingContext,
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): void => {
  const guard = getConditionName(transition.cond);
  if (guard) {
    addBinding(bindings, diagnostics, "guard", guard, context, options);
  }

  addActionBindings(bindings, diagnostics, transition.actions, context, options);
};

const createEdgeId = (
  machineId: string,
  sourcePath: readonly string[],
  trigger: GraphTransitionTrigger,
  index: number,
): string => {
  const source = getMachineNodeId(machineId, sourcePath);
  const key = trigger.key ?? trigger.kind;
  const invoke = trigger.invokeId ? `:${trigger.invokeId}` : "";
  return `${source}:${trigger.kind}:${key}${invoke}:${index}`;
};

const addTransitions = <
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  machineId: string,
  nodes: Map<string, AnalysisNode<Event>>,
  source: AnalysisNode<Event>,
  trigger: GraphTransitionTrigger,
  transitionValue: MachineTransition<Event> | MachineDelayTransition<Event> | undefined,
  edges: GraphTransitionEdge[],
  bindings: GraphStoreBindingReference[],
  diagnostics: DevtoolsDiagnostic[],
  options: MachineAnalysisOptions<Scope, Event, Typegen>,
): void => {
  normalizeTransition(transitionValue).forEach((transition, index) => {
    const targetNode =
      transition.target === undefined
        ? undefined
        : resolveTargetNode(machineId, nodes, source, transition.target);
    const edgeId = createEdgeId(machineId, source.path, trigger, index);

    edges.push({
      id: edgeId,
      sourcePath: source.path,
      ...(transition.target ? { target: transition.target } : {}),
      ...(targetNode ? { targetPath: targetNode.path } : {}),
      trigger,
      index,
      actions: getActionNames(transition.actions),
      ...(getConditionName(transition.cond)
        ? { guard: getConditionName(transition.cond) }
        : {}),
      ...(transition.internal !== undefined ? { internal: transition.internal } : {}),
      ...(transition.description ? { description: transition.description } : {}),
    });

    if (transition.target !== undefined && !targetNode) {
      diagnostics.push({
        code: "unknown_transition_target",
        severity: "error",
        message: `Unknown transition target "${transition.target}" from state "${
          pathKey(source.path) || machineId
        }".`,
        path: source.path,
        edgeId,
      });
    }

    addTransitionBindings(
      bindings,
      diagnostics,
      transition,
      { path: source.path, edgeId },
      options,
    );
  });
};

const validateNodeShape = <Event extends EventObject>(
  machineId: string,
  node: AnalysisNode<Event>,
  diagnostics: DevtoolsDiagnostic[],
): void => {
  const stateChildren = Array.from(node.children.values()).filter((child) => {
    return getStateNodeType(child) !== "history";
  });

  if (
    stateChildren.length > 0 &&
    getStateNodeType(node) !== "parallel" &&
    node.config.initial === undefined
  ) {
    diagnostics.push({
      code: "missing_initial",
      severity: "warning",
      message: `State "${pathKey(node.path) || machineId}" has children but no initial state.`,
      path: node.path,
    });
  }

  if (node.config.initial !== undefined && !node.children.has(node.config.initial)) {
    diagnostics.push({
      code: "unknown_initial",
      severity: "error",
      message: `Unknown initial state "${node.config.initial}" in state "${
        pathKey(node.path) || machineId
      }".`,
      path: node.path,
    });
  }

  if (node.config.history === "deep") {
    diagnostics.push({
      code: "unsupported_deep_history",
      severity: "error",
      message: `Deep history is not supported in state "${
        pathKey(node.path) || machineId
      }".`,
      path: node.path,
    });
  }
};

export const machineConfigToGraph = <
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
  options: MachineAnalysisOptions<Scope, Event, Typegen> = {},
): GraphModel => {
  const nodes = new Map<string, AnalysisNode<Event>>();
  createNodeTree(config.id, [], config, undefined, nodes);

  const diagnostics: DevtoolsDiagnostic[] = [];
  const bindings: GraphStoreBindingReference[] = [];
  const edges: GraphTransitionEdge[] = [];

  Array.from(nodes.values()).forEach((node) => {
    validateNodeShape(config.id, node, diagnostics);

    addActionBindings(
      bindings,
      diagnostics,
      node.config.entry,
      { path: node.path },
      options,
    );
    addActionBindings(
      bindings,
      diagnostics,
      node.config.exit,
      { path: node.path },
      options,
    );

    Object.entries(node.config.on ?? {}).forEach(([eventType, transition]) => {
      addTransitions(
        config.id,
        nodes,
        node,
        { kind: "on", key: eventType },
        transition,
        edges,
        bindings,
        diagnostics,
        options,
      );
    });

    addTransitions(
      config.id,
      nodes,
      node,
      { kind: "always" },
      node.config.always,
      edges,
      bindings,
      diagnostics,
      options,
    );

    Object.entries(node.config.after ?? {}).forEach(([delayName, transition]) => {
      if (!Number.isFinite(Number(delayName))) {
        addBinding(
          bindings,
          diagnostics,
          "delay",
          delayName,
          { path: node.path },
          options,
        );
      }

      addTransitions(
        config.id,
        nodes,
        node,
        { kind: "after", key: delayName },
        transition,
        edges,
        bindings,
        diagnostics,
        options,
      );
    });

    addTransitions(
      config.id,
      nodes,
      node,
      { kind: "onDone" },
      node.config.onDone,
      edges,
      bindings,
      diagnostics,
      options,
    );

    normalizeInvokeConfigs(node.config.invoke).forEach((invokeConfig, index) => {
      if (isRuntimeMachine(invokeConfig)) {
        return;
      }

      const invokeId = invokeConfig.id ?? `${pathKey(node.path)}:invoke:${index}`;
      addBinding(
        bindings,
        diagnostics,
        "effect",
        invokeConfig.src,
        { path: node.path },
        options,
      );

      addTransitions(
        config.id,
        nodes,
        node,
        { kind: "onDone", invokeId },
        invokeConfig.onDone,
        edges,
        bindings,
        diagnostics,
        options,
      );

      addTransitions(
        config.id,
        nodes,
        node,
        { kind: "onError", invokeId },
        invokeConfig.onError,
        edges,
        bindings,
        diagnostics,
        options,
      );
    });
  });

  return {
    id: config.id,
    nodes: Array.from(nodes.values()).map((node) => toGraphStateNode(config.id, node)),
    edges,
    diagnostics,
    bindings,
  };
};

export const normalizeMachineConfig = <
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
  options: MachineAnalysisOptions<Scope, Event, Typegen> = {},
): NormalizedMachine => {
  return machineConfigToGraph(config, options);
};

export const validateMachineConfigForDevtools = <
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
  options: MachineAnalysisOptions<Scope, Event, Typegen> = {},
): readonly DevtoolsDiagnostic[] => {
  return machineConfigToGraph(config, options).diagnostics;
};

export const analyzeMachineConfig = <
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
  options: MachineAnalysisOptions<Scope, Event, Typegen> = {},
): MachineAnalysis => {
  const graph = machineConfigToGraph(config, options);

  return {
    graph,
    diagnostics: graph.diagnostics,
    normalized: graph,
  };
};
