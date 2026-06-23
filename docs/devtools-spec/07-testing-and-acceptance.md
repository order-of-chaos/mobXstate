# 07. Testing And Acceptance

## Цель

Devtools должен быть безопасным для пользовательских machine configs. Основная
ошибка, которую нельзя допустить: visual editor или IDE plugin silently rewrites
valid TypeScript into broken code.

## Test layers

### Unit tests

Для `devtools-core`:

- normalize transition string;
- normalize transition object;
- normalize transition arrays;
- normalize `entry`, `exit`, `actions`;
- parse nested paths;
- parse absolute targets;
- parse `after`, `always`, `onDone`, `onError`;
- graph conversion;
- graph round-trip back to config;
- diagnostics for invalid config.

Для `devtools-typegen`:

- matches states;
- internal events;
- events causing actions;
- events causing guards;
- events causing delays;
- events causing effects;
- missing store members;
- stable output sorting.

Для `devtools-source`:

- find `createMachine(...)`;
- reject unsupported AST safely;
- patch simple object literal;
- preserve untouched source;
- produce diff preview.
- apply semantic edit commands;
- reparse source after accepted patch;
- preserve current machine index or report missing machine;
- suppress editor updates when unrelated source changes do not alter the
  displayed machine semantic model.

### Integration tests

Scenarios:

- simple atomic machine;
- nested compound machine;
- parallel machine;
- final state with `onDone`;
- shallow history;
- delayed `after`;
- transient `always`;
- invoke with `onDone`;
- invoke with `onError`;
- actions and guards;
- numeric and named delays;
- child machine invoke;
- persisted machine config.

Each scenario should test:

- analyzer output;
- graph output;
- diagnostics;
- viewer rendering smoke;
- export round-trip;
- typegen output when applicable.

### UI tests

For standalone viewer/editor:

- graph renders non-empty;
- active state highlight changes after send;
- simulator sends event;
- inspector updates on node/edge selection;
- diagnostics panel appears;
- edit command changes draft;
- undo/redo restores draft;
- export text updates.

Use Playwright for browser-level tests once UI exists.

### IDE tests

VS Code:

- command registration;
- webview opens;
- message round-trip;
- diagnostics collection updates;
- patch preview opens;
- typegen file write.

WebStorm:

- action registration;
- Tool Window opens;
- JCEF loads web bundle;
- diagnostics map to source ranges;
- write action applies accepted patch.

Zed:

- extension starts worker;
- diagnostics command works;
- typegen command works;
- external preview command works if included.

## Golden fixtures

Create fixtures under a future test package:

```text
fixtures/machines/simple-toggle.ts
fixtures/machines/nested-checkout.ts
fixtures/machines/parallel-workflow.ts
fixtures/machines/invoke-loader.ts
fixtures/machines/history-flow.ts
fixtures/machines/invalid-target.ts
fixtures/machines/missing-store-bindings.ts
fixtures/source/multiple-machines.ts
fixtures/source/export-default-machine.ts
fixtures/source/satisfies-machine.ts
fixtures/source/mts-machine.mts
fixtures/source/cts-machine.cts
fixtures/source/template-literal-descriptions.ts
fixtures/source/external-unrelated-edit.ts
fixtures/source/machine-removed-while-open.ts
```

Each fixture should include:

- source file;
- expected normalized JSON;
- expected graph JSON;
- expected diagnostics;
- expected typegen file if valid.

## Acceptance gates by phase

### Phase 1: Viewer/Simulator

Required:

- all analyzer unit tests pass;
- graph fixtures stable;
- viewer renders simple, nested and parallel machines;
- simulator sends payloadless and object events;
- active state highlight follows `MobXStateMachine.state`;
- no editing controls enabled.

### Phase 2: Visual Editor

Required:

- all draft commands are undoable;
- all draft commands validate;
- export passes runtime validation;
- rename state updates transition targets;
- delete state detects affected transitions;
- unsupported config sections remain read-only or preserved;
- no source file writes.

### Phase 3: Type Compiler

Required:

- generated typegen stable;
- generated typegen compiles with package type tests;
- missing implementations diagnostics match strict runtime intent;
- no-op typegen write is skipped;
- CLI `check` exits non-zero on errors;
- CLI `--write` only writes generated files.

### Phase 4: VS Code

Required:

- extension opens viewer/editor for current `createMachine(...)`;
- diagnostics are visible in Problems;
- typegen command works;
- patch preview is required before source edits;
- unsupported source falls back to export.
- external source changes update the open editor only when the displayed
  machine changed.

### Phase 5: WebStorm

Required:

- Tool Window opens with selected machine;
- diagnostics appear as inspections or notifications;
- typegen command works;
- source patch runs inside IDE write action;
- UI bundle is shared with VS Code.

### Phase 6: Zed

Required:

- diagnostics/typegen work without visual UI;
- visual preview is external unless stable native UI API exists;
- Zed integration does not block release of core devtools.

## Performance requirements

Initial targets:

- analyze a 100-state machine under 100 ms in Node worker;
- graph conversion under 50 ms for 100 states;
- typegen under 200 ms for a single file with TypeScript program warm;
- viewer first render under 500 ms for 100 states;
- patch generation under 100 ms for supported AST.

These are targets, not hard promises for the first prototype. Regressions should
be tracked once baseline tests exist.

## Safety requirements

- No eval of user TypeScript in static analyzer.
- No source write without preview.
- No destructive change without undo in editor draft.
- No continued source editing against stale AST after a patch.
- No generated typegen write when generated output is unchanged.
- No IDE-specific fork of analyzer logic.
- No hidden dependency on XState runtime.
- No silent drop of supported `MachineConfig` fields during export.

## Documentation requirements

Each release must document:

- supported MobXstate config fields;
- unsupported fields;
- known source patch limitations;
- typegen filename convention;
- plugin commands;
- troubleshooting diagnostics.
