# MobXstate

MobXstate добавляет MobX-сторам конечные автоматы со statechart-shaped API.
Конфигурация машины остается Stately-friendly, поэтому Stately/XState VSCode
extension видит `createMachine(...)`, умеет открыть visual editor и генерировать
typegen. Исполняется это собственным runtime MobXstate, без XState interpreter.
Runtime не использует отдельный machine context: данные и бизнес-логика живут в
MobX-объекте.

## Базовый пример

```ts
import {
  MobXStateMachine,
  createMachine,
} from "mobxstate";

type CounterEvent =
  | { type: "INC"; by: number }
  | { type: "LOADED"; value: number };

const counterMachine = createMachine<CounterEvent>({
  id: "counter",
  predictableActionArguments: true,
  schema: {
    events: {} as CounterEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class CounterStore extends MobXStateMachine<CounterStore, CounterEvent> {
  count = 0;

  constructor() {
    super(counterMachine);
  }

  increment(event: CounterEvent) {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }
}
```

Машина описывает flow, а поведение живет в MobX-сторе. Имена `actions`,
`guards`, `delays` и `invoke` сначала ищутся как методы, getters или observable
properties самого store. `MachineOptions.effects` остается fallback-слоем для
сложных случаев.

## Поддержка возможностей

| Статус | Возможности |
| --- | --- |
| Поддерживается | `entry`, `exit`, named actions, named guards, named delays, numeric delays, `after`, `always`, `invoke`, promise effects, cleanup effects, child machines, nested states, parallel states, final states, shallow history, `onDone`, `onError`, typed `send`, persistence validation и persistence versioning. |
| Удалено | `MachineOptions.services`, `MachineOptions.activities`, state node `activities` и callback invoke services. Для lifecycle-кода используйте методы store или `MachineOptions.effects`. |
| Явная ошибка | Deep history через `history: "deep"` выбрасывает ошибку при создании runtime config. |
| Вне scope | Отдельный XState-style machine `context`. В MobXstate контекстом являются поля, getters и методы MobX store. |

## Использование

- `state` содержит текущее значение состояния и является MobX observable.
- `snapshot` содержит последний MobXstate snapshot: `value`, `event` и
  `matches(...)`.
- `send(event)` отправляет событие в машину. Object events всегда разрешены,
  string sends типизированы и разрешены только для событий без обязательного
  payload.
- `matches(state)` проверяет текущее состояние.
- `matchState` возвращает `ts-pattern` matcher для декларативного рендера.
- `actions` выполняются как методы store внутри `runInAction`.
- `guards` читаются как boolean getters/properties или pure methods через MobX
  `computed`.
- `delays` читаются как number getters/properties или methods в момент входа в
  состояние.
- Полный macrostep батчится в одной MobX transaction: observers видят итоговые
  store mutations и snapshot вместе, без промежуточных состояний между `exit`,
  transition action и `entry`.
- `invoke: "methodName"` запускает lifecycle effect из store. Метод может
  вернуть cleanup function, promise или child machine.
- Синхронные ошибки effects и promise rejections проходят через `onError` как
  события `error.platform.<invokeId>`.
- Ошибки actions и guards считаются fatal runtime errors: actor останавливается,
  активные resources очищаются, исходная ошибка пробрасывается наружу.
- Ошибки cleanup собираются в `MachineCleanupError`; runtime пытается выполнить
  все cleanup functions перед тем, как выбросить ошибку.
- `ready` можно `await`-ить, если старт машины отложен до следующего microtask
  или animation frame.
- `stopMachine`, `startMachine` и `restart` управляют runtime.
- `MachineStateConfig` настраивает `persistentKey`, `version`,
  `transformPersistedState`, `stopped`, `deferStart` и `strict`. В strict mode
  отсутствующие named actions, guards, delays и effects выбрасывают понятную
  ошибку до старта машины. `devTools` принимается для совместимости конфигов.
- `MachineOptions<Store, Event, Typegen>` поддерживает typegen-aware callbacks:
  action получает только те события, которые реально могут ее вызвать.

## Persistent State

Если передать `persistentKey`, MobXstate сохранит текущее state value в
`localStorage` под namespace `MachinesStorage`.
Перед восстановлением значение валидируется against текущей machine config.
Некорректные, переименованные или неполные state values игнорируются, после чего
машина стартует из initial state и перезаписывает storage актуальным значением.
Если задан `version`, MobXstate сохраняет versioned record.
`transformPersistedState(state, fromVersion)` может нормализовать сохраненное
значение до validation. Без `version` сохраняется raw state-value формат.

```ts
class CounterStore extends MobXStateMachine<CounterStore, CounterEvent> {
  constructor() {
    super(counterMachine, counterOptions, {
      persistentKey: "counter",
    });
  }
}
```

В средах без `localStorage` используется in-memory fallback, поэтому тесты и SSR
не падают на импорте.

## Важное ограничение

`createMachine` специально сохраняет форму XState config. Реализации лучше
размещать прямо в MobX store. `MachineOptions.effects` нужен в основном как
override layer.

Lifecycle-код описывайте через `invoke` и метод store, который возвращает cleanup
function, promise, child machine или `void`. Если effect должен отправить событие
назад в машину, вызывайте `this.send(...)` внутри метода store.

```ts
const machine = createMachine({
  id: "game",
  initial: "idle",
  states: {
    idle: {
      entry: "load",
    },
  },
});

class GameStore extends MobXStateMachine<GameStore, GameEvent> {
  constructor() {
    super(machine);
  }

  load() {
    this.loadData();
  }
}
```
