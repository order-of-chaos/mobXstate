# Migration Guide

MobXstate callbacks no longer receive a custom XState `context`. Store state and
side effects live on the MobX store instance.

Before:

```ts
actions: {
  sitAtMoneyTable(context, event) {
    context.store.sitAtMoneyTable(event.payload.bet);
  },
}
```

After:

```ts
class GameStore extends MobXStateMachine<GameStore, GameEvent> {
  sitAtMoneyTable(event: GameEvent) {
    if (event.type === "SELECT_TABLE") {
      this.sitAtMoneyTableByBet(event.payload.bet);
    }
  }
}
```

Callbacks that use the store must be regular functions:

```ts
class GameStore extends MobXStateMachine<GameStore, GameEvent> {
  selectTable(event: GameEvent) {
    if (event.type === "SELECT_TABLE") {
      this.selectTableById(event.payload.id);
    }
  }
}
```

Do not use arrow functions when the callback needs `this`; arrows keep the
surrounding lexical `this` and will not receive the MobX store instance.

`BaseMachineState` remains available as a legacy alias, but new code should
extend `MobXStateMachine`.
