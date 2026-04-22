import { autorun, configure, makeObservable, observable } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMachine,
  MobXStateMachine,
  type DoneInvokeEvent,
  type MachineOptions,
} from "../BaseMachineState";

type CounterEvent =
  | { type: "INC"; by: number }
  | { type: "START" }
  | { type: "LOADED"; value: number };

const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const counterMachine = createMachine<CounterEvent>({
  id: "counter",
  predictableActionArguments: true,
  schema: {
    events: {} as CounterEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
        START: {
          target: "loading",
        },
      },
    },
    loading: {
      invoke: {
        src: "loadValue",
      },
      on: {
        LOADED: {
          target: "ready",
          actions: "setLoadedValue",
        },
      },
    },
    ready: {},
  },
});

const counterOptions: MachineOptions<CounterState, CounterEvent> = {
  actions: {
    increment(event) {
      if (event.type === "INC") {
        this.count += event.by;
      }
    },
    setLoadedValue(event) {
      if (event.type === "LOADED") {
        this.count = event.value;
      }
    },
  },
  services: {
    loadValue() {
      return (send: (event: CounterEvent) => void) => {
        send({ type: "LOADED", value: this.loadedValue });
      };
    },
  },
};

class CounterState extends MobXStateMachine<CounterState, CounterEvent> {
  public count = 0;

  public loadedValue = 42;

  constructor() {
    super(counterMachine, counterOptions, { deferStart: false });

    makeObservable(this, {
      count: observable,
      loadedValue: observable,
    });
  }
}

type GuardEvent = { type: "CHECK" };

const guardedMachine = createMachine<GuardEvent>({
  id: "guarded",
  predictableActionArguments: true,
  schema: {
    events: {} as GuardEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        CHECK: [
          {
            target: "allowed",
            cond: "canPass",
            actions: "recordAllowed",
          },
          {
            target: "blocked",
            actions: "recordBlocked",
          },
        ],
      },
    },
    allowed: {},
    blocked: {},
  },
});

const guardedOptions: MachineOptions<GuardedState, GuardEvent> = {
  actions: {
    recordAllowed() {
      this.log.push("allowed");
    },
    recordBlocked() {
      this.log.push("blocked");
    },
  },
  guards: {
    canPass() {
      return this.allowed;
    },
  },
};

class GuardedState extends MobXStateMachine<GuardedState, GuardEvent> {
  public allowed: boolean;

  public log: string[] = [];

  constructor(allowed: boolean) {
    super(guardedMachine, guardedOptions, { deferStart: false });
    this.allowed = allowed;
  }
}

type DoorEvent = { type: "OPEN" } | { type: "CLOSE" };

const doorMachine = createMachine<DoorEvent>({
  id: "door",
  predictableActionArguments: true,
  schema: {
    events: {} as DoorEvent,
  },
  initial: "closed",
  states: {
    closed: {
      on: {
        OPEN: "open",
      },
    },
    open: {
      entry: "recordEntry",
      exit: "recordExit",
      on: {
        CLOSE: "closed",
      },
    },
  },
});

const doorOptions: MachineOptions<DoorState, DoorEvent> = {
  actions: {
    recordEntry() {
      this.log.push("entry");
    },
    recordExit() {
      this.log.push("exit");
    },
  },
};

class DoorState extends MobXStateMachine<DoorState, DoorEvent> {
  public log: string[] = [];

  constructor() {
    super(doorMachine, doorOptions, { deferStart: false });
  }
}

type PromiseEvent = { type: "START" } | DoneInvokeEvent<number>;

const promiseMachine = createMachine<PromiseEvent>({
  id: "promise",
  predictableActionArguments: true,
  schema: {
    events: {} as PromiseEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "loading",
      },
    },
    loading: {
      invoke: {
        id: "loadNumber",
        src: "loadNumber",
        onDone: {
          target: "success",
          actions: "assignLoaded",
        },
      },
    },
    success: {},
  },
});

const promiseOptions: MachineOptions<PromiseState, PromiseEvent> = {
  actions: {
    assignLoaded(event) {
      if (event.type === "done.invoke.loadNumber") {
        this.loaded = event.data;
      }
    },
  },
  services: {
    loadNumber() {
      return Promise.resolve(this.value);
    },
  },
};

