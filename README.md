# MobXstate

MobXstate adds finite state machines to MobX stores with a statechart-shaped,
Stately-friendly machine config and without a separate machine context.

MobXstate is an unofficial library for MobX. It is not affiliated with MobX,
Stately or XState.

## Install

```sh
npm install mobxstate mobx
```

## Docs

- Docs index: https://order-of-chaos.github.io/mobXstate/docs/
- Getting started: https://order-of-chaos.github.io/mobXstate/docs/getting-started/
- API reference: https://order-of-chaos.github.io/mobXstate/docs/api-reference/
- Examples: https://order-of-chaos.github.io/mobXstate/docs/examples/
- Live page: https://order-of-chaos.github.io/mobXstate/
- Releasing: https://github.com/order-of-chaos/mobXstate/blob/master/RELEASING.md

The canonical documentation for this package lives under
[`docs/`](https://github.com/order-of-chaos/mobXstate/tree/master/docs). Keep
API explanations, guides, and example references there. Use this README as the
package entrypoint that links readers to the stable public docs pages.

## Quick Start

```ts
import {
  MobXStateMachine,
  createMachine,
} from "mobxstate";

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

## Examples

- Public live demo: https://order-of-chaos.github.io/mobXstate/
- Examples guide: https://order-of-chaos.github.io/mobXstate/docs/examples/
- Repository examples: https://github.com/order-of-chaos/mobXstate/tree/master/examples

For local development:

```sh
npm run dev
```

Open `/examples/live/` in the Vite dev server. Strictly checked example files
live in
[`examples/standalone`](https://github.com/order-of-chaos/mobXstate/tree/master/examples/standalone).
