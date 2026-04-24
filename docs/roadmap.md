# MobXstate Roadmap

This roadmap keeps the library focused on a MobX-first statechart model:

- machine config describes state flow;
- MobX stores own data, actions, guards, delays and lifecycle effects;
- `MachineOptions` remains a compatibility and override layer, not the primary
  authoring style.

## Phase 1: Public API Cleanup

Goal: make the happy path small, consistent and explainable before the first npm
release.

- Use `effects` as the public name for invoke fallbacks. Done.
- Remove `MachineOptions.services` and callback-style invoke services. Done.
- Remove `MachineOptions.activities` and state node `activities`. Done.
- Update docs to use `statechart-shaped` and `Stately-compatible` wording
  instead of implying an XState runtime dependency. Done.
- Add a feature support table:
  - supported: `entry`, `exit`, named actions, guards, delays, `after`,
    `always`, `invoke`, promise effects, cleanup effects, child machines,
    parallel states, final states, shallow history;
  - removed: `services`, `activities`;
  - unsupported or explicit error: deep history, advanced XState-only runtime
    features. Done.

Done when:

- the README shows only store methods/getters/effects in primary examples;
- removed APIs are documented as removed;
- no example uses `services` or `activities`;
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
  - missing effect method or fallback effect;
  - missing cleanup/effect shape when invalid values are returned. Done for
    strict invoke effects.
- Add `strict?: boolean` to `MachineStateConfig`. Done.
- Keep `strict: false` as the first-release default and recommend `strict: true`
  for new code in docs.

Done when:

- invalid config tests fail with actionable messages;
- valid examples still pass without extra setup;
- unknown targets cannot silently become no-op transitions.

## Phase 3: Stronger Types

Goal: catch common mistakes at compile time.

- Make `send` payload-aware. Done:
  - object events always work;
  - string events are allowed only for event variants without required payload.
- Add type tests for string `send`. Done.
- Explore store-method type helpers so action names can receive narrowed event
  types without relying only on `MachineOptions`.
- Keep typegen-aware `MachineOptions` while store-method typing matures.
- Keep `MobXStateMachine` as the only public class name. Done.

Done when:

- `send("RESET")` works for payloadless events;
- `send("INC")` fails if `INC` requires payload;
- type tests cover store-method and fallback `MachineOptions` usage.

## Phase 4: Runtime Semantics Hardening

Goal: make state transitions predictable under MobX and async effects.

- Batch a full macrostep in one MobX transaction. Done:
  `exit -> transition actions -> entry -> snapshot publish`.
- Define error behavior:
  - action throws. Done: actor stops, resources clean up, original error is
    rethrown;
  - guard throws. Done: actor stops, resources clean up, original error is
    rethrown;
  - effect throws synchronously. Done for invoked effects via `onError`;
  - cleanup throws. Done: all cleanups are attempted and failures are reported
    as `MachineCleanupError`;
  - promise rejects after cancellation. Done for invoked promises.
- For invoked effects, route synchronous errors into `onError` when possible.
  Done.
- Validate persisted state before restore. Done: stale, nested-invalid and
  incomplete parallel values fall back to initial state.
- Add persistence versioning and optional restore transforms. Done:
  - `version`;
  - `transformPersistedState`;
  - fallback to initial state on invalid saved data.

Done when:

- observers do not see partial transition states;
- effect cancellation behavior is tested;
- persistence is resilient to renamed or removed states.

## Phase 5: Packaging And Release Confidence

Goal: make the package reliable for real consumers.

- Add package smoke tests:
  - `npm pack`. Done;
  - install tarball into a temp project. Done;
  - ESM import. Done;
  - CJS require. Done;
  - TypeScript type import. Done;
  - verify no `xstate` dependency. Done.
- Add `repository`, `bugs` and `homepage` metadata. Done; verify the final
  GitHub URL before publish.
- Reconsider package keywords:
  - keep `stately` and `statechart`;
  - use `xstate` only if compatibility wording is clear.
- Confirm `mobx` remains a peer dependency and a dev/test dependency. Done.
- Document supported Node and TypeScript versions. Done.

Done when:

- CI proves the packed package works outside this repo. Done;
- npm metadata is complete;
- release docs describe exactly what is supported.

## Recommended Next Step

Before publishing:

1. Decide whether the `xstate` keyword should stay for Stately discoverability
   or be removed to avoid compatibility confusion.
2. Explore store-method type helpers after the package release path is stable.

That keeps the first npm release focused on a stable install and import story.
