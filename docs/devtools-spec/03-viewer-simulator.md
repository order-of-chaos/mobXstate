# 03. Viewer/Simulator

## Цель

Первый этап - read-only MobXstate viewer и simulator. Он должен отвечать на два
вопроса:

- что описывает этот `MachineConfig`;
- что сейчас делает конкретный `MobXStateMachine` runtime.

Редактирование config в этот этап не входит.

## Пользовательские сценарии

### Сценарий 1: посмотреть машину

Автор открывает machine config и видит:

- root machine id;
- state nodes;
- nested/parallel regions;
- initial transitions;
- normal transitions;
- delayed transitions из `after`;
- transient transitions из `always`;
- completion transitions из `onDone`;
- error transitions из `onError`;
- invoke nodes/effects;
- entry/exit actions;
- guards;
- descriptions.

### Сценарий 2: подключить runtime

Автор передает store:

```ts
<MobXstateViewer machine={catMachine} runtime={catStore} />
```

Viewer подсвечивает active states на основании `runtime.state` и
`runtime.snapshot`.

### Сценарий 3: симулировать события

Simulator показывает список event candidates и позволяет вызвать:

```ts
runtime.send(event)
```

Для payload events simulator должен требовать JSON payload. Для payloadless
events он может отправлять строковую форму, если тип события ее разрешает, или
object form `{ type }`.

### Сценарий 4: отладить invoke/after

Simulator показывает:

- active invokes;
- delayed transitions;
- last `snapshot.event`;
- последние N snapshots;
- errors, если actor остановился из-за exception.

## Public API компонента

Начальный API:

```ts
interface MobXstateViewerProps<Event extends EventObject> {
  machine: Machine<Event>;
  runtime?: IMachineState<object, Event>;
  options?: {
    readonly?: boolean;
    showInspector?: boolean;
    showSimulator?: boolean;
    showDiagnostics?: boolean;
    maxSnapshotHistory?: number;
  };
}
```

`runtime` optional, чтобы viewer мог работать в документации и IDE без живого
store instance.

## Viewer panels

### Canvas

Показывает:

- state nodes;
- child regions;
- transitions;
- active state highlight;
- final state marker;
- history state marker;
- transition labels.

### Inspector

Для выбранного state node:

- path;
- type;
- initial;
- entry;
- exit;
- invoke;
- tags в будущем, если появятся в public API;
- diagnostics.

Для выбранного transition:

- source;
- trigger kind: `on`, `after`, `always`, `onDone`, `onError`;
- event/delay name;
- target;
- actions;
- cond;
- internal;
- description;
- diagnostics.

### Simulator

Показывает:

- current state;
- last event;
- event candidates;
- payload editor;
- `send`;
- `startMachine`;
- `stopMachine`;
- `restart`;
- snapshot history.

## Event candidates

Core собирает candidates из:

- keys of `on`;
- `after` names, но помечает их как delayed/internal;
- `always`, но не предлагает их как user-send event;
- done events from final child states;
- done/error events from invokes;
- event union из `schema.events`, если доступен source/typegen.

Event candidate имеет вид:

```ts
interface EventCandidate {
  type: string;
  source: "config" | "schema" | "runtime";
  sendable: boolean;
  needsPayload: boolean | "unknown";
  description?: string;
}
```

## Active state resolution

Viewer должен преобразовать `MachineStateValue` в active node ids.

Примеры:

```ts
"idle" -> ["idle"]
{ checkout: "payment" } -> ["checkout", "checkout.payment"]
{ left: "a", right: "b" } -> ["left", "left.a", "right", "right.b"]
```

Для compound parent viewer подсвечивает и parent, и leaf.

## Diagnostics MVP

Viewer показывает diagnostics из analyzer:

- duplicate state key внутри parent;
- missing `initial`;
- unknown `initial`;
- unknown transition target;
- unsupported deep history;
- transition to removed state;
- invalid transition shape;
- invoke without `src`;
- action/guard/delay/effect name cannot be checked because store info is not
  available.

## Rendering requirements

- Canvas должен быть читаемым для 10-50 states.
- Nested states должны быть явно вложены, а не превращены в плоский список.
- Parallel regions должны быть визуально отделены.
- Transition labels не должны перекрывать state titles.
- Viewer должен работать без canvas WebGL. SVG или HTML/SVG hybrid достаточно.

## Технический MVP

Рекомендуемый стек для standalone example:

- Vite;
- React;
- MobX autorun/reaction для runtime bridge;
- SVG for graph;
- простой deterministic layout перед автолэйаутом.

Layout MVP:

- depth по вложенности;
- rows по siblings;
- transitions прямыми или polyline edges;
- manual pan/zoom можно отложить.

## Acceptance criteria

- `examples/live` может показать viewer для одной существующей машины.
- Viewer показывает active state при каждом `send(...)`.
- Simulator может отправить payloadless events.
- Payload editor отправляет object events.
- Parallel state snapshot отображается корректно.
- `after` transitions отображаются отдельно от user events.
- `always` transitions не показываются как sendable events.
- Diagnostics видны без открытия dev console.

## Out of scope

- Drag/drop editing.
- Source patch.
- Type generation.
- IDE integration.
- Remote debugging.
- Time travel с replay store mutations.
