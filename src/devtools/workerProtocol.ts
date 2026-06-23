import type { EventObject, TypegenConstraint, TypegenDisabled } from "../MobXStateMachine/stateMachine";
import { compileMobxstateTypes, type TypegenResult } from "./typeCompiler";
import {
  createDevtoolsSourceWorker,
  type DevtoolsSourceWorker,
  type SourceBindingRange,
  type SourceDocumentSnapshot,
  type SourceDocumentUpdate,
  type SourceMachine,
  type SourceStateRange,
  type SourceTextEdit,
} from "./sourceReader";

export const devtoolsWorkerProtocolVersion = "mobxstate-devtools.v1";

export type DevtoolsWorkerProtocolVersion =
  typeof devtoolsWorkerProtocolVersion;

export type DevtoolsWorkerMethod =
  | "analyzeFile"
  | "updateDocument"
  | "setDisplayedMachine"
  | "getMachine"
  | "compileTypegen"
  | "applyAcceptedTextEdits"
  | "getNodePosition"
  | "getStoreBindingPosition"
  | "formatExport"
  | "closeDocument";

export interface DevtoolsWorkerRequest {
  readonly protocol: DevtoolsWorkerProtocolVersion;
  readonly id: string;
  readonly method: DevtoolsWorkerMethod;
  readonly params?: unknown;
}

export interface DevtoolsWorkerError {
  readonly code:
    | "invalid_request"
    | "unsupported_protocol"
    | "method_not_found"
    | "document_not_found"
    | "machine_not_found"
    | "range_not_found"
    | "internal_error";
  readonly message: string;
}

export interface DevtoolsWorkerSuccessResponse<Result = unknown> {
  readonly protocol: DevtoolsWorkerProtocolVersion;
  readonly id: string;
  readonly ok: true;
  readonly result: Result;
}

export interface DevtoolsWorkerErrorResponse {
  readonly protocol: DevtoolsWorkerProtocolVersion;
  readonly id: string;
  readonly ok: false;
  readonly error: DevtoolsWorkerError;
}

export type DevtoolsWorkerResponse<Result = unknown> =
  | DevtoolsWorkerSuccessResponse<Result>
  | DevtoolsWorkerErrorResponse;

export interface AnalyzeFileParams {
  readonly uri: string;
  readonly text: string;
  readonly version: number;
  readonly displayedMachineIndex?: number;
}

export interface UpdateDocumentParams {
  readonly uri: string;
  readonly text: string;
  readonly version: number;
}

export interface SetDisplayedMachineParams {
  readonly uri: string;
  readonly machineIndex?: number;
}

export interface MachineSelectorParams {
  readonly uri: string;
  readonly machineIndex?: number;
  readonly machineId?: string;
}

export interface ApplyAcceptedTextEditsParams {
  readonly uri: string;
  readonly version: number;
  readonly edits: readonly SourceTextEdit[];
}

export interface GetNodePositionParams extends MachineSelectorParams {
  readonly path: readonly string[];
}

export interface GetStoreBindingPositionParams extends MachineSelectorParams {
  readonly kind: SourceBindingRange["kind"];
  readonly path?: readonly string[];
  readonly name?: string;
}

export interface FormattedExport {
  readonly text: string;
}

export interface DevtoolsWorkerProtocol<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly sourceWorker: DevtoolsSourceWorker<Event, Typegen>;
  handleRequest(request: DevtoolsWorkerRequest): DevtoolsWorkerResponse;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isStringArray = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

const assertNumber = (
  params: Record<string, unknown>,
  key: string,
): number => {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected params.${key} to be a finite number.`);
  }

  return value;
};

const optionalNumber = (
  params: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected params.${key} to be a finite number.`);
  }

  return value;
};

