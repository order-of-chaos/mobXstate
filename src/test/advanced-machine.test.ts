import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MobXStateMachine,
  MachineCleanupError,
  createMachine,
  sendTo,
  type MachineOptions,
} from "../MobXStateMachine";

const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

type EditorEvent =
  | { type: "TYPE"; value: string }
  | { type: "SAVE" }
  | { type: "DISABLE" }
  | { type: "ENABLE" };

const editorMachine = createMachine<EditorEvent>({
  id: "editor",
  predictableActionArguments: true,
  schema: {
    events: {} as EditorEvent,
  },
  initial: "editing",
  states: {
    editing: {
      initial: "clean",
      states: {
        clean: {
          on: {
            TYPE: {
              target: "dirty",
              actions: "appendText",
            },
          },
        },
        dirty: {
          on: {
            TYPE: {
              actions: "appendText",
            },
            SAVE: "clean",
          },
        },
        hist: {
          history: "shallow",
        },
      },
      on: {
        DISABLE: "disabled",
      },
    },
    disabled: {
      on: {
        ENABLE: "editing.hist",
      },
    },
  },
});

const editorOptions: MachineOptions<EditorState, EditorEvent> = {
  actions: {
    appendText(event) {
      if (event.type === "TYPE") {
        this.text += event.value;
      }
    },
  },
};

class EditorState extends MobXStateMachine<EditorState, EditorEvent> {
  public text = "";

  constructor() {
    super(editorMachine, editorOptions, { deferStart: false });
  }
}

type SelfTransitionEvent = { type: "PING" } | { type: "RESET" };

const selfTransitionMachine = createMachine<SelfTransitionEvent>({
  id: "selfTransition",
  predictableActionArguments: true,
  schema: {
    events: {} as SelfTransitionEvent,
  },
  initial: "active",
  states: {
    active: {
      entry: "recordEntry",
      exit: "recordExit",
      on: {
        PING: {
          internal: true,
          actions: "recordPing",
        },
        RESET: {
          target: "active",
          internal: false,
        },
      },
    },
  },
});

const selfTransitionOptions: MachineOptions<
  SelfTransitionState,
  SelfTransitionEvent
> = {
  actions: {
    recordEntry() {
      this.log.push("entry");
    },
    recordExit() {
      this.log.push("exit");
    },
    recordPing() {
      this.log.push("ping");
    },
  },
};

class SelfTransitionState extends MobXStateMachine<
  SelfTransitionState,
  SelfTransitionEvent
> {
  public log: string[] = [];

  constructor() {
    super(selfTransitionMachine, selfTransitionOptions);
  }
}

type StreamEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "MESSAGE"; value: string };

const streamMachine = createMachine<StreamEvent>({
  id: "stream",
  predictableActionArguments: true,
  schema: {
    events: {} as StreamEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        OPEN: "streaming",
      },
    },
    streaming: {
      invoke: {
        id: "streamConnection",
        src: "streamConnection",
      },
      on: {
        CLOSE: "closed",
        MESSAGE: {
          actions: "recordMessage",
        },
      },
    },
    closed: {},
  },
});

const streamOptions: MachineOptions<StreamState, StreamEvent> = {
  actions: {
    recordMessage(event) {
      if (event.type === "MESSAGE") {
        this.messages.push(event.value);
      }
    },
  },
};

class StreamState extends MobXStateMachine<StreamState, StreamEvent> {
  public messages: string[] = [];

  public sendFromStream: ((event: StreamEvent) => void) | undefined;

  public starts = 0;

  public stops = 0;

  constructor() {
    super(streamMachine, streamOptions, { deferStart: false });
  }

  public streamConnection(): () => void {
    this.starts += 1;
    this.sendFromStream = (event) => {
      this.send(event);
    };

    return () => {
      this.stops += 1;
    };
  }
}

type ChannelEvent =
  | { type: "OPEN" }
  | { type: "PING_CHILD" }
  | { type: "CLOSE" };

const channelChildMachine = createMachine<{ type: "PING_CHILD" }>({
  id: "channelChild",
  predictableActionArguments: true,
  schema: {
    events: {} as { type: "PING_CHILD" },
  },
  initial: "waiting",
  states: {
    waiting: {
      on: {
        PING_CHILD: "done",
      },
    },
    done: {
      type: "final",
    },
  },
});

