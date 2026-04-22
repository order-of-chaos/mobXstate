import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
} from "mobxstate";

type LiveStreamEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "DATA"; value: string };

export const liveStreamMachine = createMachine<LiveStreamEvent>({
  id: "liveStream",
  predictableActionArguments: true,
  schema: {
    events: {} as LiveStreamEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        CONNECT: "connected",
      },
    },
    connected: {
      invoke: "stream",
      on: {
        DATA: {
          actions: "recordData",
        },
        DISCONNECT: "idle",
      },
    },
  },
});

export class LiveStreamStore extends MobXStateMachine<
  LiveStreamStore,
  LiveStreamEvent
> {
  public connections = 0;

  public disconnections = 0;

  public messages: string[] = [];

  public pushFromStream: ((value: string) => void) | undefined;

  constructor() {
    super(liveStreamMachine);

    makeObservable(this, {
      connections: observable,
      disconnections: observable,
      messages: observable,
    });
  }

  public recordData(event: LiveStreamEvent): void {
    if (event.type === "DATA") {
      this.messages.push(event.value);
    }
  }

  public stream(): () => void {
    this.connections += 1;
    this.pushFromStream = (value) => {
      this.send({ type: "DATA", value });
    };

    return () => {
      this.disconnections += 1;
      this.pushFromStream = undefined;
    };
  }
}
