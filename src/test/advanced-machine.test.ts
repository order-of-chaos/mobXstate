import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MobXStateMachine,
  createMachine,
  sendTo,
  type MachineOptions,
  type Sender,
} from "../BaseMachineState";

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
  services: {
    streamConnection() {
      return (send: Sender<StreamEvent>) => {
        this.starts += 1;
        this.sendFromStream = send;

        return () => {
          this.stops += 1;
        };
      };
    },
  },
};

class StreamState extends MobXStateMachine<StreamState, StreamEvent> {
  public messages: string[] = [];

  public sendFromStream: Sender<StreamEvent> | undefined;

  public starts = 0;

  public stops = 0;

  constructor() {
    super(streamMachine, streamOptions, { deferStart: false });
  }
}

type ChannelEvent =
  | { type: "OPEN" }
  | { type: "PING_CHILD" }
  | { type: "CHILD_ACK" }
  | { type: "CLOSE" };

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
      },
      on: {
        PING_CHILD: {
          actions: sendTo(
            { type: "PING_CHILD" },
            { to: "channelConnection" },
          ),
        },
        CHILD_ACK: {
          actions: "recordAck",
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
  services: {
    channelConnection() {
      return (send, onReceive) => {
        onReceive((event) => {
          if (event.type === "PING_CHILD") {
            send({ type: "CHILD_ACK" });
          }
        });
      };
    },
  },
};

class ChannelState extends MobXStateMachine<ChannelState, ChannelEvent> {
  public acks = 0;

  constructor() {
    super(channelMachine, channelOptions, { deferStart: false });
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
  services: {
    childFlow() {
      return childFlowMachine;
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
  services: {
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

  it("runs callback invokes and their cleanup functions", async () => {
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

  it("lets callback invokes receive events sent to the child actor", async () => {
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