const optionalString = (
  params: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected params.${key} to be a string.`);
  }

  return value;
};

const assertParams = (params: unknown): Record<string, unknown> => {
  if (!isObjectRecord(params)) {
    throw new Error("Expected request params to be an object.");
  }

  return params;
};

const readAnalyzeFileParams = (params: unknown): AnalyzeFileParams => {
  const record = assertParams(params);
  const displayedMachineIndex = optionalNumber(record, "displayedMachineIndex");
  return {
    uri: assertString(record, "uri"),
    text: assertString(record, "text"),
    version: assertNumber(record, "version"),
    ...(displayedMachineIndex === undefined ? {} : { displayedMachineIndex }),
  };
};

const readUpdateDocumentParams = (params: unknown): UpdateDocumentParams => {
  const record = assertParams(params);
  return {
    uri: assertString(record, "uri"),
    text: assertString(record, "text"),
    version: assertNumber(record, "version"),
  };
};

const readSetDisplayedMachineParams = (
  params: unknown,
): SetDisplayedMachineParams => {
  const record = assertParams(params);
  const machineIndex = optionalNumber(record, "machineIndex");
  return {
    uri: assertString(record, "uri"),
    ...(machineIndex === undefined ? {} : { machineIndex }),
  };
};

const readMachineSelectorParams = (params: unknown): MachineSelectorParams => {
  const record = assertParams(params);
  const machineIndex = optionalNumber(record, "machineIndex");
  const machineId = optionalString(record, "machineId");
  return {
    uri: assertString(record, "uri"),
    ...(machineIndex === undefined ? {} : { machineIndex }),
    ...(machineId === undefined ? {} : { machineId }),
  };
};

const readApplyAcceptedTextEditsParams = (
  params: unknown,
): ApplyAcceptedTextEditsParams => {
  const record = assertParams(params);
  const edits = record.edits;
  if (!Array.isArray(edits)) {
    throw new Error("Expected params.edits to be an array.");
  }

  return {
    uri: assertString(record, "uri"),
    version: assertNumber(record, "version"),
    edits: edits.map((edit) => {
      if (!isObjectRecord(edit) || !isObjectRecord(edit.range)) {
        throw new Error("Expected each text edit to include a range object.");
      }

      return {
        range: {
          start: assertNumber(edit.range, "start"),
          end: assertNumber(edit.range, "end"),
        },
        text: assertString(edit, "text"),
      };
    }),
  };
};

const readGetNodePositionParams = (params: unknown): GetNodePositionParams => {
  const record = assertParams(params);
  if (!isStringArray(record.path)) {
    throw new Error("Expected params.path to be a string array.");
  }

  return {
    ...readMachineSelectorParams(record),
    path: record.path,
  };
};

const readGetStoreBindingPositionParams = (
  params: unknown,
): GetStoreBindingPositionParams => {
  const record = assertParams(params);
  const kind = assertString(record, "kind");
  if (!["action", "guard", "delay", "effect"].includes(kind)) {
    throw new Error("Expected params.kind to be action, guard, delay or effect.");
  }

  if (record.path !== undefined && !isStringArray(record.path)) {
    throw new Error("Expected params.path to be a string array.");
  }

  const name = optionalString(record, "name");

  return {
    ...readMachineSelectorParams(record),
    kind: kind as SourceBindingRange["kind"],
    ...(record.path === undefined ? {} : { path: record.path }),
    ...(name === undefined ? {} : { name }),
  };
};

const success = <Result>(
  id: string,
  result: Result,
): DevtoolsWorkerSuccessResponse<Result> => {
  return {
    protocol: devtoolsWorkerProtocolVersion,
    id,
    ok: true,
    result,
  };
};

const failure = (
  id: string,
  code: DevtoolsWorkerError["code"],
  message: string,
): DevtoolsWorkerErrorResponse => {
  return {
    protocol: devtoolsWorkerProtocolVersion,
    id,
    ok: false,
    error: { code, message },
  };
};

const getDocumentOrThrow = <
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  sourceWorker: DevtoolsSourceWorker<Event, Typegen>,
  uri: string,
): SourceDocumentSnapshot<Event, Typegen> => {
  const snapshot = sourceWorker.getDocument(uri);
  if (!snapshot) {
    throw new Error(`Source document "${uri}" is not open.`);
  }

  return snapshot;
};

const selectMachine = <
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  snapshot: SourceDocumentSnapshot<Event, Typegen>,
  selector: MachineSelectorParams,
): SourceMachine<Event, Typegen> => {
  const machine =
    selector.machineIndex !== undefined
      ? snapshot.machines.find(
          (candidate) => candidate.machineIndex === selector.machineIndex,
        )
      : selector.machineId !== undefined
        ? snapshot.machines.find((candidate) => candidate.id === selector.machineId)
        : snapshot.displayedMachineIndex !== undefined
          ? snapshot.machines.find(
              (candidate) =>
                candidate.machineIndex === snapshot.displayedMachineIndex,
            )
          : snapshot.machines[0];

  if (!machine) {
    throw new Error(`Machine was not found in "${snapshot.uri}".`);
  }

  return machine;
};

const pathEquals = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  return left.length === right.length && left.every((part, index) => part === right[index]);
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

const handleAnalyzeFile = <
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  sourceWorker: DevtoolsSourceWorker<Event, Typegen>,
  params: AnalyzeFileParams,
): SourceDocumentSnapshot<Event, Typegen> | SourceDocumentUpdate<Event, Typegen> => {
  const existing = sourceWorker.getDocument(params.uri);
  const result = existing
    ? sourceWorker.updateDocument(params.uri, params.text, params.version)
    : sourceWorker.openDocument(params.uri, params.text, params.version);

  if (params.displayedMachineIndex === undefined) {
    return result;
  }

  return sourceWorker.setDisplayedMachine(params.uri, params.displayedMachineIndex);
};

export const createDevtoolsWorkerProtocol = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  sourceWorker: DevtoolsSourceWorker<Event, Typegen> =
    createDevtoolsSourceWorker<Event, Typegen>(),
): DevtoolsWorkerProtocol<Event, Typegen> => {
  const handleRequest = (request: DevtoolsWorkerRequest): DevtoolsWorkerResponse => {
    if (request.protocol !== devtoolsWorkerProtocolVersion) {
      return failure(
        request.id,
        "unsupported_protocol",
        `Unsupported protocol "${request.protocol}".`,
      );
    }

    try {
      switch (request.method) {
        case "analyzeFile": {
          return success(
            request.id,
            handleAnalyzeFile(sourceWorker, readAnalyzeFileParams(request.params)),
          );
        }
        case "updateDocument": {
          const params = readUpdateDocumentParams(request.params);
          return success(
            request.id,
            sourceWorker.updateDocument(params.uri, params.text, params.version),
          );
        }
        case "setDisplayedMachine": {
          const params = readSetDisplayedMachineParams(request.params);
          return success(
            request.id,
            sourceWorker.setDisplayedMachine(params.uri, params.machineIndex),
          );
        }
        case "getMachine": {
          const params = readMachineSelectorParams(request.params);
          return success(
            request.id,
            selectMachine(getDocumentOrThrow(sourceWorker, params.uri), params),
          );
        }
        case "compileTypegen": {
          const params = readMachineSelectorParams(request.params);
          const machine = selectMachine(
            getDocumentOrThrow(sourceWorker, params.uri),
            params,
          );
          return success<TypegenResult>(
            request.id,
            compileMobxstateTypes({ config: machine.config }),
          );
        }
        case "applyAcceptedTextEdits": {
          const params = readApplyAcceptedTextEditsParams(request.params);
          return success(
            request.id,
            sourceWorker.applyAcceptedTextEdits(
              params.uri,
              params.edits,
              params.version,
            ),
          );
        }
        case "getNodePosition": {
          const params = readGetNodePositionParams(request.params);
          const machine = selectMachine(
            getDocumentOrThrow(sourceWorker, params.uri),
            params,
          );
          const stateRange = machine.ranges.states.find((candidate) =>
            pathEquals(candidate.path, params.path),
          );

          if (!stateRange) {
            return failure(request.id, "range_not_found", "Node range was not found.");
          }

          return success<SourceStateRange>(request.id, stateRange);
        }
        case "getStoreBindingPosition": {
          const params = readGetStoreBindingPositionParams(request.params);
          const machine = selectMachine(
            getDocumentOrThrow(sourceWorker, params.uri),
            params,
          );
          const binding = machine.ranges.bindings.find((candidate) => {
            return (
              candidate.kind === params.kind &&
              (params.name === undefined || candidate.name === params.name) &&
              (params.path === undefined || pathEquals(candidate.path, params.path))
            );
          });

          if (!binding) {
            return failure(
              request.id,
              "range_not_found",
              "Store binding range was not found.",
            );
          }

          return success<SourceBindingRange>(request.id, binding);
        }
        case "formatExport": {
          const params = readMachineSelectorParams(request.params);
          const machine = selectMachine(
            getDocumentOrThrow(sourceWorker, params.uri),
            params,
          );
          return success<FormattedExport>(request.id, {
            text: `createMachine(${printConfigValue(machine.config)})`,
          });
        }
        case "closeDocument": {
          const params = readMachineSelectorParams(request.params);
          sourceWorker.closeDocument(params.uri);
          return success(request.id, { closed: true });
        }
        default:
          return failure(request.id, "method_not_found", "Unknown worker method.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.includes("not open")
        ? "document_not_found"
        : message.includes("Machine was not found")
          ? "machine_not_found"
          : "invalid_request";
      return failure(request.id, code, message);
    }
  };

  return {
    sourceWorker,
    handleRequest,
  };
};
