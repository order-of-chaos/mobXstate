#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const loadBuiltCompiler = async () => {
  const builtEntry = path.join(repoRoot, "dist", "index.mjs");

  try {
    return await import(pathToFileURL(builtEntry).href);
  } catch (error) {
    throw new Error(
      `Unable to load ${builtEntry}. Run npm run build before using this local CLI. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const loadTypescript = async () => {
  try {
    return await import("typescript");
  } catch (error) {
    throw new Error(
      `Unable to load TypeScript. Install dependencies before using this CLI. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = {
    command,
    files: [],
    write: command === "typegen",
    check: command === "check",
    json: false,
  };

  rest.forEach((arg) => {
    if (arg === "--write") {
      options.write = true;
      options.check = false;
      return;
    }

    if (arg === "--check") {
      options.check = true;
      options.write = false;
      return;
    }

    if (arg === "--json") {
      options.json = true;
      return;
    }

    options.files.push(arg);
  });

  return options;
};

const printUsage = () => {
  process.stdout.write(`Usage:
  node scripts/mobxstate-devtools.mjs check <files...> [--json]
  node scripts/mobxstate-devtools.mjs typegen <files...> [--write|--check] [--json]

Examples:
  node scripts/mobxstate-devtools.mjs check src/**/*.ts
  node scripts/mobxstate-devtools.mjs typegen src/machine.ts --write
`);
};

const isTsSource = (filePath) => {
  return [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(filePath));
};

const listFiles = async (entryPath) => {
  const stats = await fs.stat(entryPath);
  if (stats.isFile()) {
    return isTsSource(entryPath) ? [entryPath] : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== "node_modules" && entry.name !== "dist")
      .map((entry) => listFiles(path.join(entryPath, entry.name))),
  );

  return nested.flat();
};

const expandDoubleStarPattern = async (pattern) => {
  const marker = "**/";
  const markerIndex = pattern.indexOf(marker);
  if (markerIndex < 0) {
    return [pattern];
  }

  const root = pattern.slice(0, markerIndex) || ".";
  const suffix = pattern.slice(markerIndex + marker.length);
  const files = await listFiles(path.resolve(root));

  if (suffix === "*.ts") {
    return files.filter((file) => file.endsWith(".ts"));
  }

  if (suffix.startsWith("*")) {
    const extension = suffix.slice(1);
    return files.filter((file) => file.endsWith(extension));
  }

  return files.filter((file) => file.endsWith(suffix));
};

const expandFiles = async (patterns) => {
  const expanded = await Promise.all(
    patterns.map(async (pattern) => {
      if (pattern.includes("**/")) {
        return expandDoubleStarPattern(pattern);
      }

      return listFiles(path.resolve(pattern));
    }),
  );

  return Array.from(new Set(expanded.flat())).sort((left, right) =>
    left.localeCompare(right),
  );
};

const getPropertyName = (ts, name) => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
};

const unwrapExpression = (ts, expression) => {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    (ts.isSatisfiesExpression?.(current) ?? false) ||
    ts.isTypeAssertionExpression?.(current)
  ) {
    current = current.expression;
  }

  return current;
};

const literalToValue = (ts, expression, diagnostics, filePath) => {
  const current = unwrapExpression(ts, expression);

  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
    return current.text;
  }

  if (ts.isNumericLiteral(current)) {
    return Number(current.text);
  }

  if (current.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (current.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.map((element) =>
      literalToValue(ts, element, diagnostics, filePath),
    );
  }

  if (ts.isObjectLiteralExpression(current)) {
    const result = {};
    current.properties.forEach((property) => {
      if (!ts.isPropertyAssignment(property)) {
        diagnostics.push({
          filePath,
          severity: "error",
          message: "Only object literal property assignments are supported.",
        });
        return;
      }

      const name = getPropertyName(ts, property.name);
      if (!name) {
        diagnostics.push({
          filePath,
          severity: "error",
          message: "Computed property names are not supported.",
        });
        return;
      }

      result[name] = literalToValue(ts, property.initializer, diagnostics, filePath);
    });
    return result;
  }

  diagnostics.push({
    filePath,
    severity: "error",
    message: `Unsupported createMachine config expression: ${current.getText()}`,
  });
  return undefined;
};

