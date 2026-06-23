import { describe, expect, it } from "vitest";

import {
  analyzeMachineConfig,
  createMachine,
  machineConfigToGraph,
  validateMachineConfigForDevtools,
  type MachineOptions,
} from "../index";

type CheckoutEvent =
  | { type: "CHECKOUT" }
  | { type: "SUBMIT" }
  | { type: "RESET" };

describe("devtools machine analyzer", () => {
  it("builds a graph model from a MobXstate machine config", () => {
    const machine = createMachine<CheckoutEvent>({
      id: "checkout",
      initial: "cart",
      states: {
        cart: {
          on: {
            CHECKOUT: "payment",
          },
        },
        payment: {
          initial: "editing",
          states: {
            editing: {
              on: {
                SUBMIT: {
                  target: "submitting",
                  actions: ["trackSubmit"],
                  cond: "canSubmit",
                },
              },
            },
            submitting: {
              onDone: "#checkout.complete",
            },
          },
        },
        complete: {
          type: "final",
        },
      },
    });

    const graph = machineConfigToGraph(machine.config);

    expect(graph.id).toBe("checkout");
    expect(graph.diagnostics).toEqual([]);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "checkout",
      "checkout.cart",
      "checkout.payment",
      "checkout.payment.editing",
      "checkout.payment.submitting",
      "checkout.complete",
    ]);
    expect(graph.nodes.find((node) => node.id === "checkout.payment")?.type).toBe(
      "compound",
    );
    expect(graph.nodes.find((node) => node.id === "checkout.complete")?.type).toBe(
      "final",
    );

    const checkoutEdge = graph.edges.find((edge) => {
      return edge.trigger.kind === "on" && edge.trigger.key === "CHECKOUT";
    });
    expect(checkoutEdge?.sourcePath).toEqual(["cart"]);
    expect(checkoutEdge?.targetPath).toEqual(["payment"]);

    const submitEdge = graph.edges.find((edge) => {
      return edge.trigger.kind === "on" && edge.trigger.key === "SUBMIT";
    });
    expect(submitEdge?.sourcePath).toEqual(["payment", "editing"]);
    expect(submitEdge?.targetPath).toEqual(["payment", "submitting"]);
    expect(submitEdge?.actions).toEqual(["trackSubmit"]);
    expect(submitEdge?.guard).toBe("canSubmit");

    const doneEdge = graph.edges.find((edge) => {
      return edge.trigger.kind === "onDone" && edge.target === "#checkout.complete";
    });
    expect(doneEdge?.sourcePath).toEqual(["payment", "submitting"]);
    expect(doneEdge?.targetPath).toEqual(["complete"]);
  });

  it("reports structural diagnostics without throwing", () => {
    const machine = createMachine<CheckoutEvent>({
      id: "broken",
      initial: "missing",
      states: {
        active: {
          history: "deep",
          on: {
            RESET: "nowhere",
          },
        },
        parent: {
          states: {
            child: {},
          },
        },
      },
    });

    const diagnostics = validateMachineConfigForDevtools(machine.config);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unknown_initial",
      "unsupported_deep_history",
      "unknown_transition_target",
      "missing_initial",
    ]);
  });

  it("tracks store bindings and strict missing implementation diagnostics", () => {
    type BindingEvent = { type: "START" } | { type: "DONE" };
    interface BindingScope {
      readonly enabled: boolean;
    }

    const machine = createMachine<BindingEvent>({
      id: "bindings",
      initial: "idle",
      states: {
        idle: {
          on: {
            START: {
              target: "loading",
              cond: "canStart",
              actions: ["recordStart", "missingAction"],
            },
          },
        },
        loading: {
          invoke: {
            id: "loadData",
            src: "loadData",
            onDone: {
              target: "ready",
              actions: "recordDone",
            },
          },
          after: {
            slowDelay: {
              target: "idle",
            },
          },
        },
        ready: {},
      },
    });

    const machineOptions: MachineOptions<BindingScope, BindingEvent> = {
      actions: {
        recordStart() {
          return undefined;
        },
        recordDone() {
          return undefined;
        },
      },
      guards: {
        canStart() {
          return true;
        },
      },
    };

    const analysis = analyzeMachineConfig(machine.config, {
      machineOptions,
      strictImplementations: true,
    });

    expect(
      analysis.graph.bindings.map((binding) => ({
        kind: binding.kind,
        name: binding.name,
        implemented: binding.implemented,
      })),
    ).toEqual([
      { kind: "guard", name: "canStart", implemented: true },
      { kind: "action", name: "recordStart", implemented: true },
      { kind: "action", name: "missingAction", implemented: false },
      { kind: "delay", name: "slowDelay", implemented: false },
      { kind: "effect", name: "loadData", implemented: false },
      { kind: "action", name: "recordDone", implemented: true },
    ]);
    expect(analysis.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "missing_action_implementation",
      "missing_delay_implementation",
      "missing_effect_implementation",
    ]);
  });
});
