import type {
  EventObject,
  MachineConfig,
  TypegenConstraint,
  TypegenDisabled,
} from "../MobXStateMachine/stateMachine";
import { machineConfigToGraph, type GraphModel } from "./machineAnalyzer";

export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export interface SourceDiagnostic {
  readonly code:
    | "create_machine_missing_config"
    | "unsupported_source_expression"
    | "unsupported_source_syntax"
    | "machine_config_missing_id"
    | "displayed_machine_missing";
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly range?: SourceRange;
}

export interface SourcePropertyRange {
  readonly path: readonly string[];
  readonly value: unknown;
  readonly range: SourceRange;
  readonly keyRange: SourceRange;
  readonly valueRange: SourceRange;
}

export interface SourceStateRange {
  readonly path: readonly string[];
  readonly range: SourceRange;
}

export interface SourceTransitionRange {
  readonly sourcePath: readonly string[];
  readonly trigger: {
    readonly kind: "on" | "after" | "always" | "onDone" | "onError";
    readonly key?: string;
  };
  readonly range: SourceRange;
}

export interface SourceBindingRange {
  readonly path: readonly string[];
  readonly kind: "action" | "guard" | "delay" | "effect";
  readonly name?: string;
  readonly range: SourceRange;
}

export interface SourceMachineRanges {
  readonly config: SourceRange;
  readonly call: SourceRange;
  readonly properties: readonly SourcePropertyRange[];
  readonly states: readonly SourceStateRange[];
  readonly transitions: readonly SourceTransitionRange[];
  readonly bindings: readonly SourceBindingRange[];
}

export interface SourceMachine<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly uri: string;
  readonly machineIndex: number;
  readonly id: string;
  readonly config: MachineConfig<Event, Typegen>;
  readonly graph: GraphModel;
  readonly ranges: SourceMachineRanges;
  readonly semanticHash: string;
}

export interface SourceReadResult<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly uri: string;
  readonly text: string;
  readonly machines: readonly SourceMachine<Event, Typegen>[];
  readonly diagnostics: readonly SourceDiagnostic[];
}

export interface SourceDocumentSnapshot<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> extends SourceReadResult<Event, Typegen> {
  readonly version: number;
  readonly displayedMachineIndex?: number;
}

export type SourceDocumentUpdateKind =
  | "document_updated"
  | "displayed_machine_updated"
  | "displayed_machine_unchanged"
  | "displayed_machine_missing";

export interface SourceDocumentUpdate<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly kind: SourceDocumentUpdateKind;
  readonly snapshot: SourceDocumentSnapshot<Event, Typegen>;
  readonly displayedMachine?: SourceMachine<Event, Typegen>;
  readonly diagnostics: readonly SourceDiagnostic[];
}

export interface SourceTextEdit {
  readonly range: SourceRange;
  readonly text: string;
}

export interface SourceDocumentCache<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  getSnapshot(): SourceDocumentSnapshot<Event, Typegen>;
  getDisplayedMachine(): SourceMachine<Event, Typegen> | undefined;
  setDisplayedMachine(machineIndex: number | undefined): SourceDocumentUpdate<Event, Typegen>;
  updateDocument(text: string, version: number): SourceDocumentUpdate<Event, Typegen>;
  applyAcceptedTextEdits(
    edits: readonly SourceTextEdit[],
    version: number,
  ): SourceDocumentUpdate<Event, Typegen>;
}

export interface DevtoolsSourceWorker<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  openDocument(
    uri: string,
    text: string,
    version: number,
  ): SourceDocumentSnapshot<Event, Typegen>;
  getDocument(uri: string): SourceDocumentSnapshot<Event, Typegen> | undefined;
  updateDocument(
    uri: string,
    text: string,
    version: number,
  ): SourceDocumentUpdate<Event, Typegen>;
  setDisplayedMachine(
    uri: string,
    machineIndex: number | undefined,
  ): SourceDocumentUpdate<Event, Typegen>;
  applyAcceptedTextEdits(
    uri: string,
    edits: readonly SourceTextEdit[],
    version: number,
  ): SourceDocumentUpdate<Event, Typegen>;
  closeDocument(uri: string): void;
}

interface ParsedObject {
  readonly value: Record<string, unknown>;
  readonly propertyRanges: readonly SourcePropertyRange[];
  readonly end: number;
}

const createRange = (start: number, end: number): SourceRange => {
  return { start, end };
};

