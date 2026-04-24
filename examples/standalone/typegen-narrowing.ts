import type { MachineOptions } from "mobxstate";

type CheckoutEvent =
  | { type: "SELECT_TABLE"; payload: { bet: number } }
  | { type: "SUBMIT_PAYMENT"; payload: { paymentId: string } };

interface CheckoutTypegen {
  "@@xstate/typegen": true;
  internalEvents: Record<string, never>;
  invokeSrcNameMap: Record<string, never>;
  missingImplementations: {
    actions: "sitAtMoneyTable" | "submitPayment";
    delays: never;
    guards: never;
  };
  eventsCausingActions: {
    sitAtMoneyTable: "SELECT_TABLE";
    submitPayment: "SUBMIT_PAYMENT";
  };
  eventsCausingDelays: Record<string, never>;
  eventsCausingGuards: Record<string, never>;
  eventsCausingServices: Record<string, never>;
  matchesStates: "idle" | "ready";
  tags: never;
}

class CheckoutStore {
  public selectedBet = 0;

  public paymentId = "";
}

export const checkoutOptions: MachineOptions<
  CheckoutStore,
  CheckoutEvent,
  CheckoutTypegen
> = {
  actions: {
    sitAtMoneyTable(event) {
      this.selectedBet = event.payload.bet;
    },
    submitPayment(event) {
      this.paymentId = event.payload.paymentId;
    },
  },
};
