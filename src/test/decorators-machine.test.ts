import { makeObservable, observable } from "mobx";
import { describe, expect, it } from "vitest";

import {
  createMachine,
  MobXStateMachine,
} from "../decorators";

type CounterEvent =
  | { type: "INC"; by: number }
  | { type: "RESET" };

const counterMachine = createMachine<CounterEvent>({
  id: "decoratedCounter",
  predictableActionArguments: true,
  schema: {
    events: {} as CounterEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
        RESET: {
          actions: "reset",
        },
      },
    },
  },
});

class DecoratedCounterStore extends MobXStateMachine<
  DecoratedCounterStore,
  CounterEvent
> {
  @observable
  public count = 0;

  constructor() {
    super(counterMachine, { deferStart: false });

    makeObservable(this);
  }

  public increment(event: CounterEvent): void {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }

  public reset(): void {
    this.count = 0;
  }
}

describe("decorator-compatible MobXStateMachine", () => {
  it("lets subclasses use MobX decorators without changing the extends style", async () => {
    const store = new DecoratedCounterStore();

    await store.ready;
    store.send({ type: "INC", by: 2 });
    store.send("RESET");

    expect(store.matches("idle")).toBe(true);
    expect(store.count).toBe(0);
  });
});