const isIdentifierStart = (char: string | undefined): boolean => {
  return char !== undefined && /[A-Za-z_$]/.test(char);
};

const isIdentifierPart = (char: string | undefined): boolean => {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isObjectRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const skipTrivia = (text: string, offset: number): number => {
  let index = offset;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (/\s/.test(char ?? "")) {
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(index + 2, text.length);
      continue;
    }

    break;
  }

  return index;
};

const skipQuotedString = (text: string, offset: number, quote: string): number => {
  let index = offset + 1;

  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === quote) {
      return index + 1;
    }

    index += 1;
  }

  return text.length;
};

const skipTemplate = (text: string, offset: number): number => {
  let index = offset + 1;

  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === "`") {
      return index + 1;
    }

    if (char === "$" && text[index + 1] === "{") {
      index = skipBalanced(text, index + 1, "{", "}");
      continue;
    }

    index += 1;
  }

  return text.length;
};

const skipBalanced = (
  text: string,
  offset: number,
  open: string,
  close: string,
): number => {
  let depth = 0;
  let index = offset;

  while (index < text.length) {
    const char = text[index];

    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char);
      continue;
    }

    if (char === "`") {
      index = skipTemplate(text, index);
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }

    index += 1;
  }

  return text.length;
};

const readIdentifier = (
  text: string,
  offset: number,
): { readonly value: string; readonly end: number } | undefined => {
  if (!isIdentifierStart(text[offset])) {
    return undefined;
  }

  let index = offset + 1;
  while (isIdentifierPart(text[index])) {
    index += 1;
  }

  return {
    value: text.slice(offset, index),
    end: index,
  };
};

const readNumber = (
  text: string,
  offset: number,
): { readonly value: number; readonly end: number } | undefined => {
  const match = /^-?\d+(?:\.\d+)?/.exec(text.slice(offset));
  if (!match) {
    return undefined;
  }

  return {
    value: Number(match[0]),
    end: offset + match[0].length,
  };
};

class SafeObjectLiteralParser {
  private index: number;

  private readonly propertyRanges: SourcePropertyRange[] = [];

  public constructor(
    private readonly text: string,
    offset: number,
    private readonly diagnostics: SourceDiagnostic[],
  ) {
    this.index = offset;
  }

  public parseObject(path: readonly string[] = []): ParsedObject | undefined {
    this.index = skipTrivia(this.text, this.index);
    const start = this.index;

    if (this.text[this.index] !== "{") {
      this.addDiagnostic(
        "unsupported_source_syntax",
        "Expected object literal.",
        createRange(this.index, this.index + 1),
      );
      return undefined;
    }

    this.index += 1;
    const value: Record<string, unknown> = {};

    while (this.index < this.text.length) {
      this.index = skipTrivia(this.text, this.index);

      if (this.text[this.index] === "}") {
        this.index += 1;
        return {
          value,
          propertyRanges: this.propertyRanges,
          end: this.index,
        };
      }

      const keyStart = this.index;
      const key = this.parsePropertyKey();
      if (!key) {
        this.addDiagnostic(
          "unsupported_source_syntax",
          "Only plain property assignments are supported in machine config.",
          createRange(keyStart, Math.min(keyStart + 1, this.text.length)),
        );
        this.index = this.skipUnsupportedExpression();
        continue;
      }

      const keyEnd = this.index;
      this.index = skipTrivia(this.text, this.index);

      if (this.text[this.index] !== ":") {
        this.addDiagnostic(
          "unsupported_source_syntax",
          "Only property assignments are supported in machine config.",
          createRange(keyStart, keyEnd),
        );
        this.index = this.skipUnsupportedExpression();
        continue;
      }

      this.index += 1;
      const valueStart = skipTrivia(this.text, this.index);
      this.index = valueStart;
      const propertyValue = this.parseValue([...path, key]);
      value[key] = propertyValue;
      this.index = this.skipTypeSuffixes(this.index);
      const valueEnd = this.index;

      this.propertyRanges.push({
        path: [...path, key],
        value: propertyValue,
        range: createRange(keyStart, valueEnd),
        keyRange: createRange(keyStart, keyEnd),
        valueRange: createRange(valueStart, valueEnd),
      });

      this.index = skipTrivia(this.text, this.index);
      if (this.text[this.index] === ",") {
        this.index += 1;
      }
    }

    this.addDiagnostic(
      "unsupported_source_syntax",
      "Unterminated object literal.",
      createRange(start, this.text.length),
    );
    return undefined;
  }