const channelMachine = createMachine<ChannelEvent>({
  id: "channel",
  predictableActionArguments: true,
  schema: {
    events: {} as ChannelEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        OPEN: "connected",
      },
    },
    connected: {
      invoke: {
        id: "channelConnection",
        src: "channelConnection",
        onDone: {
          actions: "recordAck",
        },
      },
      on: {
        PING_CHILD: {
          actions: sendTo(
            { type: "PING_CHILD" },
            { to: "channelConnection" },
          ),
        },
        CLOSE: "closed",
      },
    },
    closed: {},
  },
});

const channelOptions: MachineOptions<ChannelState, ChannelEvent> = {
  actions: {
    recordAck() {
      this.acks += 1;
    },
  },
};

class ChannelState extends MobXStateMachine<ChannelState, ChannelEvent> {
  public acks = 0;

  constructor() {
    super(channelMachine, channelOptions, { deferStart: false });
  }

  public channelConnection(): typeof channelChildMachine {
    return channelChildMachine;
  }
}

type ChildFlowEvent = { type: "FINISH_CHILD" };

const childFlowMachine = createMachine<ChildFlowEvent>({
  id: "childFlow",
  predictableActionArguments: true,
  schema: {
    events: {} as ChildFlowEvent,
  },
  initial: "active",
  states: {
    active: {
      on: {
        FINISH_CHILD: "done",
      },
    },
    done: {
      type: "final",
    },
  },
});

type ParentFlowEvent = { type: "START" } | ChildFlowEvent;

const parentFlowMachine = createMachine<ParentFlowEvent>({
  id: "parentFlow",
  predictableActionArguments: true,
  schema: {
    events: {} as ParentFlowEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "runningChild",
      },
    },
    runningChild: {
      invoke: {
        id: "childFlow",
        src: "childFlow",
        autoForward: true,
        onDone: {
          target: "complete",
          actions: "recordComplete",
        },
      },
    },
    complete: {},
  },
});

const parentFlowOptions: MachineOptions<ParentFlowState, ParentFlowEvent> = {
  actions: {
    recordComplete() {
      this.completed += 1;
    },
  },
};

class ParentFlowState extends MobXStateMachine<
  ParentFlowState,
  ParentFlowEvent
> {
  public completed = 0;

  constructor() {
    super(parentFlowMachine, parentFlowOptions, { deferStart: false });
  }

  public childFlow(): typeof childFlowMachine {
    return childFlowMachine;
  }
}

type FailingEvent =
  | { type: "START" }
  | { type: "done.invoke.fetchValue"; data: number }
  | { type: "error.platform.fetchValue"; data: unknown };

const failingMachine = createMachine<FailingEvent>({
  id: "failing",
  predictableActionArguments: true,
  schema: {
    events: {} as FailingEvent,
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
        id: "fetchValue",
        src: "fetchValue",
        onDone: "success",
        onError: {
          target: "failure",
          actions: "recordError",
        },
      },
    },
    success: {},
    failure: {},
  },
});

const failingOptions: MachineOptions<FailingState, FailingEvent> = {
  actions: {
    recordError(event) {
      if (event.type === "error.platform.fetchValue") {
        this.error = event.data instanceof Error ? event.data.message : "error";
      }
    },
  },
  effects: {
    fetchValue() {
      return Promise.reject(this.reason);
    },
  },
};

class FailingState extends MobXStateMachine<FailingState, FailingEvent> {
  public error = "";

  constructor(public readonly reason: Error) {
    super(failingMachine, failingOptions, { deferStart: false });
  }
}

type SyncEffectEvent =
  | { type: "START" }
  | { type: "error.platform.syncLoad"; data: unknown };

const syncEffectMachine = createMachine<SyncEffectEvent>({
  id: "syncEffect",
  predictableActionArguments: true,
  schema: {
    events: {} as SyncEffectEvent,
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
        id: "syncLoad",
        src: "syncLoad",
        onError: {
          target: "failure",
          actions: "recordError",
        },
      },
    },
    failure: {},
  },
});

const optionsSyncEffectOptions: MachineOptions<
  OptionsSyncEffectState,
  SyncEffectEvent
> = {
  actions: {
    recordError(event) {
      if (event.type === "error.platform.syncLoad") {
        this.error = event.data instanceof Error ? event.data.message : "error";
      }
    },
  },
  effects: {
    syncLoad() {
      throw this.reason;
    },
  },
};

class StoreSyncEffectState extends MobXStateMachine<
  StoreSyncEffectState,
  SyncEffectEvent
