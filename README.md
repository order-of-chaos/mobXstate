# MobXstate

MobXstate adds finite state machines to MobX stores with a statechart-shaped,
Stately-friendly machine config and without a separate machine context.

MobXstate is an unofficial library for MobX. It is not affiliated with MobX,
Stately or XState.

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

- `createMachine(config)` creates a machine descriptor with a statechart-shaped
  config.
- `MobXStateMachine` starts and observes the machine through MobXstate's runtime.
- Action names resolve to store methods first and run inside `runInAction`.
- Guard names resolve to store boolean getters/properties or pure methods and
  are evaluated through MobX `computed`.
- Delay names resolve to store number getters/properties or methods.
- Full macrosteps are batched in one MobX transaction, so observers see the
  final post-transition store data and snapshot together.
- `invoke: "methodName"` starts a store lifecycle effect. It may return a
  cleanup function, a promise or a child machine.
- Synchronous effect errors and promise rejections are routed through
  `onError` as `error.platform.<invokeId>` events.
- Action and guard errors are fatal runtime errors: the actor stops, active
  resources are cleaned up and the original error is rethrown.
- Cleanup failures are reported as `MachineCleanupError`; all cleanup functions
  are attempted before the error is thrown.
- `MachineOptions<Store, Event, Typegen>` contains `actions`, `guards`,
  `effects` and `delays` as a compatibility and override layer. With XState
  typegen, implementations are narrowed to the events that can call them.
- `MachineAction`, `MachineGuard` and `MachineEffect` describe callback
  contracts where `this` is the MobX store and the first argument is the event.
- `MachineStateConfig` controls runtime options: `persistentKey`, `stopped`,
  `version`, `transformPersistedState`, `deferStart` and `strict`. In strict
  mode, missing named actions, guards, delays and effects throw clear errors
  before the machine starts. `devTools` is accepted for config compatibility.
- `state` is the current observable state value.
- `snapshot` is the latest MobXstate snapshot with `value`, `event` and
  `matches(...)`.
- `send(event)` sends events to the machine. Object events always work; string
  sends are typed so only events without required payload fields are allowed.
- `matches(state)` checks the current state.
- `ready` resolves when the internal actor has started.
- `persistentKey` stores state value in `localStorage` under `MachinesStorage`.
  Saved values are validated against the current machine config before restore;
  stale or incomplete values fall back to the machine initial state and are
  overwritten on start.
- `version` stores a versioned persistence record.
  `transformPersistedState(state, fromVersion)` can normalize saved values
  before validation. Without `version`, the unversioned raw state-value storage
  format is preserved.

## Requirements

- Node.js 18 or newer.
- TypeScript 5 or newer for the shipped type declarations.
- MobX 6 is a peer dependency and must be installed by the application.

## Feature Support

| Status | Features |
| --- | --- |
| Supported | `entry`, `exit`, named actions, named guards, named delays, numeric delays, `after`, `always`, `invoke`, promise effects, cleanup effects, child machines, nested states, parallel states, final states, shallow history, `onDone`, `onError`, typed `send`, persistence validation and persistence versioning. |
| Removed | `MachineOptions.services`, `MachineOptions.activities`, state node `activities` and callback invoke services. Use store methods or `MachineOptions.effects` for lifecycle work. |
| Explicit error | Deep history via `history: "deep"` throws during runtime config creation. |
| Out of scope | A separate XState-style machine `context` runtime. MobX store fields, getters and methods are the context in this library. |

## Invoke Effects

`invoke: "methodName"` is the primary lifecycle API. In new code, implement
`methodName` on the MobX store or in `MachineOptions.effects`; return a promise,
a cleanup function, a child machine or `void`.

Long-running lifecycle work should be modeled as `invoke` plus a cleanup
function. If the effect needs to notify the machine, call `this.send(...)` from
the MobX store method.

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

Reusable library code stays under `src`.

## Roadmap

The release plan lives in [`docs/roadmap.md`](docs/roadmap.md). The current
release focus is consumer package smoke testing and final public type naming.