  private parsePropertyKey(): string | undefined {
    const char = this.text[this.index];

    if (char === "\"" || char === "'") {
      const end = skipQuotedString(this.text, this.index, char);
      const raw = this.text.slice(this.index + 1, end - 1);
      this.index = end;
      return raw;
    }

    const identifier = readIdentifier(this.text, this.index);
    if (identifier) {
      this.index = identifier.end;
      return identifier.value;
    }

    const number = readNumber(this.text, this.index);
    if (number) {
      this.index = number.end;
      return String(number.value);
    }

    return undefined;
  }

  private parseValue(path: readonly string[]): unknown {
    this.index = skipTrivia(this.text, this.index);
    const char = this.text[this.index];

    if (char === "{") {
      return this.parseObject(path)?.value;
    }

    if (char === "[") {
      return this.parseArray(path);
    }

    if (char === "\"" || char === "'") {
      const end = skipQuotedString(this.text, this.index, char);
      const value = this.text.slice(this.index + 1, end - 1);
      this.index = end;
      return value;
    }

    if (char === "`") {
      return this.parseTemplateString();
    }

    const number = readNumber(this.text, this.index);
    if (number) {
      this.index = number.end;
      return number.value;
    }

    const identifier = readIdentifier(this.text, this.index);
    if (identifier) {
      this.index = identifier.end;
      if (identifier.value === "true") {
        return true;
      }

      if (identifier.value === "false") {
        return false;
      }

      if (identifier.value === "null") {
        return null;
      }

      this.addDiagnostic(
        "unsupported_source_expression",
        `Unsupported dynamic expression "${identifier.value}".`,
        createRange(identifier.end - identifier.value.length, identifier.end),
      );
      return undefined;
    }

    this.addDiagnostic(
      "unsupported_source_expression",
      "Unsupported source expression in machine config.",
      createRange(this.index, Math.min(this.index + 1, this.text.length)),
    );
    this.index = this.skipUnsupportedExpression();
    return undefined;
  }

  private parseArray(path: readonly string[]): unknown[] {
    this.index += 1;
    const values: unknown[] = [];

    while (this.index < this.text.length) {
      this.index = skipTrivia(this.text, this.index);

      if (this.text[this.index] === "]") {
        this.index += 1;
        return values;
      }

      values.push(this.parseValue(path));
      this.index = this.skipTypeSuffixes(this.index);
      this.index = skipTrivia(this.text, this.index);

      if (this.text[this.index] === ",") {
        this.index += 1;
      }
    }

    this.addDiagnostic(
      "unsupported_source_syntax",
      "Unterminated array literal.",
      createRange(this.index, this.text.length),
    );
    return values;
  }

  private parseTemplateString(): string | undefined {
    const start = this.index;
    let index = this.index + 1;
    let value = "";

    while (index < this.text.length) {
      const char = this.text[index];
      if (char === "\\") {
        value += this.text.slice(index, index + 2);
        index += 2;
        continue;
      }

      if (char === "$" && this.text[index + 1] === "{") {
        const end = skipTemplate(this.text, start);
        this.index = end;
        this.addDiagnostic(
          "unsupported_source_expression",
          "Template literal expressions are not supported in machine config.",
          createRange(start, end),
        );
        return undefined;
      }

      if (char === "`") {
        this.index = index + 1;
        return value;
      }

      value += char;
      index += 1;
    }

    this.index = this.text.length;
    this.addDiagnostic(
      "unsupported_source_syntax",
      "Unterminated template literal.",
      createRange(start, this.text.length),
    );
    return undefined;
  }

  private skipTypeSuffixes(offset: number): number {
    let index = skipTrivia(this.text, offset);
    const identifier = readIdentifier(this.text, index);

    if (!identifier || (identifier.value !== "as" && identifier.value !== "satisfies")) {
      return index;
    }

    index = identifier.end;
    let depth = 0;

    while (index < this.text.length) {
      const char = this.text[index];

      if (char === "\"" || char === "'") {
        index = skipQuotedString(this.text, index, char);
        continue;
      }

      if (char === "`") {
        index = skipTemplate(this.text, index);
        continue;
      }

      if (char === "<" || char === "(" || char === "[" || char === "{") {
        depth += 1;
      } else if (char === ">" || char === ")" || char === "]" || char === "}") {
        if (depth === 0) {
          return index;
        }
        depth -= 1;
      } else if (char === "," && depth === 0) {
        return index;
      }

      index += 1;
    }

    return index;
  }

