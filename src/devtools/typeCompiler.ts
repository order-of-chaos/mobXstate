import type {
  EventObject,
  MachineConfig,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine/stateMachine";
import {
  machineConfigToGraph,
  type DevtoolsDiagnostic,
  type GraphModel,
  type GraphStoreBindingKind,
  type GraphStoreBindingReference,
  type GraphTransitionEdge,
  type MachineAnalysisOptions,
} from "./machineAnalyzer";

export type TypegenDiagnosticCode =
  | "MBS001"
  | "MBS002"
  | "MBS003"
  | "MBS004";

export interface TypegenDiagnostic {
  readonly code: TypegenDiagnosticCode;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly path?: readonly string[];
  readonly edgeId?: string;
}

export interface TypegenMachineInput<
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly config: MachineConfig<Event, Typegen>;
  readonly name?: string;
  readonly analysisOptions?: MachineAnalysisOptions<Scope, Event, Typegen>;
}

export interface TypegenMachineData {
  readonly machineId: string;
  readonly typeName: string;
  readonly matchesStates: readonly string[];
  readonly internalEvents: readonly string[];
  readonly invokeSrcNameMap: Readonly<Record<string, string>>;
  readonly missingImplementations: {
    readonly actions: readonly string[];
    readonly delays: readonly string[];
    readonly effects: readonly string[];
    readonly guards: readonly string[];
  };
  readonly eventsCausingActions: Readonly<Record<string, readonly string[]>>;
  readonly eventsCausingDelays: Readonly<Record<string, readonly string[]>>;
  readonly eventsCausingEffects: Readonly<Record<string, readonly string[]>>;
  readonly eventsCausingGuards: Readonly<Record<string, readonly string[]>>;
  readonly diagnostics: readonly TypegenDiagnostic[];
}

export interface TypegenResult {
  readonly machines: readonly TypegenMachineData[];
  readonly moduleText: string;
  readonly diagnostics: readonly TypegenDiagnostic[];
  readonly devtoolsDiagnostics: readonly DevtoolsDiagnostic[];
}

export interface PrintTypegenModuleOptions {
  readonly importSource?: string;
}

export interface TypegenWriteDecision {
  readonly shouldWrite: boolean;
  readonly reason: "missing" | "changed" | "unchanged";
}

const defaultImportSource = "@orderofchaos/mobxstate";

const pathKey = (path: readonly string[]): string => path.join(".");

const uniqueSorted = (values: Iterable<string>): string[] => {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
};

const pushMapValue = (
  map: Map<string, Set<string>>,
  key: string,
  value: string | undefined,
): void => {
  const values = map.get(key) ?? new Set<string>();
  if (value) {
    values.add(value);
  }
  map.set(key, values);
};

const toReadonlyRecord = (
  map: Map<string, Set<string>>,
): Readonly<Record<string, readonly string[]>> => {
  const record: Record<string, readonly string[]> = {};
  Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, values]) => {
      record[key] = uniqueSorted(values);
    });

  return record;
};

const getEdgeEventType = (
  machineId: string,
  edge: GraphTransitionEdge,
): string | undefined => {
  if (edge.trigger.kind === "on") {
    return edge.trigger.key;
  }

  if (edge.trigger.kind === "after" && edge.trigger.key) {
    return `mobxstate.after(${edge.trigger.key})#${machineId}.${pathKey(edge.sourcePath)}`;
  }

  if (edge.trigger.kind === "onDone" && edge.trigger.invokeId) {
    return `done.invoke.${edge.trigger.invokeId}`;
  }

  if (edge.trigger.kind === "onError" && edge.trigger.invokeId) {
    return `error.platform.${edge.trigger.invokeId}`;
  }

  if (edge.trigger.kind === "onDone") {
    const suffix = edge.sourcePath.length > 0 ? `.${pathKey(edge.sourcePath)}` : "";
    return `done.state.${machineId}${suffix}`;
  }

  return undefined;
};

const getIncomingEventTypes = (
  graph: GraphModel,
  path: readonly string[],
): string[] => {
  const events = graph.edges.flatMap((edge) => {
    if (!edge.targetPath) {
      return [];
    }

    const targetsPath =
      path.length === 0 ||
      path.every((segment, index) => edge.targetPath?.[index] === segment);

    if (!targetsPath) {
      return [];
    }

    return getEdgeEventType(graph.id, edge) ?? [];
  });

  return uniqueSorted(events);
};

const getEventsForBinding = (
  graph: GraphModel,
  binding: GraphStoreBindingReference,
): readonly string[] => {
  if (binding.edgeId) {
    const edge = graph.edges.find((candidate) => candidate.id === binding.edgeId);
    return edge ? uniqueSorted([getEdgeEventType(graph.id, edge) ?? ""]) : [];
  }

  return getIncomingEventTypes(graph, binding.path);
};

