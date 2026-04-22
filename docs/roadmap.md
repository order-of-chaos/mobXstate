# MobXstate Roadmap

This roadmap keeps the library focused on a MobX-first statechart model:

- machine config describes state flow;
- MobX stores own data, actions, guards, delays and lifecycle effects;
- `MachineOptions` remains a compatibility and override layer, not the primary
  authoring style.

## Phase 1: Public API Cleanup

Goal: make the happy path small, consistent and explainable before the first npm
release.

- Use `effects` as the public name for invoke fallbacks.
- Keep `MachineOptions.services` as a deprecated alias for callback-style
  migrations.
- Remove `activities` from documentation and examples.
- Keep `activities` as deprecated compatibility or remove it before the first
  public release.
- Update docs to use `statechart-shaped` and `Stately-compatible` wording
  instead of implying an XState runtime dependency.
- Add a feature support table:
  - supported: `entry`, `exit`, named actions, guards, delays, `after`,
    `always`, `invoke`, promise effects, cleanup effects, child machines,
    parallel states, final states, shallow history;
  - deprecated: `services`, `activities`;
  - unsupported or explicit error: deep history, advanced XState-only runtime
    features.

Done when:

- the README shows only store methods/getters/effects in primary examples;
- deprecated APIs are clearly marked;
- no example uses `activities`;
- package wording does not imply `xstate` is a dependency.

## Phase 2: Strict Runtime Validation

Goal: fail early with clear errors when a machine config cannot run correctly.

- Validate `initial` values against child states. Done for runtime config
  creation.
- Validate transition targets. Done for runtime config creation:
  - sibling targets;
  - nested dot targets;
  - absolute `#machineId.path` targets;
  - history targets.
- Throw a clear error for unsupported `history: "deep"`. Done for runtime
  config creation.
- Validate named store members in strict mode. Done for missing implementations:
  - missing action method or fallback action;
  - missing guard getter/method/property or fallback guard;
  - missing delay getter/method/property or fallback delay;
  - missing effect method or fallback effect/service;
  - missing cleanup/effect shape when invalid values are returned.
- Add `strict?: boolean` to `MachineStateConfig`. Done.
- Decide whether strict mode is default for development and opt-out for
  migration.

Done when:

- invalid config tests fail with actionable messages;
- valid examples still pass without extra setup;
- unknown targets cannot silently become no-op transitions.

## Phase 3: Stronger Types

Goal: catch common mistakes at compile time.

- Make `send` payload-aware:
  - object events always work;
  - string events are allowed only for event variants without extra payload.
- Add type tests for string `send`.
- Explore store-method type helpers so action names can receive narrowed event
  types without relying only on `MachineOptions`.
- Keep typegen-aware `MachineOptions` while store-method typing matures.
- Review public type names and remove legacy naming before the first stable
  release.

Done when:

- `send("RESET")` works for payloadless events;
- `send("INC")` fails if `INC` requires payload;
- type tests cover store-method and fallback `MachineOptions` usage.

## Phase 4: Runtime Semantics Hardening

Goal: make state transitions predictable under MobX and async effects.

- Batch a full macrostep in one MobX transaction:
  `exit -> transition actions -> entry -> snapshot publish`.
- Define error behavior:
  - action throws;
  - guard throws;
  - effect throws synchronously;
  - cleanup throws;
  - promise rejects after cancellation.
- For invoked effects, route synchronous errors into `onError` when possible.
- Validate persisted state before restore.
- Add persistence versioning and optional migration:
  - `version`;
  - `migrate`;
  - fallback to initial state on invalid saved data.

Done when:

- observers do not see partial transition states;
- effect cancellation behavior is tested;
- persistence is resilient to renamed or removed states.

## Phase 5: Packaging And Release Confidence

Goal: make the package reliable for real consumers.

- Add package smoke tests:
  - `npm pack`;
  - install tarball into a temp project;
  - ESM import;
  - CJS require;
  - TypeScript type import;
  - verify no `xstate` dependency.
- Add `repository`, `bugs` and `homepage` metadata.
- Reconsider package keywords:
  - keep `stately` and `statechart`;
  - use `xstate` only if compatibility wording is clear.
- Confirm `mobx` remains a peer dependency and a dev/test dependency.
- Document supported Node and TypeScript versions.

Done when:

- CI proves the packed package works outside this repo;
- npm metadata is complete;
- release docs describe exactly what is supported.

## Recommended Next Step

Start with Phase 1 and Phase 2 together:

1. Validate invalid effect return values and define sync error behavior.
2. Harden effect cancellation.
3. Add stronger `send` typing.

That gives the largest practical improvement before adding more surface area.