  private skipUnsupportedExpression(): number {
    let index = this.index;
    let depth = 0;

    while (index < this.text.length) {
      const char = this.text[index];

      if (char === "\"" || char === "'") {
        index = skipQuotedString(this.text, index, char);
        continue;
      }

      if (char === "`") {
        index = skipTemplate(this.text, index);
        continue;
      }

      if (char === "(" || char === "[" || char === "{") {
        depth += 1;
      } else if (char === ")" || char === "]" || char === "}") {
        if (depth === 0) {
          return index;
        }
        depth -= 1;
      } else if (char === "," && depth === 0) {
        return index;
      }

      index += 1;
    }

    return index;
  }

  private addDiagnostic(
    code: SourceDiagnostic["code"],
    message: string,
    range: SourceRange,
  ): void {
    this.diagnostics.push({
      code,
      severity: "error",
      message,
      range,
    });
  }
}

const parseObjectLiteral = (
  text: string,
  offset: number,
  diagnostics: SourceDiagnostic[],
): ParsedObject | undefined => {
  return new SafeObjectLiteralParser(text, offset, diagnostics).parseObject();
};

const isCreateMachineName = (text: string, offset: number): boolean => {
  if (!text.startsWith("createMachine", offset)) {
    return false;
  }

  const previous = text[offset - 1];
  const next = text[offset + "createMachine".length];
  return !isIdentifierPart(previous) && !isIdentifierPart(next);
};

const findCallStart = (text: string, offset: number): number | undefined => {
  let index = skipTrivia(text, offset + "createMachine".length);

  if (text[index] === "<") {
    index = skipBalanced(text, index, "<", ">");
  }

  index = skipTrivia(text, index);
  return text[index] === "(" ? index : undefined;
};

export const findCreateMachineCalls = (text: string): readonly SourceRange[] => {
  const calls: SourceRange[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char);
      continue;
    }

    if (char === "`") {
      index = skipTemplate(text, index);
      continue;
    }

    if (char === "/" && (text[index + 1] === "/" || text[index + 1] === "*")) {
      index = skipTrivia(text, index);
      continue;
    }

    if (isCreateMachineName(text, index)) {
      const callStart = findCallStart(text, index);
      if (callStart !== undefined) {
        const callEnd = skipBalanced(text, callStart, "(", ")");
        calls.push(createRange(index, callEnd));
        index = callEnd;
        continue;
      }
    }

    index += 1;
  }

  return calls;
};

const getStatePathFromPropertyPath = (
  propertyPath: readonly string[],
): string[] | undefined => {
  const statePath: string[] = [];

  for (let index = 0; index < propertyPath.length - 1; index += 1) {
    if (propertyPath[index] === "states") {
      const stateKey = propertyPath[index + 1];
      if (stateKey) {
        statePath.push(stateKey);
        index += 1;
      }
    }
  }

  return statePath.length > 0 ? statePath : undefined;
};

const propertyIsStateNode = (propertyPath: readonly string[]): boolean => {
  return propertyPath.length >= 2 && propertyPath[propertyPath.length - 2] === "states";
};

const getTransitionRange = (
  property: SourcePropertyRange,
): SourceTransitionRange | undefined => {
  const path = property.path;
  const last = path[path.length - 1];
  const parent = path[path.length - 2];

  if (!last) {
    return undefined;
  }

  if (parent === "on") {
    return {
      sourcePath: getStatePathFromPropertyPath(path.slice(0, -2)) ?? [],
      trigger: { kind: "on", key: last },
      range: property.range,
    };
  }

  if (parent === "after") {
    return {
      sourcePath: getStatePathFromPropertyPath(path.slice(0, -2)) ?? [],
      trigger: { kind: "after", key: last },
      range: property.range,
    };
  }

  if (last === "always" || last === "onDone" || last === "onError") {
    return {
      sourcePath: getStatePathFromPropertyPath(path.slice(0, -1)) ?? [],
      trigger: { kind: last },
      range: property.range,
    };
  }

  return undefined;
};