class PromiseState extends MobXStateMachine<PromiseState, PromiseEvent> {
  public loaded = 0;

  constructor(public value: number) {
    super(promiseMachine, promiseOptions, { deferStart: false });
  }
}

type EffectEvent = { type: "START" } | DoneInvokeEvent<string, "fetchPet">;

const effectMachine = createMachine<EffectEvent>({
  id: "effect",
  predictableActionArguments: true,
  schema: {
    events: {} as EffectEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "loading",
      },
    },
    loading: {
      invoke: {
        id: "fetchPet",
        src: "fetchPet",
        onDone: {
          target: "success",
          actions: "assignPet",
        },
      },
    },
    success: {},
  },
});

const effectOptions: MachineOptions<EffectState, EffectEvent> = {
  actions: {
    assignPet(event) {
      if (event.type === "done.invoke.fetchPet") {
        this.pet = event.data;
      }
    },
  },
  effects: {
    fetchPet() {
      this.effectCalls += 1;
      return Promise.resolve(this.nextPet);
    },
  },
};

class EffectState extends MobXStateMachine<EffectState, EffectEvent> {
  public effectCalls = 0;

  public nextPet = "cat";

  public pet = "";

  constructor() {
    super(effectMachine, effectOptions, { deferStart: false });

    makeObservable(this, {
      effectCalls: observable,
      nextPet: observable,
      pet: observable,
    });
  }
}

type ActivityEvent = { type: "STOP" };

const activityMachine = createMachine<ActivityEvent>({
  id: "activity",
  predictableActionArguments: true,
  schema: {
    events: {} as ActivityEvent,
  },
  initial: "running",
  states: {
    running: {
      activities: ["polling"],
      on: {
        STOP: "stopped",
      },
    },
    stopped: {},
  },
});

const activityOptions: MachineOptions<ActivityState, ActivityEvent> = {
  activities: {
    polling(activity) {
      this.activityTypes.push(activity.type);

      return () => {
        this.activityDisposals += 1;
      };
    },
  },
};

class ActivityState extends MobXStateMachine<ActivityState, ActivityEvent> {
  public activityTypes: string[] = [];

  public activityDisposals = 0;

  constructor() {
    super(activityMachine, activityOptions);
  }
}

type DynamicDelayEvent = { type: "START" };

const dynamicDelayMachine = createMachine<DynamicDelayEvent>({
  id: "dynamicDelay",
  predictableActionArguments: true,
  schema: {
    events: {} as DynamicDelayEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "waiting",
      },
    },
    waiting: {
      after: {
        WAIT: "done",
      },
    },
    done: {},
  },
});

const dynamicDelayOptions: MachineOptions<
  DynamicDelayState,
  DynamicDelayEvent
> = {
  delays: {
    WAIT() {
      return this.waitMs;
    },
  },
};

class DynamicDelayState extends MobXStateMachine<
  DynamicDelayState,
  DynamicDelayEvent
> {
  constructor(public waitMs: number) {
    super(dynamicDelayMachine, dynamicDelayOptions, { deferStart: false });
  }
}

type ManualEvent = { type: "GO" };

const manualMachine = createMachine<ManualEvent>({
  id: "manual",
  predictableActionArguments: true,
  schema: {
    events: {} as ManualEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        GO: "done",
      },
    },
    done: {},
  },
});

class ManualState extends MobXStateMachine<ManualState, ManualEvent> {
  constructor() {
    super(manualMachine, { stopped: true, deferStart: false });
  }
}

type FinalEvent = { type: "FINISH" };

const finalMachine = createMachine<FinalEvent>({
  id: "final",
  predictableActionArguments: true,
  schema: {
    events: {} as FinalEvent,
  },
  initial: "working",
  states: {
    working: {
      on: {
        FINISH: "done",
      },
    },
    done: {
      type: "final",
    },
  },
});

class FinalState extends MobXStateMachine<FinalState, FinalEvent> {
  constructor() {
    super(finalMachine, { deferStart: false });
  }
}

type AlwaysEvent = { type: "RESET" };