const getMissingDiagnosticCode = (
  kind: GraphStoreBindingKind,
): TypegenDiagnosticCode => {
  switch (kind) {
    case "action":
      return "MBS001";
    case "guard":
      return "MBS002";
    case "delay":
      return "MBS003";
    case "effect":
      return "MBS004";
  }
};

const getMissingMessage = (
  kind: GraphStoreBindingKind,
  name: string,
): string => {
  switch (kind) {
    case "action":
      return `Missing action "${name}".`;
    case "guard":
      return `Missing guard "${name}".`;
    case "delay":
      return `Missing delay "${name}".`;
    case "effect":
      return `Missing effect "${name}".`;
  }
};

export const createTypegenDiagnostics = (
  graph: GraphModel,
): readonly TypegenDiagnostic[] => {
  return graph.bindings
    .filter((binding) => binding.implemented === false)
    .map((binding) => {
      return {
        code: getMissingDiagnosticCode(binding.kind),
        severity: "error" as const,
        message: getMissingMessage(binding.kind, binding.name),
        path: binding.path,
        ...(binding.edgeId ? { edgeId: binding.edgeId } : {}),
      };
    })
    .sort((left, right) => {
      const pathCompare = pathKey(left.path ?? []).localeCompare(
        pathKey(right.path ?? []),
      );
      return pathCompare === 0 ? left.code.localeCompare(right.code) : pathCompare;
    });
};

export const createTypegenMachineData = (
  graph: GraphModel,
  typeName = "Typegen0",
): TypegenMachineData => {
  const eventsCausingActions = new Map<string, Set<string>>();
  const eventsCausingDelays = new Map<string, Set<string>>();
  const eventsCausingEffects = new Map<string, Set<string>>();
  const eventsCausingGuards = new Map<string, Set<string>>();
  const missingActions = new Set<string>();
  const missingDelays = new Set<string>();
  const missingEffects = new Set<string>();
  const missingGuards = new Set<string>();

  graph.bindings.forEach((binding) => {
    const events = getEventsForBinding(graph, binding);
    const mapEvents = events.length > 0 ? events : [undefined];

    mapEvents.forEach((eventType) => {
      if (binding.kind === "action") {
        pushMapValue(eventsCausingActions, binding.name, eventType);
      } else if (binding.kind === "guard") {
        pushMapValue(eventsCausingGuards, binding.name, eventType);
      } else if (binding.kind === "delay") {
        pushMapValue(eventsCausingDelays, binding.name, eventType);
      } else {
        pushMapValue(eventsCausingEffects, binding.name, eventType);
      }
    });

    if (binding.implemented === false) {
      if (binding.kind === "action") {
        missingActions.add(binding.name);
      } else if (binding.kind === "guard") {
        missingGuards.add(binding.name);
      } else if (binding.kind === "delay") {
        missingDelays.add(binding.name);
      } else {
        missingEffects.add(binding.name);
      }
    }
  });

  const internalEvents = uniqueSorted(
    graph.edges.flatMap((edge) => {
      const eventType = getEdgeEventType(graph.id, edge);
      return eventType && edge.trigger.kind !== "on" ? [eventType] : [];
    }),
  );
  const effectNames = uniqueSorted(
    graph.bindings.flatMap((binding) => {
      return binding.kind === "effect" ? [binding.name] : [];
    }),
  );
  const invokeSrcNameMap: Record<string, string> = {};
  effectNames.forEach((name) => {
    invokeSrcNameMap[name] = name;
  });

  return {
    machineId: graph.id,
    typeName,
    matchesStates: uniqueSorted(
      graph.nodes.flatMap((node) => {
        return node.path.length > 0 ? [pathKey(node.path)] : [];
      }),
    ),
    internalEvents,
    invokeSrcNameMap,
    missingImplementations: {
      actions: uniqueSorted(missingActions),
      delays: uniqueSorted(missingDelays),
      effects: uniqueSorted(missingEffects),
      guards: uniqueSorted(missingGuards),
    },
    eventsCausingActions: toReadonlyRecord(eventsCausingActions),
    eventsCausingDelays: toReadonlyRecord(eventsCausingDelays),
    eventsCausingEffects: toReadonlyRecord(eventsCausingEffects),
    eventsCausingGuards: toReadonlyRecord(eventsCausingGuards),
    diagnostics: createTypegenDiagnostics(graph),
  };
};

const quote = (value: string): string => JSON.stringify(value);

const printStringUnion = (values: readonly string[]): string => {
  if (values.length === 0) {
    return "never";
  }

  return values.map(quote).join(" | ");
};

