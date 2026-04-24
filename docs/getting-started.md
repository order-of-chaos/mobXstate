# Getting Started

## Install

```sh
npm install @orderofchaos/mobxstate mobx
```

## Smallest Working Example

```ts
import {
  MobXStateMachine,
  createMachine,
} from "@orderofchaos/mobxstate";

type CounterEvent =
  | { type: "RESET" }
  | { type: "INC"; by: number };

const counterMachine = createMachine<CounterEvent>({
  id: "counter",
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

class CounterStore extends MobXStateMachine<CounterStore, CounterEvent> {
  public count = 0;

  constructor() {
    super(counterMachine);
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
```

## Mental Model

- The machine config describes allowed state flow.
- MobX store methods implement actions and lifecycle effects.
- MobX getters, boolean properties, and pure methods implement guards.
- Number getters, properties, and methods can back named delays.

## Requirements

- Node.js 18 or newer.
- TypeScript 5 or newer for the shipped declarations.
- MobX 6 installed by the consuming application.

## Next Steps

- Continue with the [API reference](/docs/api-reference/) for runtime behavior
  and feature support.
- Open the [examples guide](/docs/examples/) for the live demo and standalone
  samples.
