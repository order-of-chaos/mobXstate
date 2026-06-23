import { describe, expect, it } from "vitest";

import {
  createDevtoolsSourceWorker,
  createSourceDocumentCache,
  findCreateMachineCalls,
  readMachineConfigAst,
} from "../index";

const sourceText = `import { createMachine } from "@orderofchaos/mobxstate";

const unrelated = 1;

export const firstMachine = createMachine({
  id: "first",
  initial: "idle",
  states: {
    idle: {
      entry: "recordEntry",
      on: {
        START: { target: "loading", actions: "recordStart", cond: "canStart" }
      }
    },
    loading: {
      invoke: {
        id: "loadUser",
        src: "loadUser",
        onDone: { target: "ready", actions: "assignUser" }
      },
      after: {
        RETRY_DELAY: "idle"
      }
    },
    ready: { type: "final" }
  }
});

export default createMachine({
  id: "second",
  initial: "open",
  states: {
    open: {},
    closed: {}
  }
});
`;

describe("devtools source reader", () => {
  it("finds createMachine calls and reads safe object literal configs", () => {
    const calls = findCreateMachineCalls(sourceText);
    const result = readMachineConfigAst(sourceText, "file:///machine.ts");

    expect(calls).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
    expect(result.machines.map((machine) => machine.id)).toEqual([
      "first",
      "second",
    ]);
    expect(result.machines[0]?.config.initial).toBe("idle");
    expect(result.machines[0]?.graph.nodes.map((node) => node.id)).toContain(
      "first.loading",
    );
    expect(result.machines[0]?.ranges.states.map((state) => state.path)).toEqual([
      ["idle"],
      ["loading"],
      ["ready"],
    ]);
    expect(
      result.machines[0]?.ranges.transitions.map((transition) => ({
        sourcePath: transition.sourcePath,
        trigger: transition.trigger,
      })),
    ).toContainEqual({
      sourcePath: ["idle"],
      trigger: { kind: "on", key: "START" },
    });
    expect(
      result.machines[0]?.ranges.bindings.map((binding) => binding.kind),
    ).toEqual(expect.arrayContaining(["action", "guard", "delay", "effect"]));
  });

  it("supports type assertions and reports unsupported dynamic expressions", () => {
    const result = readMachineConfigAst(
      `import { createMachine } from "@orderofchaos/mobxstate";

const initialState = "idle";
export const machine = createMachine({
  id: "asserted",
  schema: {
    events: {} as Event
  },
  initial: initialState,
  states: {
    idle: {}
  }
} satisfies MachineConfig);
`,
      "file:///asserted.ts",
    );

    expect(result.machines[0]?.id).toBe("asserted");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unsupported_source_expression",
    ]);
  });

  it("tracks displayed machine changes and suppresses unrelated updates", () => {
    const cache = createSourceDocumentCache("file:///machine.ts", sourceText, 1);

    expect(cache.setDisplayedMachine(0).kind).toBe("document_updated");

    const unrelatedUpdate = cache.updateDocument(
      sourceText.replace("const unrelated = 1;", "const unrelated = 2;"),
      2,
    );

    expect(unrelatedUpdate.kind).toBe("displayed_machine_unchanged");

    const semanticUpdate = cache.updateDocument(
      sourceText.replace('initial: "idle"', 'initial: "loading"'),
      3,
    );

    expect(semanticUpdate.kind).toBe("displayed_machine_updated");
    expect(semanticUpdate.displayedMachine?.config.initial).toBe("loading");
  });

  it("reports missing displayed machine after source removal", () => {
    const cache = createSourceDocumentCache("file:///machine.ts", sourceText, 1);
    cache.setDisplayedMachine(1);

    const withoutSecondMachine = sourceText.slice(0, sourceText.indexOf("export default"));
    const update = cache.updateDocument(withoutSecondMachine, 2);

    expect(update.kind).toBe("displayed_machine_missing");
    expect(update.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "displayed_machine_missing",
    );
  });

  it("applies accepted text edits and reparses the current document text", () => {
    const cache = createSourceDocumentCache("file:///machine.ts", sourceText, 1);
    cache.setDisplayedMachine(0);

    const start = sourceText.indexOf('target: "loading"');
    const edit = {
      range: {
        start,
        end: start + 'target: "loading"'.length,
      },
      text: 'target: "ready"',
    };
    const update = cache.applyAcceptedTextEdits([edit], 2);

    expect(update.kind).toBe("displayed_machine_updated");
    expect(
      update.displayedMachine?.graph.edges.find((edge) => {
        return edge.trigger.kind === "on" && edge.trigger.key === "START";
      })?.target,
    ).toBe("ready");
  });

  it("provides a worker-like facade over document caches", () => {
    const worker = createDevtoolsSourceWorker();

    const opened = worker.openDocument("file:///machine.ts", sourceText, 1);
    expect(opened.machines).toHaveLength(2);

    expect(worker.setDisplayedMachine("file:///machine.ts", 0).kind).toBe(
      "document_updated",
    );
    expect(
      worker.updateDocument(
        "file:///machine.ts",
        sourceText.replace("const unrelated = 1;", "const unrelated = 3;"),
        2,
      ).kind,
    ).toBe("displayed_machine_unchanged");

    worker.closeDocument("file:///machine.ts");
    expect(worker.getDocument("file:///machine.ts")).toBeUndefined();
  });
});
