import {
  createMachine,
  type IMachineState,
  type MachineSendEvent,
  MobXStateMachine,
  type PayloadlessEventType,
} from "../MobXStateMachine";

type SendTypeEvent =
  | { type: "RESET" }
  | { type: "INC"; by: number }
  | { type: "OPTIONAL"; value?: string };

const sendTypeMachine = createMachine<SendTypeEvent>({
  id: "sendTypes",
  predictableActionArguments: true,
  schema: {
    events: {} as SendTypeEvent,
  },
  initial: "idle",
  states: {
    idle: {},
  },
});

export class SendTypeStore extends MobXStateMachine<
  SendTypeStore,
  SendTypeEvent
> {
  constructor() {
    super(sendTypeMachine, { stopped: true });
  }

  public checkSendTypes(): void {
    this.send("RESET");
    this.send("OPTIONAL");
    this.send({ type: "INC", by: 1 });
    this.send({ type: "OPTIONAL", value: "ok" });

    // @ts-expect-error INC requires payload.
    this.send("INC");

    // @ts-expect-error UNKNOWN is not part of the event union.
    this.send("UNKNOWN");

    // @ts-expect-error INC object events require the by field.
    this.send({ type: "INC" });
  }
}

export const typedSendFunction = (
  event: MachineSendEvent<SendTypeEvent>,
): void => {
  void event;
};

typedSendFunction("RESET");
typedSendFunction("OPTIONAL");
typedSendFunction({ type: "INC", by: 1 });

// @ts-expect-error INC requires payload.
typedSendFunction("INC");

export const typedMachineState: IMachineState<
  SendTypeStore,
  SendTypeEvent
> = new SendTypeStore();

typedMachineState.send("RESET");
typedMachineState.send({ type: "INC", by: 1 });

// @ts-expect-error INC requires payload.
typedMachineState.send("INC");

export const payloadlessType: PayloadlessEventType<SendTypeEvent> = "RESET";

// @ts-expect-error INC is not payloadless.
export const payloadEventType: PayloadlessEventType<SendTypeEvent> = "INC";