> {
  public error = "";

  public reason = new Error("store failed");

  constructor() {
    super(syncEffectMachine, { deferStart: false });
  }

  public syncLoad(): void {
    throw this.reason;
  }

  public recordError(event: SyncEffectEvent): void {
    if (event.type === "error.platform.syncLoad") {
      this.error = event.data instanceof Error ? event.data.message : "error";
    }
  }
}

class OptionsSyncEffectState extends MobXStateMachine<
  OptionsSyncEffectState,
  SyncEffectEvent
> {
  public error = "";

  public reason = new Error("options failed");

  constructor() {
    super(syncEffectMachine, optionsSyncEffectOptions, { deferStart: false });
  }
}

type InvalidEffectReturnEvent = { type: "RESET" };

const invalidEffectReturnMachine = createMachine<InvalidEffectReturnEvent>({
  id: "invalidEffectReturn",
  predictableActionArguments: true,
  schema: {
    events: {} as InvalidEffectReturnEvent,
  },
  initial: "loading",
  states: {
    loading: {
      invoke: "load",
    },
  },
});

class InvalidEffectReturnState extends MobXStateMachine<
  InvalidEffectReturnState,
  InvalidEffectReturnEvent
> {
  constructor() {
    super(invalidEffectReturnMachine, {
      stopped: true,
      deferStart: false,
      strict: true,
    });
  }

  public load(): unknown {
    return { value: "unsupported" };
  }
}

type CancelPromiseEvent =
  | { type: "START" }
  | { type: "CANCEL" }
  | { type: "done.invoke.load"; data: string };

const cancelPromiseMachine = createMachine<CancelPromiseEvent>({
  id: "cancelPromise",
  predictableActionArguments: true,
  schema: {
    events: {} as CancelPromiseEvent,
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
        id: "load",
        src: "load",
        onDone: "success",
      },
      on: {
        CANCEL: "idle",
      },
    },
    success: {},
  },
});

class CancelPromiseState extends MobXStateMachine<
  CancelPromiseState,
  CancelPromiseEvent
> {
  public resolveLoad: ((value: string) => void) | undefined;

  constructor() {
    super(cancelPromiseMachine, {
      stopped: true,
      deferStart: false,
      strict: true,
    });
  }

  public load(): Promise<string> {
    return new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }
}

type ThrowingActionEvent = { type: "GO" } | { type: "AFTER" };

const throwingActionMachine = createMachine<ThrowingActionEvent>({
  id: "throwingAction",
  predictableActionArguments: true,
  schema: {
    events: {} as ThrowingActionEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        GO: {
          actions: "explode",
        },
        AFTER: "done",
      },
    },
    done: {},
  },
});

class ThrowingActionState extends MobXStateMachine<
  ThrowingActionState,
  ThrowingActionEvent
> {
  constructor() {
    super(throwingActionMachine, { deferStart: false });
  }

  public explode(): void {
    throw new Error("action failed");
  }
}

type ThrowingGuardEvent = { type: "GO" } | { type: "AFTER" };

const throwingGuardMachine = createMachine<ThrowingGuardEvent>({
  id: "throwingGuard",
  predictableActionArguments: true,
  schema: {
    events: {} as ThrowingGuardEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        GO: {
          target: "done",
          cond: "canGo",
        },
        AFTER: "done",
      },
    },
    done: {},
  },
});

class ThrowingGuardState extends MobXStateMachine<
  ThrowingGuardState,
  ThrowingGuardEvent
> {
  constructor() {
    super(throwingGuardMachine, { deferStart: false });
  }

  public canGo(): boolean {
    throw new Error("guard failed");
  }
}

type CleanupErrorEvent = { type: "STOP" };

const cleanupErrorMachine = createMachine<CleanupErrorEvent>({
  id: "cleanupError",
  predictableActionArguments: true,
  schema: {
    events: {} as CleanupErrorEvent,
  },
  initial: "active",
  states: {
    active: {
      invoke: [
        {
          id: "first",
          src: "first",
        },
        {
          id: "second",
          src: "second",
        },
      ],
      on: {
        STOP: "done",
      },
    },
    done: {},
  },
});

class CleanupErrorState extends MobXStateMachine<
  CleanupErrorState,
  CleanupErrorEvent
