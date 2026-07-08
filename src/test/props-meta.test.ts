import { autorun } from "mobx";
import { describe, expect, it } from "vitest";

import {
  createMachine,
  MobXStateMachine,
  type MachineActionMeta,
  type MachineStateProps,
} from "../MobXStateMachine";

const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

type QuestEvent = { type: "NEXT" };

const questMachine = createMachine<QuestEvent>({
  id: "quest",
  predictableActionArguments: true,
  schema: {
    events: {} as QuestEvent,
  },
  props: { world: "forest", music: "calm" },
  initial: "greeting",
  states: {
    greeting: {
      props: { dialog: "privet", music: "menu" },
      entry: "recordAction",
      exit: "recordAction",
      on: {
        NEXT: {
          target: "training",
          actions: "recordAction",
        },
      },
    },
    training: {
      props: { script: "learnA" },
      initial: "intro",
      states: {
        intro: {
          props: { dialog: "intro" },
          entry: "recordAction",
          on: {
            NEXT: "practice",
          },
        },
        practice: {
          entry: "recordAction",
          on: {
            NEXT: "end",
          },
        },
        end: {
          type: "final",
        },
      },
      onDone: "finished",
    },
    finished: {
      type: "final",
      entry: "recordAction",
      exit: "recordAction",
    },
  },
});

interface RecordedAction {
  readonly kind: string;
  readonly state: string;
  readonly statePath: string;
  readonly props: MachineStateProps;
  readonly event: string;
}

class QuestState extends MobXStateMachine<QuestState, QuestEvent> {
  public records: RecordedAction[] = [];

  public doneEvents: string[] = [];

  constructor() {
    super(questMachine);
    this.onDone = (event) => {
      this.doneEvents.push(event.type);
    };
  }

  public recordAction(
    event: QuestEvent,
    meta: MachineActionMeta<QuestEvent>,
  ): void {
    this.records.push({
      kind: meta.kind,
      state: meta.state,
      statePath: meta.statePath,
      props: meta.props,
      event: event.type,
    });
  }
}

type ToggleEvent = { type: "TOGGLE" };

const boardMachine = createMachine<ToggleEvent>({
  id: "board",
  predictableActionArguments: true,
  schema: {
    events: {} as ToggleEvent,
  },
  props: { theme: "dark" },
  type: "parallel",
  states: {
    left: {
      props: { column: "left" },
      initial: "a",
      states: {
        a: {
          props: { cell: "left-a" },
        },
      },
    },
    right: {
      props: { column: "right" },
      initial: "b",
      states: {
        b: {},
      },
    },
  },
});

class BoardState extends MobXStateMachine<BoardState, ToggleEvent> {
  constructor() {
    super(boardMachine);
  }
}

type BareEvent = { type: "GO" };

const bareMachine = createMachine<BareEvent>({
  id: "bare",
  predictableActionArguments: true,
  schema: {
    events: {} as BareEvent,
  },
  initial: "idle",
  states: {
    idle: {},
  },
});

class BareState extends MobXStateMachine<BareState, BareEvent> {
  constructor() {
    super(bareMachine);
  }
}

describe("state props", () => {
  it("merges props along the node path with deeper nodes overriding", async () => {
    const machine = new QuestState();
    await flushPromises();

    expect(machine.props).toEqual({
      world: "forest",
      music: "menu",
      dialog: "privet",
    });

    machine.send({ type: "NEXT" });

    expect(machine.state).toEqual({ training: "intro" });
    expect(machine.props).toEqual({
      world: "forest",
      music: "calm",
      script: "learnA",
      dialog: "intro",
    });
  });

  it("inherits parent props for nodes without own props", async () => {
    const machine = new QuestState();
    await flushPromises();

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });

    expect(machine.state).toEqual({ training: "practice" });
    expect(machine.props).toEqual({
      world: "forest",
      music: "calm",
      script: "learnA",
    });
  });

  it("merges props across parallel branches", async () => {
    const machine = new BoardState();
    await flushPromises();

    expect(machine.props).toEqual({
      theme: "dark",
      column: "right",
      cell: "left-a",
    });
  });

  it("returns empty props for machines without props", async () => {
    const machine = new BareState();
    await flushPromises();

    expect(machine.props).toEqual({});
  });

  it("is observable through MobX", async () => {
    const machine = new QuestState();
    await flushPromises();

    const seen: unknown[] = [];
    const dispose = autorun(() => {
      seen.push(machine.props.dialog);
    });

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });

    dispose();

    expect(seen).toEqual(["privet", "intro", undefined]);
  });
});

