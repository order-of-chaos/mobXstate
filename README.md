# MobXstate

MobXstate adds finite state machines to MobX stores with an XState-shaped
machine config and without a separate machine context.

```ts
import {
  MobXStateMachine,
  createMachine,
} from "mobxstate";

type CounterEvent = { type: "INC"; by: number };

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
      },
    },
  },
});

class CounterStore extends MobXStateMachine<CounterStore, CounterEvent> {
  count = 0;

  constructor() {
    super(counterMachine);
  }

  increment(event: CounterEvent) {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }
}
```

The machine config stays close to XState, so the Stately/XState VSCode extension
can still detect `createMachine(...)` calls. Execution is handled by MobXstate's
own runtime, not by the XState interpreter. Runtime implementations are passed to
`MobXStateMachine` and are resolved from the MobX store first. `MachineOptions`
is still available as an advanced fallback, but the primary model is: machine
config describes state flow, store methods and getters implement behavior.

## API

- `createMachine(config)` creates a machine descriptor with an XState-shaped
  config.
- `MobXStateMachine` starts and observes the machine through MobXstate's runtime.
- `BaseMachineState` is kept as a legacy alias.
- Action names resolve to store methods first and run inside `runInAction`.
- Guard names resolve to store boolean getters/properties or pure methods and
  are evaluated through MobX `computed`.
- Delay names resolve to store number getters/properties or methods.
- `invoke: "methodName"` starts a store lifecycle effect. It may return a
  cleanup function, a promise or a child machine.
- `MachineOptions<Store, Event, Typegen>` contains `actions`, `guards`,
  `effects` and `delays` as a compatibility and override layer. Legacy
  `services` and `activities` are still accepted for migrations.
  With XState typegen, implementations are narrowed to the events that can call
  them.
- `MachineAction`, `MachineGuard` and `MachineEffect` describe callback
  contracts where `this` is the MobX store and the first argument is the event.
- `MachineStateConfig` controls runtime options: `persistentKey`, `stopped`,
  `deferStart` and `strict`. In strict mode, missing named actions, guards,
  delays and effects throw clear errors before the machine starts. `devTools`
  is accepted for config compatibility.
- `state` is the current observable state value.
- `snapshot` is the latest MobXstate snapshot with `value`, `event` and
  `matches(...)`.
- `send(event)` sends events to the machine.
- `matches(state)` checks the current state.
- `ready` resolves when the internal actor has started.
- `persistentKey` stores state value in `localStorage` under `MachinesStorage`.

## Migration

Old callback style:

```ts
actions: {
  selectTable(context, event) {
    context.store.selectTable(event.payload.id);
  },
}
```

MobXstate callback style:

```ts
class GameStore extends MobXStateMachine<GameStore, GameEvent> {
  selectTable(event: GameEvent) {
    if (event.type === "SELECT_TABLE") {
      this.selectTableById(event.payload.id);
    }
  }
}
```

Use regular functions for callbacks that need the store. Arrow functions keep
their lexical `this`, so they cannot receive the MobX store instance.

## Examples

Live page:

```sh
npm run dev
```

Open `/examples/live/` in the Vite dev server.

Strictly checked examples live in `examples/standalone`:

- `counter.ts` covers regular actions on a MobX store.
- `async-loader.ts` covers promise invoke and `onDone`.
- `live-stream.ts` covers lifecycle effects and cleanup.
- `parallel-checkout.ts` covers parallel regions and parent `onDone`.
- `traffic-light.ts` covers entry actions and named delays.
- `typegen-narrowing.ts` covers typegen-aware action event narrowing.
- `wizard-flow.ts` covers nested states, shallow history, guards and invoke
  error handling.

The larger card game migration sample lives in `examples/card-game`. It keeps
external app imports, so it is linted but not part of standalone typecheck.
Reusable library code stays under `src`.

## Roadmap

The release plan lives in [`docs/roadmap.md`](docs/roadmap.md). The next focus
is completing strict runtime validation and stronger `send` typing.
