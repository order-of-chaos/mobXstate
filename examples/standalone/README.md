# Standalone Examples

These examples compile in this repository and are included in `npm run
typecheck`.

- `counter.ts` shows regular actions bound to a MobX store.
- `async-loader.ts` shows a promise invoke and an `onDone` action.
- `live-stream.ts` shows `invoke: "stream"` resolving to a store lifecycle
  effect, events sent from the effect and cleanup on exit.
- `parallel-checkout.ts` shows parallel child states and parent `onDone`.
- `traffic-light.ts` shows entry actions and named delays resolved from store
  methods and getters.
- `typegen-narrowing.ts` shows typegen-aware `MachineOptions` callbacks.
- `wizard-flow.ts` shows nested states, shallow history, guards and invoke
  error handling.
