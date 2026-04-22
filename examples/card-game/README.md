# Card Game Migration Example

This folder keeps the original application-scale card-game machine as a
migration example. It is intentionally not part of the package build because it
depends on app-specific stores, services and path aliases.

The important part is the MobXstate integration shape:

- `cardGameMachine.ts` keeps a plain XState-shaped `createMachine(...)` config.
- `cardGameMachineFunctions.ts` provides implementations that use `this`
  instead of `context`.
- `cardGameMachineObserver.ts` passes implementations to
  `super(cardGameMachine, cardGameMachineFunctions)`.

