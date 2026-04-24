import type { Translations } from "@orderofchaos/ling";

export const en = {
  LiveMarketing: {
    "<code>invoke</code> starts a store method that may return a promise, cleanup function or child machine.":
      "<code>invoke</code> starts a store method that may return a promise, cleanup function or child machine.",
    "<code>send(\"RESET\")</code> works for payloadless events, while payload events require an object.":
      "<code>send(\"RESET\")</code> works for payloadless events, while payload events require an object.",
    "A MobX app where workflows should be explicit and testable.":
      "A MobX app where workflows should be explicit and testable.",
    "A form, CRUD screen or view without a strict lifecycle.":
      "A form, CRUD screen or view without a strict lifecycle.",
    "A named action is resolved as a MobX store method first and runs inside a MobX transaction.":
      "A named action is resolved as a MobX store method first and runs inside a MobX transaction.",
    "A simple serializable transition model without MobX store methods.":
      "A simple serializable transition model without MobX store methods.",
    "Actions directly in the store": "Actions directly in the store",
    Address: "Address",
    Approach: "Approach",
    "Approach comparison": "Approach comparison",
    Approve: "Approve",
    "Async Loader": "Async Loader",
    "Async lifecycle, guards and cleanup usually have to be specified manually.":
      "Async lifecycle, guards and cleanup usually have to be specified manually.",
    "At home": "At home",
    "Back home": "Back home",
    Benefits: "Benefits",
    "Bowl refilled": "Bowl refilled",
    Break: "Break",
    "Buttons send typed events, guards block invalid transitions, delays move the process by timer, invoke starts a lifecycle effect with cleanup, parallel state completes the checklist, and sprite tiles show the current state without manual synchronization.":
      "Buttons send typed events, guards block invalid transitions, delays move the process by timer, invoke starts a lifecycle effect with cleanup, parallel state completes the checklist, and sprite tiles show the current state without manual synchronization.",
    Cache: "Cache",
    "Call <code>store.send(event)</code>, check <code>store.matches(...)</code>, show <code>store.state</code>.":
      "Call <code>store.send(event)</code>, check <code>store.matches(...)</code>, show <code>store.state</code>.",
    Cancel: "Cancel",
    Cancelled: "Cancelled",
    Cat: "Cat",
    "Cat Routine": "Cat Routine",
    "Cats, dogs and adoption flow show the entire runtime in action":
      "Cats, dogs and adoption flow show the entire runtime in action",
    "Chasing toy": "Chasing toy",
    "Checklist complete": "Checklist complete",
    Checkout: "Checkout",
    "Checkout Flow": "Checkout Flow",
    "Coat brushed": "Coat brushed",
    Comparison: "Comparison",
    "Complex processes often spread across flags and imperative checks.":
      "Complex processes often spread across flags and imperative checks.",
    "Connect the UI": "Connect the UI",
    "Current states": "Current states",
    "Delayed transitions and failure state":
      "Delayed transitions and failure state",
    Deliver: "Deliver",
    Demos: "Demos",
    "Describe events and the statechart": "Describe events and the statechart",
    Documentation: "Documentation",
    "Documentation on one page": "Documentation on one page",
    "Does not try to cover the entire XState runtime surface.":
      "Does not try to cover the entire XState runtime surface.",
    Dog: "Dog",
    "Dog Walk": "Dog Walk",
    Drinking: "Drinking",
    Eating: "Eating",
    "Effects with cleanup": "Effects with cleanup",
    Empty: "Empty",
    Error: "Error",
    "Events type the inputs; config describes states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> and <code>invoke</code>.":
      "Events type the inputs; config describes states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> and <code>invoke</code>.",
    "Explicit events and pure updates.": "Explicit events and pure updates.",
    Fail: "Fail",
    "Fed and playful": "Fed and playful",
    Feed: "Feed",
    "Fewer boolean flags": "Fewer boolean flags",
    Found: "Found",
    "Full actor/statechart model and a rich state machine ecosystem.":
      "Full actor/statechart model and a rich state machine ecosystem.",
    Groom: "Groom",
    Grooming: "Grooming",
    "Guards as computed values": "Guards as computed values",
    "Guards read getters, observable properties or pure methods, so rules live next to data.":
      "Guards read getters, observable properties or pure methods, so rules live next to data.",
    Home: "Home",
    "Hungry, empty bowl": "Hungry, empty bowl",
    "Hungry, food ready": "Hungry, food ready",
    "Implement behavior in the store": "Implement behavior in the store",
    "Instead of <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, you keep one state value with explicit transitions.":
      "Instead of <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, you keep one state value with explicit transitions.",
    Leash: "Leash",
    Leashing: "Leashing",
    "Live scenarios": "Live scenarios",
    Load: "Load",
    "Lose leash": "Lose leash",
    "Lost leash": "Lost leash",
    "Match {{count}}": "Match {{count}}",
    "Meet cat": "Meet cat",
    "Methods become actions/effects, getters and boolean properties become guards, number properties become delays.":
      "Methods become actions/effects, getters and boolean properties become guards, number properties become delays.",
    "Minimal mental model": "Minimal mental model",
    "MobX store as source of behavior": "MobX store as source of behavior",
    "MobX-first state machines": "MobX-first state machines",
    "MobXstate describes states and transitions as a statechart, while data, guards, delays, actions and effects stay in the familiar MobX store. It is useful for interfaces where the process matters more than a set of flags.":
      "MobXstate describes states and transitions as a statechart, while data, guards, delays, actions and effects stay in the familiar MobX store. It is useful for interfaces where the process matters more than a set of flags.",
    "MobXstate does not replace every tool; it covers MobX-first workflows":
      "MobXstate does not replace every tool; it covers MobX-first workflows",
    "Needs water": "Needs water",
    "New case": "New case",
    Offline: "Offline",
    "One state value chooses the right sprite tile.":
      "One state value chooses the right sprite tile.",
    "Open live examples": "Open live examples",
    Pack: "Pack",
    "Parallel applicant checklist": "Parallel applicant checklist",
    Pay: "Pay",
    "Payload-aware <code>send</code> and callback contracts":
      "Payload-aware <code>send</code> and callback contracts",
    Pending: "Pending",
    "Persistence without surprises": "Persistence without surprises",
    Play: "Play",
    Playful: "Playful",
    Playing: "Playing",
    "Predictable workflows without a separate machine context":
      "Predictable workflows without a separate machine context",
    "Prepare home": "Prepare home",
    "Ready for a nap": "Ready for a nap",
    "Ready to walk": "Ready to walk",
    Refill: "Refill",
    Reset: "Reset",
    Resting: "Resting",
    "Result, error, retry and cache states":
      "Result, error, retry and cache states",
    Retry: "Retry",
    "Runtime checks for core machine semantics":
      "Runtime checks for core machine semantics",
    "Saved state values are validated before restore and can be normalized through <code>transformPersistedState</code>.":
      "Saved state values are validated before restore and can be normalized through <code>transformPersistedState</code>.",
    "Separate context/actions/effects next to MobX require an integration layer.":
      "Separate context/actions/effects next to MobX require an integration layer.",
    "Sequential order workflow": "Sequential order workflow",
    Shelter: "Shelter",
    "Shelter Match": "Shelter Match",
    Ship: "Ship",
    "Simple observable models, computed values and reactive UI.":
      "Simple observable models, computed values and reactive UI.",
    Sleeping: "Sleeping",
    Start: "Start",
    "Start in 3 steps": "Start in 3 steps",
    "State-driven assets": "State-driven assets",
    "Statechart + MobX store methods, typed events, observable runtime state.":
      "Statechart + MobX store methods, typed events, observable runtime state.",
    "Statechart controls the process, MobX store controls the data":
      "Statechart controls the process, MobX store controls the data",
    "Statecharts for MobX stores": "Statecharts for MobX stores",
    Step: "Step",
    "Strict event types": "Strict event types",
    "Strong at": "Strong at",
    Success: "Success",
    Tested: "Tested",
    "The library is useful when UI depends on rules: an order cannot be paid before validation, a pet cannot be fed without food, and an async connection must be cleaned up when leaving a state.":
      "The library is useful when UI depends on rules: an order cannot be paid before validation, a pet cannot be fed without food, and an async connection must be cleaned up when leaving a state.",
    "The machine answers what is allowed now, the store answers what data changes. UI sends events and observes state.":
      "The machine answers what is allowed now, the store answers what data changes. UI sends events and observes state.",
    "This table describes practical tradeoffs without pretending one approach is universal. If an app is already built on MobX, MobXstate adds an explicit process model without moving behavior into a separate runtime context.":
      "This table describes practical tradeoffs without pretending one approach is universal. If an app is already built on MobX, MobXstate adds an explicit process model without moving behavior into a separate runtime context.",
    Tradeoff: "Tradeoff",
    "Traffic Light": "Traffic Light",
    Typed: "Typed",
    "Unofficial library for MobX; not affiliated with MobX, Stately or XState.":
      "Unofficial library for MobX; not affiliated with MobX, Stately or XState.",
    Vet: "Vet",
    "Vet check": "Vet check",
    "Vet visit": "Vet visit",
    Wake: "Wake",
    "Walk dog": "Walk dog",
    Walking: "Walking",
    Water: "Water",
    "When to choose": "When to choose",
    "Why it is useful": "Why it is useful",
    "XState runtime dependency": "XState runtime dependency",
    "You need the full XState surface or the app is built around actors.":
      "You need the full XState surface or the app is built around actors.",
    cat: "cat",
    cleanups: "cleanups",
    dog: "dog",
    done: "done",
    food: "food",
    "green entries": "green entries",
    grooms: "grooms",
    home: "home",
    last: "last",
    matches: "matches",
    meals: "meals",
    meters: "meters",
    note: "note",
    paid: "paid",
    play: "play",
    requests: "requests",
    state: "state",
    steps: "steps",
    vet: "vet",
    waiting: "waiting",
    water: "water",
  },
} satisfies Translations;
