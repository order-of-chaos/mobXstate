import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
} from "@orderofchaos/mobxstate";

type CounterEvent =
  | { type: "INC"; by: number }
  | { type: "DEC"; by: number }
  | { type: "RESET" };

export const counterMachine = createMachine<CounterEvent>({
  id: "counter",
  predictableActionArguments: true,
  schema: {
    events: {} as CounterEvent,
  },
  initial: "active",
  states: {
    active: {
      on: {
        INC: {
          actions: "increment",
        },
        DEC: {
          actions: "decrement",
        },
        RESET: {
          actions: "reset",
        },
      },
    },
  },
});

export class CounterStore extends MobXStateMachine<
  CounterStore,
  CounterEvent
> {
  public count = 0;

  constructor() {
    super(counterMachine);

    makeObservable(this, {
      count: observable,
    });
  }

  public increment(event: CounterEvent): void {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }

  public decrement(event: CounterEvent): void {
    if (event.type === "DEC") {
      this.count -= event.by;
    }
  }

  public reset(): void {
    this.count = 0;
  }
}
