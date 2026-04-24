# Examples

## Live Page

- Public demo: [MobXstate live page](/)
- Local dev: run `npm run dev` and open `/examples/live/` in the Vite server.

The live page shows:

- cat routine with actions, guards, and delays
- dog walk with invoke and delayed transitions
- checkout flow with explicit process states
- shelter checklist with parallel regions

## Standalone Example Files

These example files are included in repository typechecking.

- `examples/standalone/counter.ts` shows regular actions on a MobX store.
- `examples/standalone/async-loader.ts` shows promise invoke and `onDone`.
- `examples/standalone/live-stream.ts` shows lifecycle effects and cleanup.
- `examples/standalone/parallel-checkout.ts` shows parallel regions and parent
  `onDone`.
- `examples/standalone/traffic-light.ts` shows entry actions and named delays.
- `examples/standalone/typegen-narrowing.ts` shows typegen-aware callback
  narrowing.
- `examples/standalone/wizard-flow.ts` shows nested states, shallow history,
  guards, and invoke error handling.

## Repository Navigation

- Repo-level examples guide lives in
  [examples/README.md](https://github.com/order-of-chaos/mobXstate/blob/master/examples/README.md).
- Release and packaging docs live in
  [RELEASING.md](https://github.com/order-of-chaos/mobXstate/blob/master/RELEASING.md).
