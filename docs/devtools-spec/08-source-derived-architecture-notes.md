# 08. Архитектурные заметки из изученных исходников

## Контекст

Этот документ фиксирует архитектурные выводы после изучения локального bundle
`tmp/statelyai.stately-vscode-2.1.0-universal` и decompiled editor artifacts в
`tmp/decompile-tools`.

Цель не в копировании Stately Studio. Полезна форма уже решенных ими проблем:
IDE/webview protocol, source patching, layout persistence, typegen writes,
stale cache handling и diagnostics.

## Уроки, которые нужно применить

### IDE host должен быть тонким

IDE extension открывает панели, пересылает сообщения, показывает native
diagnostics и применяет принятые text edits. Analyzer, type compiler, source
cache, source patching и tracking открытой machine должны жить в worker или
language-server-like процессе.

Следствие для MobXstate:

- создать `devtools-worker` до серьезной IDE-интеграции;
- заставить VS Code, WebStorm и Zed использовать один worker protocol;
- держать IDE-specific code в границах file IO, UI shell и native commands.

### Editor отправляет semantic edits, а не полный config

Visual editor не должен присылать полную замену config при обычных изменениях
графа. Он должен присылать semantic operations: `rename_state`,
`reanchor_transition`, `set_initial_state`, `add_action`, `update_layout`.

Следствие для MobXstate:

- сделать `SemanticEditCommand` first-class contract;
- держать DOM/canvas ids только внутри UI;
- source patcher решает, безопасна ли конкретная команда для AST editing.

### Draft undo и source undo разделены

Canvas/editor undo и rollback примененных source patches являются разными
механизмами.

Следствие для MobXstate:

- `DraftModel` владеет UI undo/redo;
- `SourceDocumentCache` владеет patch rollback metadata;
- layout-only updates не должны загрязнять semantic undo history.

### После каждого accepted patch нужен повторный parse

После применения text edits source cache перестраивается из нового текста
документа. Продолжать работать со старыми AST nodes небезопасно.

Следствие для MobXstate:

- lifecycle patching: `patch -> apply -> reparse -> validate -> notify`;
- если прежний machine index больше не существует, отправлять
  `displayed_machine_missing`;
- если machine существует, но изменилась извне, отправлять conflict/update
  state.

### Layout должен быть отдельным артефактом

Координаты графа полезны, но это не runtime machine config. Stately хранит
layout как encoded source comment; для MobXstate это должно остаться отдельным
product decision.

Следствие для MobXstate:

- MVP использует ephemeral layout;
- первая persistence-форма должна быть sidecar file;
- source comments вида `@mobxstate-layout` остаются optional future work;
- layout updates идут отдельными командами.

### Typegen не должен писать no-op изменения

Generated type files могут триггерить file watchers и TypeScript language
service. Запись неизменившегося файла создает лишний churn.

Следствие для MobXstate:

- generated typegen output должен быть стабильным;
- перед записью нужно сравнивать файл с новым содержимым;
- typegen update notifications отправляются только после реальных изменений.

### Современный TypeScript нужно поддержать рано

Source patching и analysis легко ломаются на современном синтаксисе.

Следствие для MobXstate:

- fixtures должны покрыть `satisfies`, `as const`, `.mts`, `.cts`, `.tsx`,
  type-only imports, decorators и `export default createMachine(...)`;
- unsupported syntax должен давать diagnostics и отключать source patching, но
  не ломать export.

### Нерелевантные source changes не должны сбрасывать UI

Когда открытый editor привязан к файлу, изменения в других частях этого файла
не должны мигать графом, сбрасывать draft или пересоздавать visual editor.

Следствие для MobXstate:

- сравнивать semantic machine models перед уведомлением UI;
- отслеживать открытую machine по uri, machine index и source range;
- если machine сдвинулась, но семантически не изменилась, сохранять UI state.

### Diagnostics и code actions являются частью продукта

Source tooling дает пользу до drag/drop editing: target completion, initial
state completion, store binding completion, references и quick fixes для
missing implementations.

Следствие для MobXstate:

- делать diagnostics/completions/code actions параллельно viewer/simulator;
- приоритизировать проверки store action/guard/delay/effect bindings;
- использовать один analysis result в CLI и IDE-плагинах.

## Что уже отражено в ТЗ

- `devtools-worker` добавлен как явный слой.
- `SourceDocumentCache` добавлен как core model.
- Semantic edit commands стали контрактом для source patch.
- Source patch lifecycle требует reparse после accepted edits.
- Layout persistence отделен от runtime config.
- Typegen write policy запрещает no-op writes.
- Тестирование включает modern TypeScript syntax и stale-source scenarios.
