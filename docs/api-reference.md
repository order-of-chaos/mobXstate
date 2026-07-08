# API Reference

## Primary Exports

- `createMachine(config)` creates a machine descriptor with a statechart-shaped
  config.
- `MobXStateMachine` starts and observes the machine through MobXstate's
  runtime.
- `@orderofchaos/mobxstate/decorators` exports a decorator-compatible
  `MobXStateMachine` with the same inheritance API for stores that use MobX
  property decorators.
- `MachineOptions<Store, Event, Typegen>` provides fallback and override
  `actions`, `guards`, `effects`, and `delays`.
- `MachineAction`, `MachineGuard`, and `MachineEffect` describe callback
  contracts where `this` is the MobX store and the first argument is the event.

## MobX Decorator Stores

Use the default package entrypoint when subclasses call `makeObservable` with an
annotation map:

```ts
import { MobXStateMachine } from "@orderofchaos/mobxstate";
```

Use the decorators entrypoint when subclasses use MobX property decorators:

```ts
import { MobXStateMachine } from "@orderofchaos/mobxstate/decorators";
import { makeObservable, observable } from "mobx";

class CounterStore extends MobXStateMachine<CounterStore, CounterEvent> {
  @observable
  public count = 0;

  constructor() {
    super(counterMachine);
    makeObservable(this);
  }
}
```

Both entrypoints keep the same `extends MobXStateMachine<Store, Event>` store
shape and share the same state machine runtime.

## State Props

State nodes can carry static data through `props`:

```ts
const machine = createMachine({
  id: "quest",
  props: { music: "calm" },
  initial: "greeting",
  states: {
    greeting: {
      props: { dialog: "hello", music: "menu" },
      entry: "runDialog",
    },
  },
});
```

- Props merge along the node path: the root first, deeper nodes override.
- Actions read the owning node's merged props from `meta.props`.
- The store exposes the merged props of the active configuration as the
  observable computed `props` (parallel branches merge in activation order).
- Props are static config data: they are frozen at machine creation and never
  change at runtime — reactivity comes from the active state changing.

## Action Meta

Every named action receives `(event, meta)` where `meta` contains:

- `action` — the resolved action object (`{ type }` plus any inline fields).
- `event` — the event that triggered the action.
- `state` — the key of the state node the action is declared on (for
  transition actions: the source node).
- `statePath` — the dot-joined path of that node from the machine root; an
  empty string for the root itself.
- `props` — the merged static props of that node.
- `kind` — the execution phase: `"entry"`, `"exit"`, `"transition"`, or
  `"stop"` for exit actions that run because the machine is being stopped.

`meta` is self-contained on purpose: during a macrostep the observable
`state`/`snapshot` are not updated yet, so actions should read `meta`, not the
store's observable machine fields.

## Runtime Behavior

- Named actions resolve to store methods first and run inside `runInAction`.
- Named guards resolve to store getters, boolean properties, or pure methods.
- Named delays resolve to store number getters, properties, or methods.
- Full macrosteps are batched in one MobX transaction.
- `invoke: "methodName"` starts a store lifecycle effect that may return a
  promise, cleanup function, child machine, or `void`.
- Promise rejections and synchronous invoke failures route through `onError`
  when possible.
- Action and guard failures are fatal runtime errors and clean up active
  resources before rethrowing.
- Cleanup failures are reported as `MachineCleanupError` after all cleanup
  functions have been attempted.

## Observable State

- `state` is the current observable state value.
- `snapshot` is the latest snapshot with `value`, `event`, `props`, and
  `matches(...)`.
- `props` is the observable computed with the merged static props of the
  active configuration.
- `send(event)` accepts object events and typed string events without required
  payload fields.
- `matches(state)` checks the current state.
- `ready` resolves after the internal actor has started.

## Root Final State

Reaching a final state at the machine root does not stop the machine: the MobX
store keeps living with its data. Instead the machine reports completion:

- `isDone` is an observable flag set to `true` once the root reaches a final
  state; it resets on `startMachine`/`restart`.
- `onDone` is a public callback (same shape as `onStop`) called once per run
  with the `done.invoke.<machineId>` event. Override or reassign it to react —
  for example, call `stopMachine()` there to get terminate-on-final semantics.

Nested final states keep working through `onDone` transitions on the parent
state node, as before.

## Persistence

- `persistentKey` stores the current state under `MachinesStorage`.
- Saved values are validated before restore.
- `version` stores versioned persistence records.
- `transformPersistedState(state, fromVersion)` can normalize persisted values
  before validation.

## Feature Support

- Supported: `entry`, `exit`, named actions, named guards, named delays,
  numeric delays, `after`, `always`, `invoke`, promise effects, cleanup
  effects, child machines, nested states, parallel states, final states,
  root `onDone`/`isDone`, state `props`, action meta (`state`, `statePath`,
  `props`, `kind`), shallow history, `onDone`, `onError`, typed `send`,
  persistence validation, and persistence versioning.
- Removed: `MachineOptions.services`, `MachineOptions.activities`, state node
  `activities`, and callback invoke services.
- Explicit runtime error: `history: "deep"`.
- Out of scope: separate machine `context` runtime.
