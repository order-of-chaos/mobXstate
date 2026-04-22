# MobXstate

MobXstate добавляет MobX-сторам конечные автоматы с API, близким к XState.
Конфигурация машины остается XState-shaped, поэтому Stately/XState VSCode
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
сложных случаев, а `services` и `activities` сохранены только для миграции.

`BaseMachineState` остается legacy alias для обратной совместимости. Основное
имя публичного API для нового кода - `MobXStateMachine`.

## Использование

- `state` содержит текущее значение состояния и является MobX observable.
- `snapshot` содержит последний MobXstate snapshot: `value`, `event` и
  `matches(...)`.
- `send(event)` отправляет событие в машину.
- `matches(state)` проверяет текущее состояние.
- `matchState` возвращает `ts-pattern` matcher для декларативного рендера.
- `actions` выполняются как методы store внутри `runInAction`.
- `guards` читаются как boolean getters/properties или pure methods через MobX
  `computed`.
- `delays` читаются как number getters/properties или methods в момент входа в
  состояние.
- `invoke: "methodName"` запускает lifecycle effect из store. Метод может
  вернуть cleanup function, promise или child machine.
- `ready` можно `await`-ить, если старт машины отложен до следующего microtask
  или animation frame.
- `stopMachine`, `startMachine` и `restart` управляют runtime.
- `MachineStateConfig` настраивает `persistentKey`, `stopped`, `deferStart` и
  `strict`. В strict mode отсутствующие named actions, guards, delays и effects
  выбрасывают понятную ошибку до старта машины. `devTools` принимается для
  совместимости конфигов.
- `MachineOptions<Store, Event, Typegen>` поддерживает typegen-aware callbacks:
  action получает только те события, которые реально могут ее вызвать.

## Persistent State

Если передать `persistentKey`, MobXstate сохранит текущее state value в
`localStorage` под namespace `MachinesStorage`.

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
override или migration layer.

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

## Миграция callbacks

Было:

```ts
actions: {
  selectTable(context, event) {
    context.store.selectTable(event.payload.id);
  },
}
```

Стало:

```ts
class GameStore extends MobXStateMachine<GameStore, GameEvent> {
  selectTable(event: GameEvent) {
    if (event.type === "SELECT_TABLE") {
      this.selectTableById(event.payload.id);
    }
  }
}
```

Если callback использует `this`, он должен быть обычной function shorthand или
`function (...) {}`. Arrow functions сохраняют внешний `this` и не получат
экземпляр MobX-стора.
