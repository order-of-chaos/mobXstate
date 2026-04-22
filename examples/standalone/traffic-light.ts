import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
} from "mobxstate";

type TrafficLightEvent =
  | { type: "TIMER" }
  | { type: "POWER_OUTAGE" }
  | { type: "RESET" };

export const trafficLightMachine = createMachine<TrafficLightEvent>({
  id: "trafficLight",
  predictableActionArguments: true,
  schema: {
    events: {} as TrafficLightEvent,
  },
  initial: "green",
  states: {
    green: {
      entry: "recordGreen",
      after: {
        GREEN_DELAY: "yellow",
      },
      on: {
        POWER_OUTAGE: "off",
      },
    },
    yellow: {
      after: {
        YELLOW_DELAY: "red",
      },
    },
    red: {
      after: {
        RED_DELAY: "green",
      },
    },
    off: {
      on: {
        RESET: "green",
      },
    },
  },
});

export class TrafficLightStore extends MobXStateMachine<
  TrafficLightStore,
  TrafficLightEvent
> {
  public greenEntries = 0;

  public greenDelay = 1000;

  public YELLOW_DELAY = 500;

  public RED_DELAY = 1000;

  constructor() {
    super(trafficLightMachine);

    makeObservable(this, {
      greenDelay: observable,
      greenEntries: observable,
    });
  }

  public get GREEN_DELAY(): number {
    return this.greenDelay;
  }

  public recordGreen(): void {
    this.greenEntries += 1;
  }
}