describe("action meta", () => {
  it("passes state, statePath, props and kind to entry actions", async () => {
    const machine = new QuestState();
    await flushPromises();

    expect(machine.records).toEqual([
      {
        kind: "entry",
        state: "greeting",
        statePath: "greeting",
        props: { world: "forest", music: "menu", dialog: "privet" },
        event: "mobxstate.init",
      },
    ]);
  });

  it("marks exit and transition actions and keeps the source node", async () => {
    const machine = new QuestState();
    await flushPromises();
    machine.records.length = 0;

    machine.send({ type: "NEXT" });

    expect(machine.records).toEqual([
      {
        kind: "exit",
        state: "greeting",
        statePath: "greeting",
        props: { world: "forest", music: "menu", dialog: "privet" },
        event: "NEXT",
      },
      {
        kind: "transition",
        state: "greeting",
        statePath: "greeting",
        props: { world: "forest", music: "menu", dialog: "privet" },
        event: "NEXT",
      },
      {
        kind: "entry",
        state: "intro",
        statePath: "training.intro",
        props: {
          world: "forest",
          music: "calm",
          script: "learnA",
          dialog: "intro",
        },
        event: "NEXT",
      },
    ]);
  });

  it("marks exit actions with kind stop when the machine is stopped", async () => {
    const machine = new QuestState();
    await flushPromises();
    machine.records.length = 0;

    machine.stopMachine();

    expect(machine.records).toEqual([
      {
        kind: "stop",
        state: "greeting",
        statePath: "greeting",
        props: { world: "forest", music: "menu", dialog: "privet" },
        event: "mobxstate.stop",
      },
    ]);
  });
});

describe("root final state", () => {
  it("fires onDone and sets isDone when the machine root reaches a final state", async () => {
    const machine = new QuestState();
    await flushPromises();

    expect(machine.isDone).toBe(false);

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });

    expect(machine.isDone).toBe(false);
    expect(machine.doneEvents).toEqual([]);

    machine.send({ type: "NEXT" });

    expect(machine.state).toBe("finished");
    expect(machine.isDone).toBe(true);
    expect(machine.doneEvents).toEqual(["done.invoke.quest"]);
  });

  it("keeps the machine running after the root final state", async () => {
    const machine = new QuestState();
    await flushPromises();

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });

    expect(machine.isDone).toBe(true);
    // машина не остановлена: stopMachine всё ещё прогоняет exit-экшены
    machine.records.length = 0;
    machine.stopMachine();

    expect(machine.records.map((record) => record.kind)).toEqual(["stop"]);
    expect(machine.records[0]?.state).toBe("finished");
  });

  it("resets isDone on restart", async () => {
    const machine = new QuestState();
    await flushPromises();

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });
    expect(machine.isDone).toBe(true);

    await machine.restart();
    await flushPromises();

    expect(machine.isDone).toBe(false);
    expect(machine.state).toBe("greeting");
  });

  it("fires onDone once per run", async () => {
    const machine = new QuestState();
    await flushPromises();

    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });
    machine.send({ type: "NEXT" });

    machine.send({ type: "NEXT" });

    expect(machine.doneEvents).toEqual(["done.invoke.quest"]);
  });
});