const getBindingRange = (
  property: SourcePropertyRange,
): SourceBindingRange | undefined => {
  const last = property.path[property.path.length - 1];
  const name = typeof property.value === "string" ? property.value : undefined;

  if (last === "entry" || last === "exit" || last === "actions") {
    return {
      path: getStatePathFromPropertyPath(property.path.slice(0, -1)) ?? [],
      kind: "action",
      ...(name === undefined ? {} : { name }),
      range: property.range,
    };
  }

  if (last === "cond") {
    return {
      path: getStatePathFromPropertyPath(property.path.slice(0, -1)) ?? [],
      kind: "guard",
      ...(name === undefined ? {} : { name }),
      range: property.range,
    };
  }

  if (property.path[property.path.length - 2] === "after" && last !== undefined) {
    return {
      path: getStatePathFromPropertyPath(property.path.slice(0, -2)) ?? [],
      kind: "delay",
      name: last,
      range: property.keyRange,
    };
  }

  if (last === "src") {
    return {
      path: getStatePathFromPropertyPath(property.path.slice(0, -1)) ?? [],
      kind: "effect",
      ...(name === undefined ? {} : { name }),
      range: property.range,
    };
  }

  return undefined;
};

const createSourceMachineRanges = (
  callRange: SourceRange,
  configRange: SourceRange,
  properties: readonly SourcePropertyRange[],
): SourceMachineRanges => {
  return {
    config: configRange,
    call: callRange,
    properties,
    states: properties
      .filter((property) => propertyIsStateNode(property.path))
      .flatMap((property) => {
        const statePath = getStatePathFromPropertyPath(property.path);
        return statePath ? [{ path: statePath, range: property.range }] : [];
      }),
    transitions: properties.flatMap((property) => {
      const range = getTransitionRange(property);
      return range ? [range] : [];
    }),
    bindings: properties.flatMap((property) => {
      const range = getBindingRange(property);
      return range ? [range] : [];
    }),
  };
};

const isMachineConfig = (value: Record<string, unknown>): boolean => {
  return typeof value.id === "string";
};

export const readMachineConfigAst = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  text: string,
  uri = "memory://document.ts",
): SourceReadResult<Event, Typegen> => {
  const diagnostics: SourceDiagnostic[] = [];
  const machines: Array<SourceMachine<Event, Typegen>> = [];
  const calls = findCreateMachineCalls(text);

  calls.forEach((call, machineIndex) => {
    const callText = text.slice(call.start, call.end);
    const callStart = call.start + callText.indexOf("(");
    const configStart = skipTrivia(text, callStart + 1);

    if (text[configStart] !== "{") {
      diagnostics.push({
        code: "create_machine_missing_config",
        severity: "error",
        message: "createMachine(...) must use an object literal config for source read mode.",
        range: createRange(configStart, Math.min(configStart + 1, text.length)),
      });
      return;
    }

    const localDiagnostics: SourceDiagnostic[] = [];
    const parsed = parseObjectLiteral(text, configStart, localDiagnostics);
    diagnostics.push(...localDiagnostics);

    if (!parsed) {
      return;
    }

    if (!isMachineConfig(parsed.value)) {
      diagnostics.push({
        code: "machine_config_missing_id",
        severity: "error",
        message: "Machine config must include a string id for source read mode.",
        range: createRange(configStart, parsed.end),
      });
      return;
    }

    const config = parsed.value as unknown as MachineConfig<Event, Typegen>;
    const graph = machineConfigToGraph<object, Event, Typegen>(config);
    const ranges = createSourceMachineRanges(
      call,
      createRange(configStart, parsed.end),
      parsed.propertyRanges,
    );

    machines.push({
      uri,
      machineIndex,
      id: config.id,
      config,
      graph,
      ranges,
      semanticHash: stableStringify(config),
    });
  });

  return {
    uri,
    text,
    machines,
    diagnostics,
  };
};

