# 04. Visual Editor

## Цель

Visual editor должен позволить проектировать `MachineConfig` в терминах
MobXstate и получать валидный config, который исполняется через
`MobXStateMachine`.

Первый editor не обязан менять исходный `.ts` файл. Он обязан надежно менять
draft model и экспортировать новый config.

## Главный принцип

Editor редактирует не store, а machine config.

Store остается местом, где живут:

- данные;
- MobX observable поля;
- computed getters;
- action methods;
- guard getters/methods/properties;
- delay getters/methods/properties;
- effect methods;
- lifecycle cleanup.

Editor может подсказать, что store member отсутствует, но не должен
автоматически писать бизнес-логику store.

## Режимы editor

### Режим draft

Пользователь меняет graph. Изменения живут в `DraftModel`.

Обязательные операции:

- add state;
- rename state;
- remove state;
- move state to another parent;
- set state type;
- set initial child;
- add transition;
- edit transition;
- remove transition;
- edit entry/exit;
- edit invoke;
- undo/redo;
- validate draft.

Draft mode хранит локальную undo/redo историю editor-команд. Эта история не
равна source undo: source patcher может иметь отдельные rollback metadata для
удаленных states/transitions и примененных text edits.

### Режим export

Editor печатает:

```ts
const machine = createMachine<Event>({
  id: "machineId",
  predictableActionArguments: true,
  schema: {
    events: {} as Event,
  },
  initial: "idle",
  states: {
    idle: {},
  },
});
```

Export не должен терять supported MobXstate fields.

### Режим source patch

Поздний режим. Editor применяет изменения к исходному файлу только если:

- найден ровно один `createMachine({...})`;
- config является object literal;
- unsupported expressions не затронуты;
- patch preview принят пользователем;
- TypeScript parser смог сохранить ranges.

Если patch unsafe, editor предлагает export вместо изменения файла.

Source patch mode принимает только semantic edit commands из draft. Он не
принимает полный перепечатанный config как замену исходного object literal,
пока пользователь явно не выбрал export/replace mode.

После accepted patch source layer обязан:

- применить text edits к актуальному document text;
- заново распарсить файл;
- заново найти текущую machine;
- сверить semantic model;
- обновить editor только если изменилась отображаемая machine.

Если файл изменился извне, editor показывает одно из состояний:

- `synced` - machine model совпадает;
- `updated` - machine изменилась и draft можно безопасно обновить;
- `conflict` - есть локальный draft и внешний source change;
- `missing` - ранее открытая machine больше не найдена.

## Inspector forms

### State inspector

Поля:

- key;
- path;
- type: atomic, compound, parallel, final, history;
- initial;
- history: shallow, boolean, none;
- entry actions;
- exit actions;
- invoke list;
- description в будущем, если появится state description support.

Правила:

- `initial` требуется для compound state с children, кроме parallel;
- `type: "final"` не должен иметь child states;
- `history: "deep"` запрещен;
- history state должен быть child of compound/parallel parent.

### Transition inspector

Поля:

- trigger kind: `on`, `after`, `always`, `onDone`, `onError`;
- trigger key;
- target;
- internal;
- cond;
- actions;
- description.

Правила:

- `always` не имеет event key;
- `after` может иметь named delay или numeric delay;
- transition без target допустим, если есть actions;
- target должен существовать;
- absolute target должен ссылаться на текущую machine id или поддержанный child
  machine scope;
- transition array сохраняет порядок.

### Invoke inspector

Поля:

- id;
- src;
- autoForward;
- onDone;
- onError.

Правила:

- `src` обязателен для named effect;
- child machine invoke read-only на первом этапе, если невозможно безопасно
  сериализовать;
- `onDone` и `onError` используют те же transition controls.

## Store binding panel

Panel показывает referenced names:

- actions;
- guards;
- delays;
- effects.

Для каждого binding:

- name;
- kind;
- referenced from paths;
- found in store;
- found in `MachineOptions`;
- missing;
- event types that can trigger it, если доступен type compiler.

Editor может создать placeholder snippet, но не вставляет его автоматически без
IDE-specific source patch.

Пример snippet:

```ts
public startMeal(event: CatEvent): void {
  throw new Error("Not implemented");
}
```

## Config export rules

Exporter должен сохранять канонический MobXstate style:

- `createMachine<Event>({...})`;
- `predictableActionArguments: true`, если был в исходном config;
- `schema.events`, если был доступен event type;
- `tsTypes`, если type compiler включен;
- short string target только когда transition не имеет дополнительных полей;
- object transition когда есть actions, cond, description или internal;
- arrays для multiple transitions;
- named store members как strings.

## Семантические команды редактирования

Editor commands должны преобразовываться в устойчивый набор source-level
команд:

```text
add_state(path, name)
remove_state(path)
rename_state(path, name)
reparent_state(path, newParentPath)
set_state_type(path, type, history?)
set_initial_state(path, initialState | null)
add_transition(sourcePath, transitionPath, targetPath?, guard?)
remove_transition(sourcePath, transitionPath)
reanchor_transition(sourcePath, transitionPath, newSourcePath?, newTargetPath?)
change_transition_path(sourcePath, transitionPath, newTransitionPath)
add_action(path, actionPath, name)
remove_action(path, actionPath)
edit_action(path, actionPath, name)
add_guard(path, transitionPath, name)
remove_guard(path, transitionPath)
edit_guard(path, transitionPath, name)
add_invoke(path, invokeIndex, source, id?)
remove_invoke(path, invokeIndex)
edit_invoke(path, invokeIndex, patch)
set_description(statePath, transitionPath?, description | null)
update_layout(layout)
```

Команды используют MobXstate paths и transition paths. DOM/canvas ids могут
использоваться только внутри UI и не должны попадать в source patch API.

## Validation levels

### Structural validation

Проверяет форму config:

- valid state keys;
- valid parent/child relations;
- valid transition groups;
- valid invoke shapes.

### Runtime validation

Повторяет ограничения MobXstate runtime:

- unknown initial;
- unknown target;
- unsupported deep history;
- invalid effect return expectations where statically known.

### Authoring validation

Подсказывает качество:

- state без incoming transition;
- transition без target и actions;
- action name referenced but not implemented;
- event exists in graph but not in event union;
- event union member not used anywhere.

## Поддерживаемое подмножество для source patch

Для первого source patch поддерживаются только:

- top-level `const name = createMachine<Type>({...})`;
- `export const name = createMachine<Type>({...})`;
- `export default createMachine<Type>({...})`;
- object literal config;
- string literal state keys;
- simple template literal descriptions without expressions;
- string literal target/action/guard/delay/effect names;
- TypeScript `satisfies` after config expression;
- no spread inside touched state subtree;
- no computed keys inside touched state subtree.

Unsupported source не является ошибкой editor. Это reason to export.

## Acceptance criteria

- Пользователь может создать машину с 3 states и 4 transitions без кода.
- Пользователь может открыть существующий config, переименовать state и получить
  обновленные transition targets.
- Удаление state предупреждает о transitions, которые будут удалены или
  станут invalid.
- Undo/redo работает для всех editor commands.
- Source patch после применения заново парсит файл и обновляет cached machine
  model.
- Внешнее изменение файла не сбрасывает draft, если semantic model текущей
  machine не изменился.
- Exported config проходит `createMachine(...)` и runtime validation.
- Missing store action показывается как diagnostic, а не runtime surprise.

## Out of scope

- Генерация полной store class.
- Редактирование MobX observable fields.
- Визуальное моделирование payload schemas.
- Collaborative editing.
- Публикация в облачный registry.
