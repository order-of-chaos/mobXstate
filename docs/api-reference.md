# API Reference

## Primary Exports

- `createMachine(config)` creates a machine descriptor with a statechart-shaped
  config.
- `MobXStateMachine` starts and observes the machine through MobXstate's
  runtime.
- `MachineOptions<Store, Event, Typegen>` provides fallback and override
  `actions`, `guards`, `effects`, and `delays`.
- `MachineAction`, `MachineGuard`, and `MachineEffect` describe callback
  contracts where `this` is the MobX store and the first argument is the event.

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
- `snapshot` is the latest snapshot with `value`, `event`, and `matches(...)`.
- `send(event)` accepts object events and typed string events without required
  payload fields.
- `matches(state)` checks the current state.
- `ready` resolves after the internal actor has started.

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
  shallow history, `onDone`, `onError`, typed `send`, persistence validation,
  and persistence versioning.
- Removed: `MachineOptions.services`, `MachineOptions.activities`, state node
  `activities`, and callback invoke services.
- Explicit runtime error: `history: "deep"`.
- Out of scope: separate XState-style machine `context` runtime.
