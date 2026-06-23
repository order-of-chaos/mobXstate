import { describe, expect, it } from "vitest";

import {
  createDevtoolsWorkerProtocol,
  devtoolsWorkerProtocolVersion,
  type DevtoolsWorkerRequest,
  type DevtoolsWorkerResponse,
  type SourceBindingRange,
  type SourceDocumentSnapshot,
  type SourceDocumentUpdate,
  type SourceMachine,
  type SourceStateRange,
  type TypegenResult,
} from "../index";

const workerSource = `import { createMachine } from "@orderofchaos/mobxstate";

const unrelated = 1;

export const machine = createMachine({
  id: "workerMachine",
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
      }
    },
    ready: { type: "final" }
  }
});
`;

const uri = "file:///worker.ts";

const expectSuccess = <Result>(
  response: DevtoolsWorkerResponse,
): Result => {
  expect(response.ok).toBe(true);
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.result as Result;
};

const expectFailureCode = (
  response: DevtoolsWorkerResponse,
  code: string,
): void => {
  expect(response.ok).toBe(false);
  if (response.ok) {
    throw new Error("Expected worker response to fail.");
  }

  expect(response.error.code).toBe(code);
};

const request = (
  id: string,
  method: DevtoolsWorkerRequest["method"],
  params?: unknown,
): DevtoolsWorkerRequest => {
  return {
    protocol: devtoolsWorkerProtocolVersion,
    id,
    method,
    params,
  };
};

describe("devtools worker protocol", () => {
  it("opens a source document and returns a displayed-machine update", () => {
    const protocol = createDevtoolsWorkerProtocol();

    const result = expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
          displayedMachineIndex: 0,
        }),
      ),
    );

    expect(result.kind).toBe("document_updated");
    expect(result.displayedMachine?.id).toBe("workerMachine");
    expect(result.snapshot.machines).toHaveLength(1);
  });

  it("returns selected machine data and compiled typegen", () => {
    const protocol = createDevtoolsWorkerProtocol();
    expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
          displayedMachineIndex: 0,
        }),
      ),
    );

    const machine = expectSuccess<SourceMachine>(
      protocol.handleRequest(
        request("machine", "getMachine", {
          uri,
          machineId: "workerMachine",
        }),
      ),
    );
    const typegen = expectSuccess<TypegenResult>(
      protocol.handleRequest(
        request("typegen", "compileTypegen", {
          uri,
          machineIndex: 0,
        }),
      ),
    );

    expect(machine.config.initial).toBe("idle");
    expect(machine.graph.nodes.map((node) => node.id)).toContain(
      "workerMachine.loading",
    );
    expect(typegen.moduleText).toContain('"@@mobxstate/typegen": true;');
    expect(typegen.moduleText).toContain('"recordStart": "START";');
  });

  it("resolves state and store binding source positions", () => {
    const protocol = createDevtoolsWorkerProtocol();
    expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
          displayedMachineIndex: 0,
        }),
      ),
    );

    const stateRange = expectSuccess<SourceStateRange>(
      protocol.handleRequest(
        request("node", "getNodePosition", {
          uri,
          path: ["loading"],
        }),
      ),
    );
    const bindingRange = expectSuccess<SourceBindingRange>(
      protocol.handleRequest(
        request("binding", "getStoreBindingPosition", {
          uri,
          kind: "effect",
          name: "loadUser",
          path: ["loading"],
        }),
      ),
    );

    expect(stateRange.range.start).toBeGreaterThan(0);
    expect(stateRange.range.end).toBeGreaterThan(stateRange.range.start);
    expect(bindingRange.name).toBe("loadUser");
    expect(bindingRange.range.end).toBeGreaterThan(bindingRange.range.start);
  });

  it("updates source text and reparses accepted edits", () => {
    const protocol = createDevtoolsWorkerProtocol();
    expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
          displayedMachineIndex: 0,
        }),
      ),
    );

    const unrelatedUpdate = expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("update", "updateDocument", {
          uri,
          text: workerSource.replace("const unrelated = 1;", "const unrelated = 2;"),
          version: 2,
        }),
      ),
    );
    const targetStart = workerSource.indexOf('target: "loading"');
    const acceptedEdit = expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("edit", "applyAcceptedTextEdits", {
          uri,
          version: 3,
          edits: [
            {
              range: {
                start: targetStart,
                end: targetStart + 'target: "loading"'.length,
              },
              text: 'target: "ready"',
            },
          ],
        }),
      ),
    );

    expect(unrelatedUpdate.kind).toBe("displayed_machine_unchanged");
    expect(acceptedEdit.kind).toBe("displayed_machine_updated");
    expect(
      acceptedEdit.displayedMachine?.graph.edges.find((edge) => {
        return edge.trigger.kind === "on" && edge.trigger.key === "START";
      })?.target,
    ).toBe("ready");
  });

  it("formats selected machine export and closes source documents", () => {
    const protocol = createDevtoolsWorkerProtocol();
    expectSuccess<SourceDocumentUpdate>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
          displayedMachineIndex: 0,
        }),
      ),
    );

    const exportResult = expectSuccess<{ readonly text: string }>(
      protocol.handleRequest(
        request("export", "formatExport", {
          uri,
          machineId: "workerMachine",
        }),
      ),
    );
    const closeResult = expectSuccess<{ readonly closed: boolean }>(
      protocol.handleRequest(request("close", "closeDocument", { uri })),
    );

    expect(exportResult.text).toContain("createMachine({");
    expect(exportResult.text).toContain('id: "workerMachine"');
    expect(closeResult.closed).toBe(true);
    expectFailureCode(
      protocol.handleRequest(request("missing", "getMachine", { uri })),
      "document_not_found",
    );
  });

  it("reports protocol and machine lookup errors without throwing", () => {
    const protocol = createDevtoolsWorkerProtocol();
    expectFailureCode(
      protocol.handleRequest({
        protocol: "unsupported",
        id: "bad-protocol",
        method: "analyzeFile",
      } as unknown as DevtoolsWorkerRequest),
      "unsupported_protocol",
    );

    expectSuccess<SourceDocumentSnapshot>(
      protocol.handleRequest(
        request("open", "analyzeFile", {
          uri,
          text: workerSource,
          version: 1,
        }),
      ),
    );
    expectFailureCode(
      protocol.handleRequest(
        request("missing-machine", "getMachine", {
          uri,
          machineId: "missing",
        }),
      ),
      "machine_not_found",
    );
  });
});