const isCreateMachineCall = (ts, node) => {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  const expression = node.expression;
  return (
    (ts.isIdentifier(expression) && expression.text === "createMachine") ||
    (ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "createMachine")
  );
};

const extractMachineConfigs = (ts, sourceFile, filePath) => {
  const diagnostics = [];
  const configs = [];

  const visit = (node) => {
    if (isCreateMachineCall(ts, node)) {
      const [firstArg] = node.arguments;
      if (!firstArg) {
        diagnostics.push({
          filePath,
          severity: "error",
          message: "createMachine call has no config argument.",
        });
      } else {
        const value = literalToValue(ts, firstArg, diagnostics, filePath);
        if (value && typeof value === "object") {
          configs.push(value);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { configs, diagnostics };
};

const formatTsDiagnostic = (ts, diagnostic, filePath) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const position =
    diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : undefined;

  return {
    filePath,
    severity: "error",
    message: position
      ? `${message} (${position.line + 1}:${position.character + 1})`
      : message,
  };
};

const getTypegenPath = (sourcePath) => {
  const extension = path.extname(sourcePath);
  return `${sourcePath.slice(0, -extension.length)}.mobxstate.typegen.ts`;
};

const writeIfChanged = async (filePath, text, shouldWriteTypegenFile) => {
  let existingText;

  try {
    existingText = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const decision = shouldWriteTypegenFile(existingText, text);
  if (!decision.shouldWrite) {
    return decision;
  }

  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tmpPath, text);
  await fs.rename(tmpPath, filePath);
  return decision;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (
    !["check", "typegen"].includes(options.command) ||
    options.files.length === 0
  ) {
    printUsage();
    return options.command ? 1 : 0;
  }

  const ts = await loadTypescript();
  const { compileMobxstateTypes, shouldWriteTypegenFile } =
    await loadBuiltCompiler();
  const files = await expandFiles(options.files);
  const results = [];
  const diagnostics = [];

  for (const filePath of files) {
    const text = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    diagnostics.push(
      ...sourceFile.parseDiagnostics.map((diagnostic) =>
        formatTsDiagnostic(ts, diagnostic, filePath),
      ),
    );

    const extracted = extractMachineConfigs(ts, sourceFile, filePath);
    diagnostics.push(...extracted.diagnostics);

    if (extracted.configs.length === 0) {
      results.push({
        filePath,
        machines: 0,
        typegenPath: undefined,
        write: "skipped",
      });
      continue;
    }

    const compileResult = compileMobxstateTypes(
      extracted.configs.map((config) => ({ config })),
    );
    diagnostics.push(
      ...compileResult.diagnostics.map((diagnostic) => ({
        filePath,
        severity: diagnostic.severity,
        message: `${diagnostic.code} ${diagnostic.message}`,
      })),
    );

    const typegenPath = getTypegenPath(filePath);
    let write = "not_requested";

    if (options.command === "typegen" && options.write) {
      const decision = await writeIfChanged(
        typegenPath,
        compileResult.moduleText,
        shouldWriteTypegenFile,
      );
      write = decision.reason;
    } else if (options.command === "typegen" && options.check) {
      let existingText;
      try {
        existingText = await fs.readFile(typegenPath, "utf8");
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
      const decision = shouldWriteTypegenFile(
        existingText,
        compileResult.moduleText,
      );
      write = decision.reason;
      if (decision.shouldWrite) {
        diagnostics.push({
          filePath,
          severity: "error",
          message: `${typegenPath} is not up to date.`,
        });
      }
    }

    results.push({
      filePath,
      machines: extracted.configs.length,
      typegenPath,
      write,
    });
  }

  const output = {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    results,
    diagnostics,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    results.forEach((result) => {
      process.stdout.write(
        `${result.filePath}: ${result.machines} machine(s)${
          result.typegenPath ? ` -> ${result.typegenPath} (${result.write})` : ""
        }\n`,
      );
    });
    diagnostics.forEach((diagnostic) => {
      process.stderr.write(
        `${diagnostic.severity}: ${diagnostic.filePath}: ${diagnostic.message}\n`,
      );
    });
  }

  return output.ok ? 0 : 1;
};

run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
