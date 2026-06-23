import type {
  EventObject,
  MachineConfig,
  MachineStateNodeConfig,
  MachineTransitionConfig,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine/stateMachine";
import type { DraftCommandResult, DraftTransitionTrigger } from "./draftModel";
import { createDraftModel, type DraftModel } from "./draftModel";
import type { DevtoolsDiagnostic, GraphModel } from "./machineAnalyzer";

export type VisualEditorDraftCommandName =
  | "addState"
  | "renameState"
  | "removeState"
  | "setStateType"
  | "setInitialState"
  | "addTransition"
  | "updateTransition"
  | "removeTransition"
  | "undo"
  | "redo";

export interface VisualEditorDraftCommandMessage {
  readonly type: "DRAFT_COMMAND";
  readonly requestId?: string;
  readonly command: VisualEditorDraftCommandName;
  readonly params?: unknown;
}

export interface VisualEditorDraftSnapshot {
  readonly type: "DRAFT_UPDATED";
  readonly requestId?: string;
  readonly graph: GraphModel;
  readonly diagnostics: readonly DevtoolsDiagnostic[];
  readonly config: unknown;
  readonly exportText: string;
  readonly isDirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly commandResult?: DraftCommandResult;
  readonly error?: string;
}

export interface VisualEditorSession {
  getSnapshot(
    commandResult?: DraftCommandResult,
    error?: string,
    requestId?: string,
  ): VisualEditorDraftSnapshot;
  handleMessage(message: VisualEditorDraftCommandMessage): VisualEditorDraftSnapshot;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isStringArray = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const assertParams = (params: unknown): Record<string, unknown> => {
  if (!isObjectRecord(params)) {
    throw new Error("Expected visual editor command params to be an object.");
  }

  return params;
};

const assertString = (
  params: Record<string, unknown>,
  key: string,
): string => {
  const value = params[key];
  if (typeof value !== "string") {
    throw new Error(`Expected params.${key} to be a string.`);
  }

  return value;
};

const optionalString = (
  params: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = params[key];
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected params.${key} to be a string.`);
  }

  return value;
};

const assertPath = (
  params: Record<string, unknown>,
  key: string,
): readonly string[] => {
  const value = params[key];
  if (!isStringArray(value)) {
    throw new Error(`Expected params.${key} to be a string array.`);
  }

  return value;
};

const optionalBoolean = (
  params: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = params[key];
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Expected params.${key} to be a boolean.`);
  }

  return value;
};

const readTrigger = (value: unknown): DraftTransitionTrigger => {
  if (!isObjectRecord(value)) {
    throw new Error("Expected params.trigger to be an object.");
  }

  const kind = assertString(value, "kind");
  if (!["on", "after", "always", "onDone", "onError"].includes(kind)) {
    throw new Error("Unsupported transition trigger kind.");
  }

  return {
    kind: kind as DraftTransitionTrigger["kind"],
    ...(optionalString(value, "key") === undefined
      ? {}
      : { key: optionalString(value, "key") }),
    ...(optionalString(value, "invokeId") === undefined
      ? {}
      : { invokeId: optionalString(value, "invokeId") }),
  };
};

const readTransitionPatch = <Event extends EventObject>(
  value: unknown,
): Partial<MachineTransitionConfig<Event>> => {
  const params = assertParams(value);
  return {
    ...(optionalString(params, "target") === undefined
      ? {}
      : { target: optionalString(params, "target") }),
    ...(optionalString(params, "actions") === undefined
      ? {}
      : { actions: optionalString(params, "actions") }),
    ...(optionalString(params, "cond") === undefined
      ? {}
      : { cond: optionalString(params, "cond") }),
    ...(optionalString(params, "description") === undefined
      ? {}
      : { description: optionalString(params, "description") }),
    ...(optionalBoolean(params, "internal") === undefined
      ? {}
      : { internal: optionalBoolean(params, "internal") }),
  };
};

const printConfigValue = (value: unknown, depth = 0): string => {
  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return `[\n${value
      .map((item) => `${childIndent}${printConfigValue(item, depth + 1)}`)
      .join(",\n")}\n${indent}]`;
  }

  if (isObjectRecord(value)) {
    const entries = Object.entries(value).filter(([, child]) => child !== undefined);
    if (entries.length === 0) {
      return "{}";
    }

    return `{\n${entries
      .map(([key, child]) => {
        const printedKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
          ? key
          : JSON.stringify(key);
        return `${childIndent}${printedKey}: ${printConfigValue(child, depth + 1)}`;
      })
      .join(",\n")}\n${indent}}`;
  }

  return JSON.stringify(value);
};

