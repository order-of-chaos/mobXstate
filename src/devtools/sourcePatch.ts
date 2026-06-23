import type { SourceMachine, SourcePropertyRange, SourceTextEdit } from "./sourceReader";
import type { VisualEditorDraftCommandMessage } from "./visualEditorSession";

export type SourcePatchPreviewFailureCode =
  | "invalid_command"
  | "unsupported_command"
  | "unsupported_source";

export interface SourcePatchPreviewSuccess {
  readonly ok: true;
  readonly id: string;
  readonly title: string;
  readonly edits: readonly SourceTextEdit[];
  readonly previewText: string;
}

export interface SourcePatchPreviewFailure {
  readonly ok: false;
  readonly code: SourcePatchPreviewFailureCode;
  readonly message: string;
}

export type SourcePatchPreview =
  | SourcePatchPreviewSuccess
  | SourcePatchPreviewFailure;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const pathEquals = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  return left.length === right.length && left.every((part, index) => part === right[index]);
};

const pathStartsWith = (
  path: readonly string[],
  prefix: readonly string[],
): boolean => {
  return prefix.every((part, index) => path[index] === part);
};

export const applySourceTextEdits = (
  text: string,
  edits: readonly SourceTextEdit[],
): string => {
  return [...edits]
    .sort((left, right) => right.range.start - left.range.start)
    .reduce((current, edit) => {
      return `${current.slice(0, edit.range.start)}${edit.text}${current.slice(
        edit.range.end,
      )}`;
    }, text);
};

const failure = (
  code: SourcePatchPreviewFailureCode,
  message: string,
): SourcePatchPreviewFailure => {
  return { ok: false, code, message };
};

const getLineIndent = (text: string, offset: number): string => {
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const match = /^[ \t]*/.exec(text.slice(lineStart, offset));
  return match?.[0] ?? "";
};

const findLastNonWhitespace = (
  text: string,
  start: number,
  end: number,
): number => {
  let index = end - 1;
  while (index >= start && /\s/.test(text[index] ?? "")) {
    index -= 1;
  }

  return index;
};

const printPropertyKey = (key: string): string => {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
};

const createStatesPropertyPath = (parentPath: readonly string[]): string[] => {
  return parentPath.reduce<string[]>((path, stateKey) => {
    path.push("states", stateKey);
    return path;
  }, []).concat("states");
};

const findProperty = (
  properties: readonly SourcePropertyRange[],
  path: readonly string[],
): SourcePropertyRange | undefined => {
  return properties.find((property) => pathEquals(property.path, path));
};

const findChildIndent = (
  text: string,
  properties: readonly SourcePropertyRange[],
  statesProperty: SourcePropertyRange,
): string => {
  const child = properties.find((property) => {
    return (
      property.path.length === statesProperty.path.length + 1 &&
      pathStartsWith(property.path, statesProperty.path)
    );
  });

  return child
    ? getLineIndent(text, child.range.start)
    : `${getLineIndent(text, statesProperty.valueRange.end - 1)}  `;
};

const readAddStateParams = (
  params: unknown,
): { readonly parentPath: readonly string[]; readonly key: string } | undefined => {
  if (!isRecord(params) || !Array.isArray(params.parentPath)) {
    return undefined;
  }

  const parentPath = params.parentPath;
  if (!parentPath.every((part) => typeof part === "string")) {
    return undefined;
  }

  const key = typeof params.key === "string" ? params.key.trim() : "";
  if (key.length === 0) {
    return undefined;
  }

  return { parentPath, key };
};

const getStateConfig = (
  machine: SourceMachine,
  path: readonly string[],
): Record<string, unknown> | undefined => {
  let current: unknown = machine.config;

  for (const key of path) {
    if (!isRecord(current) || !isRecord(current.states)) {
      return undefined;
    }

    current = current.states[key];
  }

  return isRecord(current) ? current : undefined;
};

const createInsertStateEdit = (
  text: string,
  machine: SourceMachine,
  parentPath: readonly string[],
  key: string,
): SourceTextEdit | undefined => {
  const statesProperty = findProperty(
    machine.ranges.properties,
    createStatesPropertyPath(parentPath),
  );
  if (!statesProperty) {
    return undefined;
  }

  const openBrace = statesProperty.valueRange.start;
  const closeBrace = findLastNonWhitespace(
    text,
    statesProperty.valueRange.start,
    statesProperty.valueRange.end,
  );
  if (text[openBrace] !== "{" || text[closeBrace] !== "}") {
    return undefined;
  }

  const lastContent = findLastNonWhitespace(text, openBrace + 1, closeBrace);
  const isEmpty = lastContent < openBrace + 1;
  const childIndent = findChildIndent(text, machine.ranges.properties, statesProperty);
  const closingIndent = getLineIndent(text, closeBrace);

  if (isEmpty) {
    return {
      range: {
        start: openBrace + 1,
        end: closeBrace,
      },
      text: `\n${childIndent}${printPropertyKey(key)}: {}\n${closingIndent}`,
    };
  }

  const needsComma = text[lastContent] !== ",";
  return {
    range: {
      start: lastContent + 1,
      end: lastContent + 1,
    },
    text: `${needsComma ? "," : ""}\n${childIndent}${printPropertyKey(key)}: {}`,
  };
};

export const createVisualEditorSourcePatchPreview = (
  text: string,
  machine: SourceMachine,
  command: VisualEditorDraftCommandMessage,
): SourcePatchPreview => {
  if (command.type !== "DRAFT_COMMAND") {
    return failure("invalid_command", "Expected a visual editor draft command.");
  }

  if (command.command !== "addState") {
    return failure(
      "unsupported_command",
      `Source patch preview does not support "${command.command}" yet.`,
    );
  }

  const params = readAddStateParams(command.params);
  if (!params) {
    return failure("invalid_command", "Expected addState params with parentPath and key.");
  }

  const parentConfig = getStateConfig(machine, params.parentPath);
  if (!parentConfig || !isRecord(parentConfig.states)) {
    return failure(
      "unsupported_source",
      "Source patch can add a state only into an existing states object.",
    );
  }

  if (Object.prototype.hasOwnProperty.call(parentConfig.states, params.key)) {
    return failure(
      "invalid_command",
      `State "${params.key}" already exists in the selected parent.`,
    );
  }

  const edit = createInsertStateEdit(text, machine, params.parentPath, params.key);
  if (!edit) {
    return failure(
      "unsupported_source",
      "Source patch could not find a safe object-literal insertion range.",
    );
  }

  const edits = [edit];
  return {
    ok: true,
    id: `source-patch:${machine.uri}:${machine.machineIndex}:${command.command}:${params.parentPath.join(".")}:${params.key}`,
    title: `Add state "${params.key}"`,
    edits,
    previewText: applySourceTextEdits(text, edits),
  };
};