const alwaysMachine = createMachine<AlwaysEvent>({
  id: "always",
  predictableActionArguments: true,
  schema: {
    events: {} as AlwaysEvent,
  },
  initial: "check",
  states: {
    check: {
      always: [
        {
          target: "enabled",
          cond: "isEnabled",
        },
        {
          target: "disabled",
        },
      ],
    },
    enabled: {},
    disabled: {},
  },
});

const alwaysOptions: MachineOptions<AlwaysState, AlwaysEvent> = {
  guards: {
    isEnabled() {
      return this.enabled;
    },
  },
};

class AlwaysState extends MobXStateMachine<AlwaysState, AlwaysEvent> {
  public enabled: boolean;

  constructor(enabled: boolean) {
    super(alwaysMachine, alwaysOptions);
    this.enabled = enabled;
  }
}

type TimerEvent = { type: "START" };

const timerMachine = createMachine<TimerEvent>({
  id: "timer",
  predictableActionArguments: true,
  schema: {
    events: {} as TimerEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "waiting",
      },
    },
    waiting: {
      after: {
        25: "done",
      },
    },
    done: {},
  },
});

class TimerState extends MobXStateMachine<TimerState, TimerEvent> {
  constructor() {
    super(timerMachine, { deferStart: false });
  }
}

type ParallelEvent = { type: "LEFT" } | { type: "RIGHT" };

const parallelMachine = createMachine<ParallelEvent>({
  id: "parallel",
  predictableActionArguments: true,
  schema: {
    events: {} as ParallelEvent,
  },
  type: "parallel",
  states: {
    left: {
      initial: "idle",
      states: {
        idle: {
          on: {
            LEFT: "done",
          },
        },
        done: {},
      },
    },
    right: {
      initial: "idle",
      states: {
        idle: {
          on: {
            RIGHT: "done",
          },
        },
        done: {},
      },
    },
  },
});

class ParallelState extends MobXStateMachine<ParallelState, ParallelEvent> {
  constructor() {
    super(parallelMachine, { deferStart: false });
  }
}

type PersistEvent = { type: "GO" };

const persistMachine = createMachine<PersistEvent>({
  id: "persist",
  predictableActionArguments: true,
  schema: {
    events: {} as PersistEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        GO: "active",
      },
    },
    active: {},
  },
});

class PersistState extends MobXStateMachine<PersistState, PersistEvent> {
  constructor(persistentKey: string) {
    super(persistMachine, { persistentKey, deferStart: false });
  }
}