> {
  public cleanups: string[] = [];

  constructor() {
    super(cleanupErrorMachine, { deferStart: false, strict: true });
  }

  public first(): () => void {
    return () => {
      this.cleanups.push("first");
      throw new Error("first cleanup failed");
    };
  }

  public second(): () => void {
    return () => {
      this.cleanups.push("second");
      throw new Error("second cleanup failed");
    };
  }
}

type CancelAfterEvent = { type: "START" } | { type: "CANCEL" };

const cancelAfterMachine = createMachine<CancelAfterEvent>({
  id: "cancelAfter",
  predictableActionArguments: true,
  schema: {
    events: {} as CancelAfterEvent,
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
        100: "timeout",
      },
      on: {
        CANCEL: "idle",
      },
    },
    timeout: {},
  },
});

class CancelAfterState extends MobXStateMachine<
  CancelAfterState,
  CancelAfterEvent
> {
  constructor() {
    super(cancelAfterMachine, { deferStart: false });
  }
}

type ParallelDoneEvent = { type: "PROFILE_DONE" } | { type: "BILLING_DONE" };

const parallelDoneMachine = createMachine<ParallelDoneEvent>({
  id: "parallelDone",
  predictableActionArguments: true,
  schema: {
    events: {} as ParallelDoneEvent,
  },
  initial: "work",
  states: {
    work: {
      type: "parallel",
      states: {
        profile: {
          initial: "editing",
          states: {
            editing: {
              on: {
                PROFILE_DONE: "done",
              },
            },
            done: {
              type: "final",
            },
          },
        },
        billing: {
          initial: "editing",
          states: {
            editing: {
              on: {
                BILLING_DONE: "done",
              },
            },
            done: {
              type: "final",
            },
          },
        },
      },
      onDone: {
        target: "complete",
        actions: "recordComplete",
      },
    },
    complete: {},
  },
});

const parallelDoneOptions: MachineOptions<
  ParallelDoneState,
  ParallelDoneEvent
> = {
  actions: {
    recordComplete() {
      this.completed += 1;
    },
  },
};

class ParallelDoneState extends MobXStateMachine<
  ParallelDoneState,
  ParallelDoneEvent
> {
  public completed = 0;

  constructor() {
    super(parallelDoneMachine, parallelDoneOptions, { deferStart: false });
  }
}

class ManualEditorState extends MobXStateMachine<
  ManualEditorState,
  EditorEvent
> {
  public text = "";

  constructor() {
    super(
      editorMachine,
      {
        actions: {
          appendText(event) {
            if (event.type === "TYPE") {
              this.text += event.value;
            }
          },
        },
      },
      { stopped: true, deferStart: false },
    );
  }
}

