# Examples

This repository ships both a live demo page and standalone TypeScript example
files.

## Live Demo

- Source: `examples/live`
- Run locally with `npm run dev`
- Public Pages URL: `https://order-of-chaos.github.io/mobXstate/`

## Standalone Files

- `standalone/counter.ts` shows regular actions on a MobX store.
- `standalone/async-loader.ts` shows promise invoke and `onDone`.
- `standalone/live-stream.ts` shows lifecycle effects and cleanup.
- `standalone/parallel-checkout.ts` shows parallel states and parent `onDone`.
- `standalone/traffic-light.ts` shows entry actions and named delays.
- `standalone/typegen-narrowing.ts` shows typegen-aware callback narrowing.
- `standalone/wizard-flow.ts` shows nested states, shallow history, guards, and
  invoke error handling.

## Validation

- `npm run typecheck` includes the example code.
- `npm run pages:build` builds the live demo and static docs pages.