export const formatVisualEditorExport = (config: unknown): string => {
  return `createMachine(${printConfigValue(config)})`;
};

class DraftVisualEditorSession<
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> implements VisualEditorSession
{
  private readonly draft: DraftModel<Event, Typegen>;

  public constructor(config: MachineConfig<Event, Typegen>) {
    this.draft = createDraftModel(config);
  }

  public getSnapshot = (
    commandResult?: DraftCommandResult,
    error?: string,
    requestId?: string,
  ): VisualEditorDraftSnapshot => {
    const config = this.draft.exportConfig();
    return {
      type: "DRAFT_UPDATED",
      ...(requestId === undefined ? {} : { requestId }),
      graph: this.draft.getGraph(),
      diagnostics: this.draft.getDiagnostics(),
      config,
      exportText: formatVisualEditorExport(config),
      isDirty: this.draft.isDirty(),
      canUndo: this.draft.canUndo(),
      canRedo: this.draft.canRedo(),
      ...(commandResult === undefined ? {} : { commandResult }),
      ...(error === undefined ? {} : { error }),
    };
  };

  public handleMessage = (
    message: VisualEditorDraftCommandMessage,
  ): VisualEditorDraftSnapshot => {
    try {
      return this.getSnapshot(
        this.applyCommand(message.command, message.params),
        undefined,
        message.requestId,
      );
    } catch (error) {
      return this.getSnapshot(
        undefined,
        error instanceof Error ? error.message : String(error),
        message.requestId,
      );
    }
  };

  private applyCommand = (
    command: VisualEditorDraftCommandName,
    params: unknown,
  ): DraftCommandResult => {
    if (command === "undo") {
      return this.draft.undo();
    }

    if (command === "redo") {
      return this.draft.redo();
    }

    if (
      command !== "addState" &&
      command !== "renameState" &&
      command !== "removeState" &&
      command !== "setStateType" &&
      command !== "setInitialState" &&
      command !== "addTransition" &&
      command !== "updateTransition" &&
      command !== "removeTransition"
    ) {
      throw new Error(`Unsupported visual editor command "${String(command)}".`);
    }

    const record = assertParams(params);

    if (command === "addState") {
      return this.draft.addState(
        assertPath(record, "parentPath"),
        assertString(record, "key"),
        readStateConfig(record.stateConfig),
      );
    }

    if (command === "renameState") {
      return this.draft.renameState(
        assertPath(record, "path"),
        assertString(record, "newKey"),
      );
    }

    if (command === "removeState") {
      return this.draft.removeState(assertPath(record, "path"));
    }

    if (command === "setStateType") {
      return this.draft.setStateType(
        assertPath(record, "path"),
        readStateType(record.type),
      );
    }

    if (command === "setInitialState") {
      return this.draft.setInitialState(
        assertPath(record, "parentPath"),
        optionalString(record, "initialState"),
      );
    }

    if (command === "addTransition") {
      return this.draft.addTransition(
        assertPath(record, "sourcePath"),
        readTrigger(record.trigger),
        readTransitionPatch<Event>(record.transition),
      );
    }

    if (command === "updateTransition") {
      return this.draft.updateTransition(
        assertString(record, "edgeId"),
        readTransitionPatch<Event>(record.patch),
      );
    }

    if (command === "removeTransition") {
      return this.draft.removeTransition(assertString(record, "edgeId"));
    }

    throw new Error(`Unsupported visual editor command "${String(command)}".`);
  };
}

const readStateConfig = <Event extends EventObject>(
  value: unknown,
): MachineStateNodeConfig<Event> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isObjectRecord(value)) {
    throw new Error("Expected params.stateConfig to be an object.");
  }

  return value as MachineStateNodeConfig<Event>;
};

const readStateType = (
  value: unknown,
): MachineStateNodeConfig<EventObject>["type"] | undefined => {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (
    value !== "atomic" &&
    value !== "compound" &&
    value !== "parallel" &&
    value !== "final" &&
    value !== "history"
  ) {
    throw new Error("Unsupported state type.");
  }

  return value;
};

export const createVisualEditorSession = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
): VisualEditorSession => {
  return new DraftVisualEditorSession(config);
};
