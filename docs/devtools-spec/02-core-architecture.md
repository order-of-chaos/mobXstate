# 02. Core Architecture

## Цель архитектуры

Сделать devtools переносимым между standalone web page, VS Code, WebStorm и
Zed. Вся MobXstate-логика должна жить в shared core. IDE-плагины должны быть
тонкими оболочками.

## Предлагаемые пакеты

```text
packages/devtools-core
  analyzeMachineConfig()
  normalizeMachineConfig()
  validateMachineConfigForDevtools()
  machineConfigToGraph()
  graphToMachineConfig()
  createRuntimeBridge()

packages/devtools-typegen
  compileMobxstateTypes()
  createTypegenDiagnostics()
  printTypegenModule()

packages/devtools-source
  findCreateMachineCalls()
  readMachineConfigAst()
  createSourceDocumentCache()
  applySemanticEditsToSource()
  createSourcePatchPlan()
  printMachineConfig()

packages/devtools-worker
  own SourceDocumentCache
  expose JSON-RPC/LSP-like requests
  debounce document analysis
  suppress stale UI updates

packages/devtools-ui
  MobXstateViewer
  MobXstateSimulator
  MobXstateVisualEditor
  Inspector panels

examples/visual-editor
  Vite playground for local development

extensions/vscode
  VS Code commands, webview host, diagnostics, source edits

extensions/webstorm
  JetBrains plugin shell, JCEF host, inspections, source edits

extensions/zed
  Zed extension shell, diagnostics/typegen first
```

Имена пакетов можно уточнить при реализации. Важно, что `devtools-core` не
зависит от React, VS Code, WebStorm или Zed, а `devtools-worker` является
единственным местом, где IDE host хранит parsed document state.

## Поток данных core

```text
MachineConfig
  -> NormalizedMachine
  -> GraphModel
  -> UI Draft
  -> SemanticEditCommand[]
  -> MachineConfig export OR SourcePatchPlan
  -> reparse changed source
```

Runtime flow:

```text
MobXStateMachine instance
  -> RuntimeBridge
  -> RuntimeModel
  -> Viewer highlight + simulator controls
  -> store.send(event)
  -> snapshot update
```

## Ключевые модели

### NormalizedMachine

Внутреннее представление, где все сокращенные формы приведены к полной форме:

- transition string превращен в `{ target }`;
- single transition превращен в array;
- `entry`, `exit`, `actions` превращены в arrays;
- nested state paths представлены как массивы сегментов;
- absolute targets `#machineId.path` разобраны на machine id и path;
- `after`, `always`, `onDone`, `onError` представлены как transition groups;
- `invoke` представлен как array.

### GraphModel

UI-friendly модель:

- `nodes`: state nodes с id, path, parent id, type, initial child, metadata;
- `edges`: transitions с source node, target nodes, trigger, actions, guard,
  delay, internal flag, description;
- `regions`: parallel/compound контейнеры;
- `diagnostics`: ошибки и предупреждения, привязанные к node/edge/path;
- `layout`: необязательные координаты, не являющиеся частью runtime config.

### RuntimeModel

Снимок исполнения:

- `state`: текущее `MachineStateValue`;
- `snapshot.value`;
- `snapshot.event`;
- active node ids;
- enabled event candidates;
- history of snapshots;
- status: not started, running, stopped, error.

### DraftModel

Редактируемая версия:

- содержит `GraphModel`;
- хранит dirty state;
- хранит undo/redo stack;
- хранит diagnostics для draft;
- может быть преобразована в `MachineConfig`.

### SourceDocumentCache

Worker/server хранит per-document cache:

- current text;
- source version;
- parsed AST;
- found `createMachine(...)` calls;
- extracted machine models by stable machine index;
- diagnostics;
- type compiler result;
- source ranges for states, transitions and store bindings;
- undo metadata for source edits;
- displayed machine pointer, если IDE/webview открыт.

После любого accepted source patch cache должен быть перестроен из нового
текста. Нельзя продолжать работать со старым AST после применения edit.

## RuntimeBridge

`RuntimeBridge` нужен, чтобы UI не знал деталей store class.

Обязательный контракт:

```ts
interface RuntimeBridge<Event> {
  getState(): MachineStateValue | undefined;
  getSnapshot(): MachineSnapshot<Event> | undefined;
  send(event: MachineSendEvent<Event>): void;
  start(state?: MachineStateValue): Promise<unknown>;
  stop(): void;
  restart(): Promise<unknown>;
  subscribe(listener: () => void): () => void;
}
```

