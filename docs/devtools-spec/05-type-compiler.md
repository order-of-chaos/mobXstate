# 05. MobXstate Type Compiler

## Цель

MobXstate type compiler должен превращать `MachineConfig` и доступную
информацию о store в типы и diagnostics, которые повышают безопасность
MobXstate-проектов.

Это не XState typegen как продуктовая концепция. Это MobXstate type compiler.
Технически он может заполнять текущий `TypegenMeta`, потому что public types
уже имеют compatibility-поле `@@xstate/typegen`.

## Входные данные

Минимальные входные данные:

- `MachineConfig`;
- machine id;
- optional source range;
- optional event type reference from `createMachine<Event>`;
- optional store class symbol;
- optional `MachineOptions` object;
- optional current TypeScript program.

## Выходные данные

Compiler производит:

- typegen module text;
- diagnostics;
- optional code actions;
- summary for UI.

Пример файла:

```text
catRoutine.mobxstate.typegen.ts
```

Пример подключения:

```ts
const catMachine = createMachine<CatEvent>({
  tsTypes: {} as import("./catRoutine.mobxstate.typegen").Typegen0,
  id: "catRoutine",
  initial: "sleeping",
  states: {
    sleeping: {},
  },
});
```

## Typegen contents

Typegen должен уметь вывести:

- `matchesStates`;
- internal events;
- events causing actions;
- events causing guards;
- events causing delays;
- events causing effects;
- missing implementations;
- invoke src name map;
- tags, если tags появятся в MobXstate public API.

Текущий compatibility shape:

```ts
export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: object;
  invokeSrcNameMap: object;
  missingImplementations: object;
  eventsCausingActions: object;
  eventsCausingDelays: object;
  eventsCausingGuards: object;
  eventsCausingServices: object;
  matchesStates: MachineStateValue;
}
```

Для MobXstate UI слово `services` не используется. Внутри compatibility type
`eventsCausingServices` может оставаться alias для effects до изменения public
type contract.

## Event model

Compiler различает:

- public user events from `schema.events` or `createMachine<Event>`;
- config event keys from `on`;
- delayed internal events from `after`;
- done state events;
- done invoke events;
- error invoke events;
- init/stop internal events, если они нужны diagnostics.

Diagnostics:

- event key есть в config, но отсутствует в event union;
- event union содержит событие, которого нет в config;
- string `send("EVENT")` невозможен, потому что event требует payload;
- payload shape unknown, simulator должен просить JSON object.

## State model

Compiler выводит `matchesStates` из leaf paths и nested/parallel structure.

Пример:

```ts
type MatchesStates =
  | "sleeping"
  | "hungry"
  | "eating"
  | "playful"
  | "playing"
  | "grooming"
  | "vetVisit";
```

Для nested/parallel state:

```ts
type MatchesStates =
  | "checkout"
  | "checkout.cart"
  | "checkout.payment"
  | { checkout: "cart" | "payment" }
  | { left: "idle"; right: "ready" };
```

Фактическая форма должна соответствовать существующему
`MachineStateValue`/`TypegenMeta` contract.

## Store binding analysis

Compiler проверяет references:

- `entry`;
- `exit`;
- transition `actions`;
- transition `cond`;
- `after` named delays;
- `invoke.src`;
- `onDone`/`onError` actions and guards.

Проверка идет по приоритету:

1. member exists on store class;
2. member exists in `MachineOptions`;
3. member missing.

Binding kinds:

- action: method returning `void`;
- guard: getter/property/method returning `boolean`;
- delay: number getter/property or function returning `number`;
- effect: method returning `void`, cleanup function, promise-like object or
  child machine.

Type compiler не должен выполнять store methods.

## Missing implementation diagnostics

Diagnostic examples:

- `MBS001 Missing action "startMeal" referenced from state "hungry".`
- `MBS002 Missing guard "hasFood" referenced from transition "hungry.FEED".`
- `MBS003 Missing delay "MEAL_DELAY" referenced from state "eating".`
- `MBS004 Missing effect "loadUser" referenced from invoke "profile.loading".`

Каждый diagnostic должен иметь:

- code;
- severity;
- source range when available;
- graph path;
- suggested snippet.

## Generated snippets

Compiler может предлагать snippets:

```ts
public startMeal(event: CatEvent): void {
  throw new Error("Not implemented");
}
```

```ts
public get hasFood(): boolean {
  return false;
}
```

```ts
public get MEAL_DELAY(): number {
  return 1000;
}
```

```ts
public loadUser(): Promise<void> {
  return Promise.resolve();
}
```

Snippet generation не применяет изменения без IDE action.

## CLI

Нужен CLI:

```sh
mobxstate-devtools typegen src/**/*.ts
mobxstate-devtools check src/**/*.ts
```

CLI должен:

- найти `createMachine(...)`;
- сгенерировать или проверить `*.mobxstate.typegen.ts`;
- вывести diagnostics;
- иметь non-zero exit code на errors;
- поддержать `--write`, `--check`, `--json`.

## Политика записи файлов

Type compiler не должен писать файл, если generated text совпадает с текущим
содержимым. Это обязательное правило, чтобы не создавать лишние file watcher
events и не дергать TypeScript language service.

Пайплайн записи:

```text
compile type data
  -> print stable module text
  -> compare with existing file
  -> skip write when equal
  -> write atomically when changed
  -> notify IDE host only after successful write
```

Generated output должен иметь стабильную сортировку:

- machines by source order;
- state paths lexicographically within machine;
- event/action/guard/delay/effect names lexicographically;
- diagnostics by source range, then code.

## Совместимость с синтаксисом исходников

Compiler и source reader должны поддерживать современные TypeScript формы,
которые часто встречаются рядом с `createMachine(...)`:

- `satisfies`;
- `as const`;
- `const` type parameters in surrounding source;
- `.ts`, `.tsx`, `.mts`, `.cts`;
- type-only imports and exports;
- simple template literals for descriptions;
- multiple `createMachine(...)` calls in one file;
- `export default createMachine(...)`;
- decorators in store classes.

Если parser не поддерживает синтаксис файла, compiler должен вернуть syntax
diagnostic и не трогать generated files.

## IDE integration

IDE-плагины используют тот же compiler:

- diagnostics в editor;
- code action: generate typegen file;
- code action: insert `tsTypes`;
- code action: create missing store member snippet;
- command: refresh MobXstate typegen.

## Acceptance criteria

- Compiler работает без IDE.
- Compiler не выполняет пользовательский код.
- Generated file стабилен между запусками.
- Typegen меняется только при изменении machine config.
- Typegen file не перезаписывается при no-op изменениях.
- Missing action/guard/delay/effect diagnostics совпадают с runtime strict
  validation intent.
- Existing tests for typed `send` не ломаются.

## Open decisions

- Оставлять ли filename suffix `.mobxstate.typegen.ts` или использовать
  `.typegen.ts`.
- Должен ли compiler автоматически обновлять `tsTypes` или только предлагать
  patch.
- Нужно ли менять public `TypegenMeta`, чтобы заменить `eventsCausingServices`
  на `eventsCausingEffects`, сохранив backward compatibility.
