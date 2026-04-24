# MobXstate Docs

MobXstate adds finite state machines to MobX stores with a statechart-shaped,
Stately-friendly machine config and without a separate machine context.

Use these pages as the canonical source of truth for the public package API and
example entrypoints.

## Start Here

- Read the [getting started guide](/docs/getting-started/) for install and the
  smallest working setup.
- Read the [API reference](/docs/api-reference/) for the current public surface
  and runtime behavior.
- Read the [examples guide](/docs/examples/) for the live page and standalone
  example files.

## Docs

- [Getting started](/docs/getting-started/)
- [API reference](/docs/api-reference/)
- [Examples](/docs/examples/)

## Package Shape

- `createMachine(...)` keeps the machine config close to XState authoring.
- `MobXStateMachine` keeps data, actions, guards, delays, and effects in the
  MobX store.
- `MachineOptions` remains available as a compatibility and override layer.

## Related Repo Docs

- Release process lives in
  [RELEASING.md](https://github.com/order-of-chaos/mobXstate/blob/master/RELEASING.md).
- Release planning notes live in
  [docs/roadmap.md](https://github.com/order-of-chaos/mobXstate/blob/master/docs/roadmap.md).