describe("MobXStateMachine advanced XState behavior", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores nested shallow history states", async () => {
    const editor = new EditorState();

    await editor.ready;
    editor.send({ type: "TYPE", value: "draft" });
    editor.send({ type: "DISABLE" });

    expect(editor.matches("disabled")).toBe(true);

    editor.send({ type: "ENABLE" });

    expect(editor.matches({ editing: "dirty" })).toBe(true);
    expect(editor.text).toBe("draft");
  });

  it("matches nested state values through matchState", async () => {
    const editor = new EditorState();

    await editor.ready;
    editor.send({ type: "TYPE", value: "draft" });

    const result = editor.matchState
      .with({ editing: "dirty" }, () => "dirty")
      .otherwise(() => "other");

    expect(result).toBe("dirty");
  });

  it("distinguishes internal and external self transitions", async () => {
    const machine = new SelfTransitionState();

    await machine.ready;
    machine.send({ type: "PING" });
    machine.send({ type: "RESET" });

    expect(machine.log).toEqual(["entry", "ping", "exit", "entry"]);
  });

  it("runs invoke effects and their cleanup functions", async () => {
    const stream = new StreamState();

    await stream.ready;
    stream.send({ type: "OPEN" });
    stream.sendFromStream?.({ type: "MESSAGE", value: "first" });
    stream.send({ type: "CLOSE" });

    expect(stream.messages).toEqual(["first"]);
    expect(stream.starts).toBe(1);
    expect(stream.stops).toBe(1);
    expect(stream.matches("closed")).toBe(true);
  });

  it("lets invoked child machines receive events sent to the child actor", async () => {
    const channel = new ChannelState();

    await channel.ready;
    channel.send({ type: "OPEN" });
    channel.send({ type: "PING_CHILD" });

    expect(channel.acks).toBe(1);
  });

  it("supports invoked child state machines", async () => {
    const parent = new ParentFlowState();

    await parent.ready;
    parent.send({ type: "START" });
    parent.send({ type: "FINISH_CHILD" });

    expect(parent.matches("complete")).toBe(true);
    expect(parent.completed).toBe(1);
  });

  it("handles promise invoke errors", async () => {
    const failing = new FailingState(new Error("network"));

    await failing.ready;
    failing.send({ type: "START" });
    await flushPromises();

    expect(failing.matches("failure")).toBe(true);
    expect(failing.error).toBe("network");
  });

  it("routes synchronous store effect errors through onError", async () => {
    const failing = new StoreSyncEffectState();

    await failing.ready;

    expect(() => failing.send({ type: "START" })).not.toThrow();
    expect(failing.matches("failure")).toBe(true);
    expect(failing.error).toBe("store failed");
  });

  it("routes synchronous MachineOptions.effects errors through onError", async () => {
    const failing = new OptionsSyncEffectState();

    await failing.ready;

    expect(() => failing.send({ type: "START" })).not.toThrow();
    expect(failing.matches("failure")).toBe(true);
    expect(failing.error).toBe("options failed");
  });

  it("throws strict errors for invalid effect return values", async () => {
    const machine = new InvalidEffectReturnState();

    await expect(machine.startMachine()).rejects.toThrow(
      'Invalid effect return value from "load"',
    );
  });

  it("ignores promise resolutions after the invoking state exits", async () => {
    const machine = new CancelPromiseState();

    await machine.startMachine();
    machine.send({ type: "START" });
    expect(machine.matches("loading")).toBe(true);

    machine.send({ type: "CANCEL" });
    machine.resolveLoad?.("late");
    await flushPromises();

    expect(machine.matches("idle")).toBe(true);
  });

  it("treats action errors as fatal runtime errors", async () => {
    const machine = new ThrowingActionState();

    await machine.ready;

    expect(() => machine.send({ type: "GO" })).toThrow("action failed");

    machine.send({ type: "AFTER" });

    expect(machine.matches("idle")).toBe(true);
  });

  it("treats guard errors as fatal runtime errors", async () => {
    const machine = new ThrowingGuardState();

    await machine.ready;

    expect(() => machine.send({ type: "GO" })).toThrow("guard failed");

    machine.send({ type: "AFTER" });

    expect(machine.matches("idle")).toBe(true);
  });

  it("aggregates cleanup errors and still runs every cleanup", async () => {
    const machine = new CleanupErrorState();
    let thrown: unknown;

    await machine.ready;

    try {
      machine.send({ type: "STOP" });
    } catch (error) {
      thrown = error;
    }

    if (!(thrown instanceof MachineCleanupError)) {
      throw new Error("Expected cleanup aggregation error.");
    }

    expect(machine.cleanups).toEqual(["first", "second"]);
    expect(thrown.errors).toHaveLength(2);
  });

  it("aggregates cleanup and disposer errors on stopMachine", async () => {
    const machine = new CleanupErrorState();
    let thrown: unknown;

    await machine.ready;
    machine.addDisposer(() => {
      machine.cleanups.push("disposer");
      throw new Error("disposer failed");
    });

    try {
      machine.stopMachine();
    } catch (error) {
      thrown = error;
    }

    if (!(thrown instanceof MachineCleanupError)) {
      throw new Error("Expected cleanup aggregation error.");
    }

    expect(machine.cleanups).toEqual(["first", "second", "disposer"]);
    expect(thrown.errors).toHaveLength(3);
  });

  it("cancels delayed transitions when the source state exits", async () => {
    vi.useFakeTimers();
    const machine = new CancelAfterState();

    await machine.ready;
    machine.send({ type: "START" });
    machine.send({ type: "CANCEL" });
    vi.advanceTimersByTime(100);

    expect(machine.matches("idle")).toBe(true);
  });

  it("waits for all parallel final child states before onDone", async () => {
    const machine = new ParallelDoneState();

    await machine.ready;
    machine.send({ type: "PROFILE_DONE" });

    expect(machine.matches("work")).toBe(true);
    expect(machine.completed).toBe(0);

    machine.send({ type: "BILLING_DONE" });

    expect(machine.matches("complete")).toBe(true);
    expect(machine.completed).toBe(1);
  });

  it("starts manually from a nested state value", async () => {
    const editor = new ManualEditorState();

    await editor.startMachine({ editing: "dirty" });

    expect(editor.matches({ editing: "dirty" })).toBe(true);
  });
});
