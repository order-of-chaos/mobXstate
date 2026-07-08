# @orderofchaos/mobxstate

## 0.2.0

### Minor Changes

- d9084c7: Add static state `props`, richer action meta and observable root completion.

  - State nodes accept `props`; they merge root-to-leaf and are exposed as
    `snapshot.props` and the observable computed `props` on `MobXStateMachine`.
  - Named actions receive an enriched meta: `state`, `statePath`, `props`, and
    `kind` (`entry` | `exit` | `transition` | `stop`), so actions no longer need
    to encode data in state names or read observable machine fields
    mid-macrostep.
  - Reaching a final state at the machine root now fires the public `onDone`
    callback and sets the observable `isDone` flag (reset on restart). The
    machine keeps running — stopping stays an explicit user decision.