const applyTextEditsToText = (
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

class SourceDocumentCacheImpl<
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> implements SourceDocumentCache<Event, Typegen>
{
  private snapshot: SourceDocumentSnapshot<Event, Typegen>;

  public constructor(uri: string, text: string, version: number) {
    this.snapshot = this.createSnapshot(uri, text, version, undefined);
  }

  public getSnapshot = (): SourceDocumentSnapshot<Event, Typegen> => {
    return this.snapshot;
  };

  public getDisplayedMachine = (): SourceMachine<Event, Typegen> | undefined => {
    const index = this.snapshot.displayedMachineIndex;
    return index === undefined
      ? undefined
      : this.snapshot.machines.find((machine) => machine.machineIndex === index);
  };

  public setDisplayedMachine = (
    machineIndex: number | undefined,
  ): SourceDocumentUpdate<Event, Typegen> => {
    this.snapshot = {
      ...this.snapshot,
      displayedMachineIndex: machineIndex,
    };

    const displayedMachine = this.getDisplayedMachine();

    if (machineIndex !== undefined && !displayedMachine) {
      const diagnostic = this.createDisplayedMissingDiagnostic(machineIndex);
      return {
        kind: "displayed_machine_missing",
        snapshot: this.snapshot,
        diagnostics: [...this.snapshot.diagnostics, diagnostic],
      };
    }

    return {
      kind: "document_updated",
      snapshot: this.snapshot,
      displayedMachine,
      diagnostics: this.snapshot.diagnostics,
    };
  };

  public updateDocument = (
    text: string,
    version: number,
  ): SourceDocumentUpdate<Event, Typegen> => {
    const previousDisplayed = this.getDisplayedMachine();
    const displayedMachineIndex = this.snapshot.displayedMachineIndex;
    this.snapshot = this.createSnapshot(
      this.snapshot.uri,
      text,
      version,
      displayedMachineIndex,
    );
    const displayedMachine = this.getDisplayedMachine();

    if (displayedMachineIndex !== undefined && !displayedMachine) {
      const diagnostic = this.createDisplayedMissingDiagnostic(displayedMachineIndex);
      return {
        kind: "displayed_machine_missing",
        snapshot: this.snapshot,
        diagnostics: [...this.snapshot.diagnostics, diagnostic],
      };
    }

    if (previousDisplayed && displayedMachine) {
      return {
        kind:
          previousDisplayed.semanticHash === displayedMachine.semanticHash
            ? "displayed_machine_unchanged"
            : "displayed_machine_updated",
        snapshot: this.snapshot,
        displayedMachine,
        diagnostics: this.snapshot.diagnostics,
      };
    }

    return {
      kind: "document_updated",
      snapshot: this.snapshot,
      displayedMachine,
      diagnostics: this.snapshot.diagnostics,
    };
  };

  public applyAcceptedTextEdits = (
    edits: readonly SourceTextEdit[],
    version: number,
  ): SourceDocumentUpdate<Event, Typegen> => {
    return this.updateDocument(applyTextEditsToText(this.snapshot.text, edits), version);
  };

  private createSnapshot = (
    uri: string,
    text: string,
    version: number,
    displayedMachineIndex: number | undefined,
  ): SourceDocumentSnapshot<Event, Typegen> => {
    const result = readMachineConfigAst<Event, Typegen>(text, uri);
    return {
      ...result,
      version,
      ...(displayedMachineIndex === undefined ? {} : { displayedMachineIndex }),
    };
  };

  private createDisplayedMissingDiagnostic = (
    machineIndex: number,
  ): SourceDiagnostic => {
    return {
      code: "displayed_machine_missing",
      severity: "error",
      message: `Displayed machine index ${machineIndex} is no longer present in the source document.`,
    };
  };
}

export const createSourceDocumentCache = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  uri: string,
  text: string,
  version: number,
): SourceDocumentCache<Event, Typegen> => {
  return new SourceDocumentCacheImpl(uri, text, version);
};

export const createDevtoolsSourceWorker = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(): DevtoolsSourceWorker<Event, Typegen> => {
  const documents = new Map<string, SourceDocumentCache<Event, Typegen>>();

  const getCache = (uri: string): SourceDocumentCache<Event, Typegen> => {
    const cache = documents.get(uri);
    if (!cache) {
      throw new Error(`Source document "${uri}" is not open.`);
    }

    return cache;
  };

  return {
    openDocument(uri, text, version) {
      const cache = createSourceDocumentCache<Event, Typegen>(uri, text, version);
      documents.set(uri, cache);
      return cache.getSnapshot();
    },
    getDocument(uri) {
      return documents.get(uri)?.getSnapshot();
    },
    updateDocument(uri, text, version) {
      return getCache(uri).updateDocument(text, version);
    },
    setDisplayedMachine(uri, machineIndex) {
      return getCache(uri).setDisplayedMachine(machineIndex);
    },
    applyAcceptedTextEdits(uri, edits, version) {
      return getCache(uri).applyAcceptedTextEdits(edits, version);
    },
    closeDocument(uri) {
      documents.delete(uri);
    },
  };
};
