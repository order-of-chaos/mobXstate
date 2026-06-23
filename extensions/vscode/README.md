# MobXstate Devtools VS Code Shell

Этот каталог фиксирует packaging boundary для VS Code extension.

Общая командная логика уже находится в
`src/devtools/vscodeExtensionShell.ts`, а native bridge находится в
`src/devtools/vscodeNativeAdapter.ts`. Локальный `src/extension.ts` только
передает настоящий VS Code API в этот bridge.

- `window.activeTextEditor.document` -> `getActiveDocument`;
- `commands.registerCommand` -> `registerCommand`;
- `languages.createDiagnosticCollection` -> `setDiagnostics`;
- `window.createWebviewPanel` -> `showPanel`;
- `workspace.fs.writeFile` -> `writeFile`;
- `WorkspaceEdit` + `workspace.applyEdit` -> `applyTextEdits`.

Analyzer, source reader, type compiler и worker protocol не должны
дублироваться внутри extension adapter.

Текущий срез содержит manifest команд, `src/extension.ts`, webview host и
adapter-level smoke tests через fake VS Code API. Следующий срез должен собрать
extension bundle и заменить placeholder webview HTML на общий devtools UI.
