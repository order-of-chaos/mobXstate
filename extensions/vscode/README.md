# MobXstate Devtools VS Code Shell

Этот каталог фиксирует packaging boundary для VS Code extension.

Общая командная логика уже находится в
`src/devtools/vscodeExtensionShell.ts`. Реальный VS Code adapter должен только
перевести native API в `VscodeDevtoolsHost`:

- `window.activeTextEditor.document` -> `getActiveDocument`;
- `commands.registerCommand` -> `registerCommand`;
- `languages.createDiagnosticCollection` -> `setDiagnostics`;
- `window.createWebviewPanel` -> `showPanel`;
- `workspace.fs.writeFile` -> `writeFile`;
- `WorkspaceEdit` + `workspace.applyEdit` -> `applyTextEdits`.

Analyzer, source reader, type compiler и worker protocol не должны
дублироваться внутри extension adapter.

Текущий scaffold содержит manifest команд. Следующий срез должен добавить
`src/extension.ts`, webview host и smoke tests adapter-level wiring.
