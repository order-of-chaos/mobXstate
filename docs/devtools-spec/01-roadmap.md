# 01. Roadmap

## Цель

Построить MobXstate devtools поэтапно:

1. viewer/simulator;
2. visual editor;
3. MobXstate type compiler;
4. VS Code plugin;
5. WebStorm plugin;
6. Zed integration.

Каждый этап должен выпускаться как самостоятельный полезный результат и не
блокировать следующий этап скрытыми архитектурными долгами.

## Этап 1: Viewer/Simulator

Цель: автор `MobXStateMachine` видит структуру `MachineConfig`, текущее
состояние runtime и может отправлять события без ручного UI.

Минимальный результат:

- прочитать `machine.config`;
- построить `GraphModel`;
- отрисовать state nodes и transitions;
- подсветить активный `state` из `MobXStateMachine`;
- показать последний `snapshot.event`;
- сгенерировать список возможных events из `on`, `after`, `always`, `onDone`,
  `onError` и внутренней runtime-семантики;
- отправлять события через `store.send(event)`;
- показывать результат `matches(...)` и историю snapshot.

Done when:

- live example может подключить `MobXstateViewer`;
- nested, parallel, final, after, always и invoke-сценарии отображаются без
  падений;
- viewer не меняет machine config;
- ошибка в config превращается в понятный diagnostic.

## Этап 2: Visual Editor

Цель: автор редактирует `MachineConfig` через граф и получает валидный
MobXstate config.

Минимальный результат:

- добавлять, переименовывать и удалять state nodes;
- менять `initial`, `type`, `history`;
- добавлять transitions для `on`, `after`, `always`, `onDone`, `onError`;
- менять `target`, `actions`, `cond`, `description`, `internal`;
- редактировать `entry`, `exit`, `invoke`;
- валидировать target paths и store binding names;
- экспортировать обновленный `createMachine({...})` block.

Done when:

- visual draft round-trips через `MachineConfig`;
- export проходит runtime validation;
- редактирование не требует IDE;
- source patching остается выключенным feature flag.

## Этап 3: MobXstate Type Compiler

Цель: сгенерировать типы, которые помогают MobXstate-проекту ловить ошибки в
events, state matches и store bindings.

Минимальный результат:

- вывести `matchesStates` из `MachineConfig`;
- вывести internal events для `after`, `done.state`, `done.invoke`,
  `error.platform`-like MobXstate events;
- собрать `eventsCausingActions`, `eventsCausingGuards`,
  `eventsCausingDelays`, `eventsCausingEffects`;
- проверить, что action/guard/delay/effect names существуют на store или в
  `MachineOptions`;
- сгенерировать `*.mobxstate.typegen.ts`;
- предложить `tsTypes: {} as import("./name.mobxstate.typegen").Typegen0`.

Done when:

- type tests ловят неверный `send("EVENT")` для payload events;
- `matches(...)` получает union доступных state values;
- missing store members видны как diagnostics до runtime;
- compiler работает из CLI и из IDE worker.

## Этап 4: VS Code plugin

Цель: встроить viewer/editor в VS Code через webview и общий MobXstate core.

Минимальный результат:

- command: `MobXstate: Open Viewer`;
- command: `MobXstate: Open Visual Editor`;
- code lens над `createMachine(...)`;
- diagnostics для текущего файла;
- export updated config в clipboard;
- optional source patch для простых object literal машин.

Done when:

- plugin не содержит собственного analyzer/editor logic;
- webview получает данные через typed messages;
- source patch имеет preview diff;
- отказ patch не ломает файл.

## Этап 5: WebStorm plugin

Цель: повторить core-функции в JetBrains IDE без переписывания devtools.

Минимальный результат:

- Tool Window с embedded browser;
- action на `createMachine(...)`;
- Node worker или CLI bridge для analyzer/type compiler;
- diagnostics через IntelliJ inspection;
- preview diff перед изменением исходника.

Done when:

- viewer/editor использует тот же web bundle, что VS Code;
- IDE-specific код отвечает только за file IO, actions и diagnostics;
- plugin работает в WebStorm без зависимости от VS Code APIs.

## Этап 6: Zed integration

Цель: дать пользователям Zed максимально возможный MobXstate workflow с учетом
реальных ограничений Zed extension API.

План:

- сначала LSP/diagnostics/type compiler;
- затем команды export/typegen;
- visual UI подключать только когда Zed дает стабильный visual panel/webview
  API или через внешний локальный preview server.

Done when:

- Zed-пользователь получает diagnostics и typegen;
- visual preview не блокирует базовую ценность;
- архитектура не зависит от нестабильного UI API.

## Последовательность зависимостей

```text
Analyzer + GraphModel
        |
        v
Viewer/Simulator
        |
        v
Editor Draft + Config Export
        |
        v
Type Compiler + Diagnostics
        |
        v
VS Code Plugin
        |
        v
WebStorm Plugin
        |
        v
Zed Integration
```

## Главные риски

- Source patching сложнее, чем canvas editing. Его нельзя делать частью MVP.
- Type compiler должен учитывать MobX-first model, иначе он начнет тянуть
  external runtime assumptions.
- IDE-плагины имеют разную модель UI. Общий core и общий web bundle должны
  появиться до IDE-этапов.
- Visual editor без хороших diagnostics будет создавать нерабочие config.