describe("MobXStateMachine", () => {
  afterEach(() => {
    configure({ enforceActions: "never" });
    vi.useRealTimers();
  });

  it("updates MobX observable state when the machine transitions", async () => {
    const counter = new CounterState();
    const listener = vi.fn();
    const dispose = autorun(() => listener(counter.state));

    await counter.ready;
    counter.send({ type: "START" });

    expect(counter.matches("ready")).toBe(true);
    expect(listener).toHaveBeenCalledWith("ready");

    dispose();
  });

  it("runs actions and services without passing a machine context", async () => {
    const counter = new CounterState();

    await counter.ready;
    counter.send({ type: "INC", by: 3 });
    counter.send({ type: "START" });

    expect(counter.count).toBe(42);
  });

  it("runs machine actions as MobX actions and guards as computed derivations", async () => {
    type StrictEvent = { type: "START" };

    const strictMachine = createMachine<StrictEvent>({
      id: "strictMobx",
      predictableActionArguments: true,
      schema: {
        events: {} as StrictEvent,
      },
      initial: "checking",
      states: {
        checking: {
          always: {
            target: "done",
            cond: "canStart",
            actions: "recordStart",
          },
        },
        done: {},
      },
    });

    class StrictState extends MobXStateMachine<StrictState, StrictEvent> {
      public starts = 0;

      public enabled = true;

      constructor() {
        super(
          strictMachine,
          {
            actions: {
              recordStart() {
                this.starts += 1;
              },
            },
            guards: {
              canStart() {
                return this.enabled;
              },
            },
          },
          { stopped: true, deferStart: false },
        );

        makeObservable(this, {
          enabled: observable,
          starts: observable,
        });
      }
    }

    configure({ enforceActions: "always" });
    const strict = new StrictState();

    await strict.startMachine();

    expect(strict.matches("done")).toBe(true);
    expect(strict.starts).toBe(1);
  });

  it("resolves actions, guards, delays and effects from store members", async () => {
    vi.useFakeTimers();
    configure({ enforceActions: "always" });

    type StoreMemberEvent =
      | { type: "DATA"; value: string }
      | { type: "STOP" };

    const storeMemberMachine = createMachine<StoreMemberEvent>({
      id: "storeMember",
      predictableActionArguments: true,
      schema: {
        events: {} as StoreMemberEvent,
      },
      initial: "checking",
      states: {
        checking: {
          always: {
            target: "waiting",
            cond: "canStart",
            actions: "recordStart",
          },
        },
        waiting: {
          after: {
            WAIT: "streaming",
          },
        },
        streaming: {
          invoke: "connectStream",
          on: {
            DATA: {
              actions: "recordData",
            },
            STOP: "done",
          },
        },
        done: {},
      },
    });

    class StoreMemberState extends MobXStateMachine<
      StoreMemberState,
      StoreMemberEvent
    > {
      public starts = 0;

      public enabled = true;

      public waitMs = 25;

      public connections = 0;

      public disconnections = 0;

      public messages: string[] = [];

      public pushFromEffect: ((value: string) => void) | undefined;

      constructor() {
        super(storeMemberMachine, {
          stopped: true,
          deferStart: false,
          strict: true,
        });

        makeObservable(this, {
          connections: observable,
          disconnections: observable,
          enabled: observable,
          messages: observable,
          starts: observable,
          waitMs: observable,
        });
      }

      public get canStart(): boolean {
        return this.enabled;
      }

      public get WAIT(): number {
        return this.waitMs;
      }

      public recordStart(): void {
        this.starts += 1;
      }

      public recordData(event: StoreMemberEvent): void {
        if (event.type === "DATA") {
          this.messages.push(event.value);
        }
      }

      public connectStream(): () => void {
        this.connections += 1;
        this.pushFromEffect = (value) => {
          this.send({ type: "DATA", value });
        };

        return () => {
          this.disconnections += 1;
          this.pushFromEffect = undefined;
        };
      }
    }

    const store = new StoreMemberState();

    await store.startMachine();
    expect(store.matches("waiting")).toBe(true);
    expect(store.starts).toBe(1);

    vi.advanceTimersByTime(25);
    expect(store.matches("streaming")).toBe(true);
    expect(store.connections).toBe(1);

    store.pushFromEffect?.("first");
    expect(store.messages).toEqual(["first"]);

    store.send({ type: "STOP" });
    expect(store.matches("done")).toBe(true);
    expect(store.disconnections).toBe(1);
    expect(store.pushFromEffect).toBeUndefined();
  });

  it("runs guards and actions against the MobX store instance", async () => {
    const allowed = new GuardedState(true);
    const blocked = new GuardedState(false);

    await allowed.ready;
    await blocked.ready;

    allowed.send({ type: "CHECK" });
    blocked.send({ type: "CHECK" });

    expect(allowed.matches("allowed")).toBe(true);
    expect(allowed.log).toEqual(["allowed"]);
    expect(blocked.matches("blocked")).toBe(true);
    expect(blocked.log).toEqual(["blocked"]);
  });

  it("runs entry and exit actions against the MobX store instance", async () => {
    const door = new DoorState();

    await door.ready;
    door.send({ type: "OPEN" });
    door.send({ type: "CLOSE" });

    expect(door.log).toEqual(["entry", "exit"]);
  });

  it("supports promise invokes", async () => {
    const promise = new PromiseState(7);

    await promise.ready;
    promise.send({ type: "START" });
    await flushPromises();

    expect(promise.matches("success")).toBe(true);
    expect(promise.loaded).toBe(7);
  });

  it("supports MachineOptions.effects as the invoke fallback", async () => {
    configure({ enforceActions: "always" });
    const effect = new EffectState();

    await effect.ready;
    effect.send({ type: "START" });
    await flushPromises();

    expect(effect.matches("success")).toBe(true);
    expect(effect.effectCalls).toBe(1);
    expect(effect.pet).toBe("cat");
  });

  it("starts and cleans up activities against the MobX store instance", async () => {
    const activity = new ActivityState();

    await activity.ready;
    expect(activity.activityTypes).toEqual(["polling"]);

    activity.send({ type: "STOP" });

    expect(activity.matches("stopped")).toBe(true);
    expect(activity.activityDisposals).toBe(1);
  });

  it("supports named dynamic delays from the MobX store instance", async () => {
    vi.useFakeTimers();
    const delayed = new DynamicDelayState(75);

    await delayed.ready;
    delayed.send({ type: "START" });
    vi.advanceTimersByTime(74);

    expect(delayed.matches("waiting")).toBe(true);

    vi.advanceTimersByTime(1);

    expect(delayed.matches("done")).toBe(true);
  });

  it("can defer machine start until startMachine is called", async () => {
    const manual = new ManualState();

    expect(manual.snapshot).toBeUndefined();

    await manual.startMachine();

    expect(manual.matches("idle")).toBe(true);
  });

  it("supports final states", async () => {
    const final = new FinalState();

    await final.ready;
    final.send({ type: "FINISH" });

    expect(final.matches("done")).toBe(true);
  });

  it("supports always transitions after subclass fields are initialized", async () => {
    const enabled = new AlwaysState(true);
    const disabled = new AlwaysState(false);

    await enabled.ready;
    await disabled.ready;

    expect(enabled.matches("enabled")).toBe(true);
    expect(disabled.matches("disabled")).toBe(true);
  });

  it("supports delayed transitions", async () => {
    vi.useFakeTimers();
    const timer = new TimerState();

    await timer.ready;
    timer.send({ type: "START" });
    expect(timer.matches("waiting")).toBe(true);

    vi.advanceTimersByTime(25);

    expect(timer.matches("done")).toBe(true);
  });

  it("tracks parallel state values", async () => {
    const machine = new ParallelState();

    await machine.ready;
    machine.send({ type: "LEFT" });
    machine.send({ type: "RIGHT" });

    expect(machine.state).toEqual({
      left: "done",
      right: "done",
    });
  });

  it("persists and restores state values by persistentKey", async () => {
    const persistentKey = `test-${Date.now()}-${Math.random()}`;
    const first = new PersistState(persistentKey);

    await first.ready;
    first.send({ type: "GO" });
    expect(first.matches("active")).toBe(true);
    first.stopMachine();

    const second = new PersistState(persistentKey);
    await second.ready;

    expect(second.matches("active")).toBe(true);
  });

  it("throws clear errors for unknown initial states", async () => {
    type ValidationEvent = { type: "GO" };

    const invalidInitialMachine = createMachine<ValidationEvent>({
      id: "invalidInitial",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "missing",
      states: {
        idle: {},
      },
    });

    class InvalidInitialState extends MobXStateMachine<
      InvalidInitialState,
      ValidationEvent
    > {
      constructor() {
        super(invalidInitialMachine, { stopped: true, deferStart: false });
      }
    }

    const machine = new InvalidInitialState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Unknown initial state "missing"',
    );
  });

  it("throws clear errors for unknown transition targets", async () => {
    type ValidationEvent = { type: "GO" };

    const invalidTargetMachine = createMachine<ValidationEvent>({
      id: "invalidTarget",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "idle",
      states: {
        idle: {
          on: {
            GO: "missing",
          },
        },
        done: {},
      },
    });

    class InvalidTargetState extends MobXStateMachine<
      InvalidTargetState,
      ValidationEvent
    > {
      constructor() {
        super(invalidTargetMachine, { stopped: true, deferStart: false });
      }
    }

    const machine = new InvalidTargetState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Unknown transition target "missing"',
    );
  });

  it("throws clear errors for unsupported deep history", async () => {
    type ValidationEvent = { type: "BACK" };

    const deepHistoryMachine = createMachine<ValidationEvent>({
      id: "deepHistory",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "active",
      states: {
        active: {
          initial: "idle",
          states: {
            idle: {},
            hist: {
              history: "deep",
            },
          },
        },
      },
    });

    class DeepHistoryState extends MobXStateMachine<
      DeepHistoryState,
      ValidationEvent
    > {
      constructor() {
        super(deepHistoryMachine, { stopped: true, deferStart: false });
      }
    }

    const machine = new DeepHistoryState();

    await expect(machine.startMachine()).rejects.toThrow(
      "Deep history is not supported",
    );
  });

  it("keeps missing named implementations as no-op outside strict mode", async () => {
    type ValidationEvent = { type: "GO" };

    const looseMachine = createMachine<ValidationEvent>({
      id: "looseMissingAction",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "idle",
      states: {
        idle: {
          entry: "missingAction",
          on: {
            GO: {
              target: "done",
              actions: "missingTransitionAction",
            },
          },
        },
        done: {},
      },
    });

    class LooseState extends MobXStateMachine<LooseState, ValidationEvent> {
      constructor() {
        super(looseMachine, { stopped: true, deferStart: false });
      }
    }

    const machine = new LooseState();

    await machine.startMachine();
    machine.send({ type: "GO" });

    expect(machine.matches("done")).toBe(true);
  });

  it("throws strict errors for missing action implementations", async () => {
    type ValidationEvent = { type: "GO" };

    const missingActionMachine = createMachine<ValidationEvent>({
      id: "missingAction",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "idle",
      states: {
        idle: {
          entry: "recordEntry",
        },
      },
    });

    class MissingActionState extends MobXStateMachine<
      MissingActionState,
      ValidationEvent
    > {
      constructor() {
        super(missingActionMachine, {
          stopped: true,
          deferStart: false,
          strict: true,
        });
      }
    }

    const machine = new MissingActionState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Missing action implementation "recordEntry"',
    );
  });

  it("throws strict errors for missing guard implementations", async () => {
    type ValidationEvent = { type: "GO" };

    const missingGuardMachine = createMachine<ValidationEvent>({
      id: "missingGuard",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "idle",
      states: {
        idle: {
          on: {
            GO: {
              target: "done",
              cond: "canGo",
            },
          },
        },
        done: {},
      },
    });

    class MissingGuardState extends MobXStateMachine<
      MissingGuardState,
      ValidationEvent
    > {
      constructor() {
        super(missingGuardMachine, {
          stopped: true,
          deferStart: false,
          strict: true,
        });
      }
    }

    const machine = new MissingGuardState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Missing guard implementation "canGo"',
    );
  });

  it("throws strict errors for missing delay implementations", async () => {
    type ValidationEvent = { type: "GO" };

    const missingDelayMachine = createMachine<ValidationEvent>({
      id: "missingDelay",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "waiting",
      states: {
        waiting: {
          after: {
            WAIT: "done",
          },
        },
        done: {},
      },
    });

    class MissingDelayState extends MobXStateMachine<
      MissingDelayState,
      ValidationEvent
    > {
      constructor() {
        super(missingDelayMachine, {
          stopped: true,
          deferStart: false,
          strict: true,
        });
      }
    }

    const machine = new MissingDelayState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Missing delay implementation "WAIT"',
    );
  });

  it("throws strict errors for missing effect implementations", async () => {
    type ValidationEvent = { type: "GO" };

    const missingEffectMachine = createMachine<ValidationEvent>({
      id: "missingEffect",
      predictableActionArguments: true,
      schema: {
        events: {} as ValidationEvent,
      },
      initial: "loading",
      states: {
        loading: {
          invoke: "load",
        },
      },
    });

    class MissingEffectState extends MobXStateMachine<
      MissingEffectState,
      ValidationEvent
    > {
      constructor() {
        super(missingEffectMachine, {
          stopped: true,
          deferStart: false,
          strict: true,
        });
      }
    }

    const machine = new MissingEffectState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Missing effect implementation "load"',
    );
  });

  it("runs disposers on stop and can restart", async () => {
    const counter = new CounterState();
    const dispose = vi.fn();

    await counter.ready;
    counter.addDisposer(dispose);
    counter.stopMachine();

    expect(dispose).toHaveBeenCalledOnce();

    await counter.restart();

    expect(counter.matches("idle")).toBe(true);
  });

  it("runs onStop hook when stopped", async () => {
    const counter = new CounterState();
    const onStop = vi.fn();

    counter.onStop = onStop;

    await counter.ready;
    counter.stopMachine();

    expect(onStop).toHaveBeenCalledOnce();
  });
});
