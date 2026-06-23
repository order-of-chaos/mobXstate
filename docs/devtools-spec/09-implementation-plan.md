# 09. План реализации

## Цель

Идти маленькими проверяемыми срезами: каждый этап должен давать reusable
слой, публичные TypeScript-контракты и focused tests до перехода к следующему
слою.

## Порядок работ

### Этап 1. Devtools core analyzer

Статус: готово.

Результат:

- `analyzeMachineConfig`;
- `machineConfigToGraph`;
- `validateMachineConfigForDevtools`;
- `GraphModel`, `GraphStateNode`, `GraphTransitionEdge`;
- diagnostics без запуска пользовательского кода;
- store binding references для actions, guards, delays и effects.

Definition of Done:

- analyzer строит graph из `MachineConfig`;
- unknown initial, missing initial, deep history и unknown target дают
  diagnostics;
- strict mode показывает missing store implementations, если переданы
  `MachineOptions` или store scope;
- слой не зависит от React, IDE API и runtime actor internals.

### Этап 2. Runtime bridge и viewer model

Статус: готово.

Результат:

- `createRuntimeBridge`;
- `createRuntimeModel`;
- read-only runtime snapshot model;
- active node ids;
- event candidates для simulator controls.

Definition of Done:

- bridge работает с существующим `MobXStateMachine`;
- `send`, `start`, `stop`, `restart` прокидываются без знания actor internals;
- подписка уведомляет viewer при изменении observable state/snapshot;
- model строится из `MachineStateValue` и `GraphModel`.

### Этап 3. Simulator controls

Статус: готово.

Результат:

- event palette на основе `RuntimeModel.eventCandidates`;
- отправка payloadless events;
- ручной ввод event object;
- snapshot history для UI.

Definition of Done:

- simulator не исполняет произвольный source code;
- disabled/unknown runtime state отображается явно;
- tests покрывают payloadless string events и object events.

### Этап 4. Draft editor model

Статус: готово.

Результат:

- `DraftModel`;
- команды add/rename/remove state;
- команды add/edit/remove transition;
- undo/redo;
- export обратно в `MachineConfig`.

Definition of Done:

- editor-команды не мутируют исходный config;
- validation запускается после каждой команды;
- export проходит `createMachine(...)`;
- команды можно позднее преобразовать в `SemanticEditCommand`.

### Этап 5. Type compiler и CLI

Статус: готово.

Результат:

- сбор store binding map;
- stable typegen printer;
- no-op write suppression;
- `mobxstate-devtools check`;
- `mobxstate-devtools typegen`.

Definition of Done:

- compiler не выполняет пользовательский код;
- generated output стабилен между запусками;
- `--check` имеет non-zero exit code на errors;
- no-op typegen не пишет файл.

### Этап 6. Source reader и worker

Статус: готово.

Результат:

- поиск `createMachine(...)` в TypeScript;
- `SourceDocumentCache`;
- semantic source ranges;
- patch preview model;
- reparse после accepted patch.

Definition of Done:

- modern TypeScript fixtures покрыты;
- unsupported syntax дает diagnostic, а не crash;
- stale source changes не сбрасывают UI без semantic change.

### Этап 7. IDE shells

Статус: начат.

Готово в текущем срезе:

- shared worker protocol поверх source reader и type compiler;
- методы `analyzeFile`, `updateDocument`, `setDisplayedMachine`, `getMachine`,
  `compileTypegen`, `applyAcceptedTextEdits`;
- source navigation методы для state node и store binding ranges;
- formatting/export и close document commands;
- focused tests для worker protocol contract.
- VS Code shell core для команд, diagnostics, panel payload, typegen write и
  accepted edits через native host boundary;
- `extensions/vscode` manifest scaffold с командами extension.
- VS Code native adapter: activation wrapper, diagnostics collection mapping,
  webview panel host, `workspace.fs.writeFile` и `WorkspaceEdit` bridge.
- VS Code extension build config и shared webview UI builder.
- Graph-first visual editor UI: React Flow webview bundle, host-side
  `DraftModel` session, `DRAFT_COMMAND`/`DRAFT_UPDATED` webview protocol,
  `Editor`/`Simulation` modes, draggable local node positions,
  state/transition inspector forms и undo/redo.
- Visual editor layout persistence: side-aware handles, custom edge labels and
  compressed `@mobxstate` layout metadata comments applied through VS Code
  `WorkspaceEdit`, then restored from source when the editor is reopened.

Порядок:

1. Source patch preview для accepted editor changes.
2. WebStorm plugin shell.
3. Zed diagnostics/typegen.
4. Zed visual UI только после стабильной API-возможности.

Definition of Done:

- IDE shells не содержат собственный analyzer/type compiler;
- diagnostics и source edits идут через shared worker protocol;
- accepted patches применяются только через native IDE write action.

## Текущий первый milestone

Milestone считается закрытым, когда в основном package есть:

- devtools analyzer;
- runtime bridge;
- simulator controller;
- draft editor model;
- type compiler и local CLI;
- source reader и source document cache;
- shared worker protocol для IDE shells;
- focused tests;
- публичные экспорты из `src/index.ts`;
- зеленые `npm test`, `npm run typecheck`, `npm run lint`.
