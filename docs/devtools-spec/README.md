# MobXstate Devtools: состав ТЗ

Этот каталог описывает последовательное ТЗ на собственный визуальный devtools
для MobXstate. Цель - построить инструмент в терминах MobXstate, без
копирования внешних studio/runtime продуктов.

MobXstate devtools должен помогать автору видеть, запускать и изменять
`MachineConfig`, где:

- `createMachine(config)` задает statechart-shaped config;
- `MobXStateMachine` исполняет config внутри MobX store;
- store поля, getters и методы являются контекстом, actions, guards, delays и
  effects;
- `state`, `snapshot`, `send(...)`, `matches(...)`, `startMachine(...)`,
  `stopMachine(...)` и `restart(...)` являются runtime-точками наблюдения;
- `MachineOptions` остается override/compatibility layer, а не основным
  способом проектирования машины.

## Документы

1. [01-roadmap.md](./01-roadmap.md) - последовательность этапов от viewer до
   IDE-плагинов.
2. [02-core-architecture.md](./02-core-architecture.md) - общая архитектура,
   пакеты, контракты данных и границы ответственности.
3. [03-viewer-simulator.md](./03-viewer-simulator.md) - ТЗ на первый этап:
   read-only viewer и simulator для `MobXStateMachine`.
4. [04-visual-editor.md](./04-visual-editor.md) - ТЗ на визуальное
   редактирование `MachineConfig`.
5. [05-type-compiler.md](./05-type-compiler.md) - ТЗ на MobXstate type
   compiler и проверку store bindings.
6. [06-ide-plugins.md](./06-ide-plugins.md) - ТЗ на VS Code, WebStorm и Zed
   интеграции.
7. [07-testing-and-acceptance.md](./07-testing-and-acceptance.md) - общая
   стратегия тестирования, acceptance criteria и release gates.
8. [08-source-derived-architecture-notes.md](./08-source-derived-architecture-notes.md)
   - архитектурные уроки из изученных IDE extension исходников,
   применимые к MobXstate devtools.
9. [09-implementation-plan.md](./09-implementation-plan.md) - порядок
   реализации devtools по проверяемым слоям и Definition of Done для каждого
   этапа.

## Принципы

- Термины интерфейса должны говорить о MobXstate: machine, state node,
  transition, store action, store guard, store delay, store effect, snapshot,
  persisted state.
- Нельзя обещать полную совместимость с внешними runtime. Поддерживается только текущий
  public surface MobXstate.
- Первый результат должен работать вне IDE. IDE-плагины подключаются к тому же
  core, а не содержат собственную бизнес-логику.
- Редактирование исходного TypeScript-кода является отдельным этапом после
  надежного in-memory editing и export.
- IDE host должен быть тонкой оболочкой. Analyzer, source cache, diagnostics,
  type compiler и source patching живут в worker/server-слое.
- Visual editor отправляет семантические edit commands, а не новый
  `MachineConfig` целиком. Source patcher сам решает, какие AST-ranges можно
  менять безопасно.
- Type compiler не пишет generated files, если их содержимое не изменилось.
- Type compiler должен улучшать MobXstate-типизацию и использовать
  MobXstate-specific typegen markers.

## Верхнеуровневая схема

```text
MachineConfig + optional MobXStateMachine instance
        |
        v
MobXstate analyzer
        |
        +--> GraphModel
        +--> RuntimeModel
        +--> Diagnostics
        +--> SourceDocumentCache
        |
        v
Viewer / Simulator
        |
        v
Editor Draft
        |
        +--> MachineConfig export
        +--> Type compiler inputs
        +--> Source patch plan
        |
        v
Devtools worker / language server
        |
        v
IDE shells: VS Code -> WebStorm -> Zed
```

## Не входит в первый релиз

- Клон Stately Studio.
- Облачное хранение машин.
- Совместная работа нескольких пользователей.
- Автоматическое исправление любого произвольного TypeScript-файла.
- Редактирование store-методов внутри визуального canvas.
- Поддержка runtime features, которые MobXstate не исполняет.