const printStringMap = (
  propertyName: string,
  valuesByKey: Readonly<Record<string, readonly string[]>>,
  indent = "  ",
): string[] => {
  const entries = Object.entries(valuesByKey).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (entries.length === 0) {
    return [`${indent}${propertyName}: Record<string, never>;`];
  }

  return [
    `${indent}${propertyName}: {`,
    ...entries.map(([key, values]) => {
      return `${indent}  ${quote(key)}: ${printStringUnion(values)};`;
    }),
    `${indent}};`,
  ];
};

const printObjectMap = (
  propertyName: string,
  valuesByKey: Readonly<Record<string, string>>,
  indent = "  ",
): string[] => {
  const entries = Object.entries(valuesByKey).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (entries.length === 0) {
    return [`${indent}${propertyName}: Record<string, never>;`];
  }

  return [
    `${indent}${propertyName}: {`,
    ...entries.map(([key, value]) => {
      return `${indent}  ${quote(key)}: ${quote(value)};`;
    }),
    `${indent}};`,
  ];
};

const printInternalEvents = (
  values: readonly string[],
  indent = "  ",
): string[] => {
  if (values.length === 0) {
    return [`${indent}internalEvents: Record<string, never>;`];
  }

  return [
    `${indent}internalEvents: {`,
    ...values.map((eventType) => {
      return `${indent}  ${quote(eventType)}: { type: ${quote(eventType)} };`;
    }),
    `${indent}};`,
  ];
};

const printMissingImplementations = (
  data: TypegenMachineData,
  indent = "  ",
): string[] => {
  return [
    `${indent}missingImplementations: {`,
    `${indent}  actions: ${printStringUnion(data.missingImplementations.actions)};`,
    `${indent}  delays: ${printStringUnion(data.missingImplementations.delays)};`,
    `${indent}  effects: ${printStringUnion(data.missingImplementations.effects)};`,
    `${indent}  guards: ${printStringUnion(data.missingImplementations.guards)};`,
    `${indent}};`,
  ];
};

export const printTypegenModule = (
  machines: readonly TypegenMachineData[],
  options: PrintTypegenModuleOptions = {},
): string => {
  const importSource = options.importSource ?? defaultImportSource;
  const lines = [
    "/* eslint-disable */",
    "// This file was generated by MobXstate type compiler.",
    `import type { MachineStateValue } from ${quote(importSource)};`,
    "",
  ];

  machines.forEach((machine, index) => {
    if (index > 0) {
      lines.push("");
    }

    lines.push(`export interface ${machine.typeName} {`);
    lines.push(`  "@@mobxstate/typegen": true;`);
    lines.push(...printInternalEvents(machine.internalEvents));
    lines.push(...printObjectMap("invokeSrcNameMap", machine.invokeSrcNameMap));
    lines.push(...printMissingImplementations(machine));
    lines.push(...printStringMap("eventsCausingActions", machine.eventsCausingActions));
    lines.push(...printStringMap("eventsCausingDelays", machine.eventsCausingDelays));
    lines.push(...printStringMap("eventsCausingGuards", machine.eventsCausingGuards));
    lines.push(
      ...printStringMap("eventsCausingServices", machine.eventsCausingEffects),
    );
    lines.push(`  matchesStates: ${printStringUnion(machine.matchesStates)};`);
    lines.push("  tags: never;");
    lines.push("}");
    lines.push("");
    lines.push(
      `export type ${machine.typeName}MatchesStates = ${machine.typeName}["matchesStates"] & MachineStateValue;`,
    );
  });

  return `${lines.join("\n")}\n`;
};

export const compileMobxstateTypes = <
  Scope extends object = object,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  inputs:
    | TypegenMachineInput<Scope, Event, Typegen>
    | readonly TypegenMachineInput<Scope, Event, Typegen>[],
  options: PrintTypegenModuleOptions = {},
): TypegenResult => {
  const inputList = Array.isArray(inputs) ? inputs : [inputs];
  const devtoolsDiagnostics: DevtoolsDiagnostic[] = [];
  const machines = inputList.map((input, index) => {
    const graph = machineConfigToGraph<Scope, Event, Typegen>(
      input.config,
      input.analysisOptions ?? {},
    );
    devtoolsDiagnostics.push(...graph.diagnostics);
    return createTypegenMachineData(graph, input.name ?? `Typegen${index}`);
  });
  const diagnostics = machines.flatMap((machine) => machine.diagnostics);

  return {
    machines,
    moduleText: printTypegenModule(machines, options),
    diagnostics,
    devtoolsDiagnostics,
  };
};

export const shouldWriteTypegenFile = (
  existingText: string | undefined,
  generatedText: string,
): TypegenWriteDecision => {
  if (existingText === undefined) {
    return {
      shouldWrite: true,
      reason: "missing",
    };
  }

  if (existingText === generatedText) {
    return {
      shouldWrite: false,
      reason: "unchanged",
    };
  }

  return {
    shouldWrite: true,
    reason: "changed",
  };
};
