import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
} from "@orderofchaos/mobxstate";

type CheckoutFlowEvent =
  | { type: "ADDRESS_DONE" }
  | { type: "PAYMENT_DONE" }
  | { type: "CANCEL" };

export const parallelCheckoutMachine = createMachine<CheckoutFlowEvent>({
  id: "parallelCheckout",
  predictableActionArguments: true,
  schema: {
    events: {} as CheckoutFlowEvent,
  },
  initial: "running",
  states: {
    running: {
      type: "parallel",
      states: {
        address: {
          initial: "editing",
          states: {
            editing: {
              on: {
                ADDRESS_DONE: "done",
              },
            },
            done: {
              type: "final",
            },
          },
        },
        payment: {
          initial: "editing",
          states: {
            editing: {
              on: {
                PAYMENT_DONE: "done",
              },
            },
            done: {
              type: "final",
            },
          },
        },
      },
      on: {
        CANCEL: "cancelled",
      },
      onDone: {
        target: "complete",
        actions: "recordComplete",
      },
    },
    complete: {},
    cancelled: {},
  },
});

export class ParallelCheckoutStore extends MobXStateMachine<
  ParallelCheckoutStore,
  CheckoutFlowEvent
> {
  public completedOrders = 0;

  constructor() {
    super(parallelCheckoutMachine);

    makeObservable(this, {
      completedOrders: observable,
    });
  }

  public recordComplete(): void {
    this.completedOrders += 1;
  }
}