Для standalone viewer bridge может оборачивать конкретный
`MobXStateMachine`. Для IDE viewer bridge может быть read-only, если runtime
instance недоступен.

## Границы работы с исходниками

Три режима работы с исходниками:

1. `config value mode` - UI получает готовый `MachineConfig` object.
2. `source read mode` - analyzer находит `createMachine({...})` в TypeScript и
   строит readonly model.
3. `source patch mode` - source module создает patch plan и показывает diff.

`source patch mode` должен быть отдельным feature flag, потому что AST-editing
может повредить пользовательский файл, если не ограничить поддерживаемые формы.

## Протокол семантических правок

Visual editor не отправляет в source layer новый config целиком. Он отправляет
семантические команды:

```text
add_state
remove_state
rename_state
reparent_state
set_state_type
set_state_id
set_initial_state
add_transition
remove_transition
reanchor_transition
change_transition_path
mark_transition_as_internal
add_action
remove_action
edit_action
add_guard
remove_guard
edit_guard
add_invoke
remove_invoke
edit_invoke
set_description
update_layout
```

Каждая команда должна ссылаться на MobXstate paths, transition paths и source
ranges, а не на DOM ids. Source patcher обязан уметь отказаться от команды,
если для нее нет безопасного AST-patch.

## Жизненный цикл source patch

```text
SemanticEditCommand[]
  -> create SourcePatchPlan
  -> preview diff
  -> apply accepted text edits
  -> update cached document text
  -> reparse document
  -> rebuild extracted machine model
  -> compare semantic model
  -> notify viewer/editor only when displayed machine changed
```

Если после patch текущий machine index исчез, worker должен отправить
диагностируемое состояние `displayed_machine_missing`, а не падать и не
пытаться угадать новую машину.

Если пользователь изменил файл извне, worker сравнивает anonymized/semantic
machine model. Изменения вне текущей machine не должны заставлять editor
перерисовываться или терять draft без причины.

## Поддерживаемые MobXstate features

Core обязан понимать:

- `initial`;
- nested states;
- parallel states;
- final states;
- shallow history;
- `on`;
- `always`;
- `after`;
- `entry`;
- `exit`;
- named actions and action objects;
- named guards and guard objects;
- named delays and numeric delays;
- `invoke`;
- `onDone`;
- `onError`;
- child machines;
- `description`;
- `internal`;
- `tsTypes`;
- `schema.events`.

Core должен явно диагностировать:

- `history: "deep"`;
- unknown transition target;
- missing `initial`;
- `initial` pointing to missing child;
- target outside machine;
- unsupported dynamic expression in source mode;
- missing store action/guard/delay/effect when store info is available.

## UI boundaries

UI не должен мутировать `MachineConfig` напрямую. Все изменения идут как команды
к draft:

```text
addState(parentPath, key)
renameState(path, newKey)
removeState(path)
setInitial(parentPath, childKey)
addTransition(sourcePath, triggerKind, trigger)
updateTransition(edgeId, patch)
removeTransition(edgeId)
setEntry(path, actions)
setExit(path, actions)
setInvoke(path, invokes)
```

Каждая команда должна:

- быть undoable;
- запускать validation;
- возвращать diagnostics;
- не требовать DOM/canvas.

## Layout

Layout не должен попадать в runtime `MachineConfig` по умолчанию.

Допустимые варианты:

- ephemeral layout в UI;
- sidecar file `*.mobxstate.layout.json`;
- source comment `@mobxstate-layout <encoded-layout>` рядом с machine config;
- IDE workspace storage;
- future metadata block только после отдельного решения.

Рекомендуемый порядок:

1. MVP использует ephemeral layout.
2. Первый persisted layout использует sidecar file.
3. Source comment допускается только после отдельного решения, потому что он
   увеличивает риск конфликтов с source patching.

Layout update является отдельной semantic command и не должен смешиваться с
config edits в undo/redo истории пользователя.

## Error handling

Analyzer errors делятся на:

- `error` - config нельзя корректно прочитать или исполнить;
- `warning` - config работает, но visual editor не сможет безопасно
  отредактировать часть структуры;
- `info` - рекомендация, например включить typegen или strict mode.

Каждый diagnostic должен иметь:

- code;
- severity;
- message;
- optional path;
- optional source range;
- optional quick fix id.

## Security

Devtools core не должен выполнять пользовательский TypeScript для анализа.

Разрешено:

- читать AST;
- импортировать explicit config в standalone examples;
- работать с runtime instance, который пользователь сам передал в viewer.

Запрещено:

- eval исходного файла в IDE;
- автоматически запускать arbitrary project code ради анализа;
- выполнять store methods во время static analysis.
