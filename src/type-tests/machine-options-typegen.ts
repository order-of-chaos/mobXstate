import type { MachineOptions } from "../MobXStateMachine";

type TableEvent =
  | { type: "SELECT_TABLE"; payload: { bet: number } }
  | { type: "PLAYER_TURN"; payload: { cardId: string } }
  | { type: "LOAD_USER"; payload: { userId: string } };

interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: Record<string, never>;
  invokeSrcNameMap: Record<string, never>;
  missingImplementations: {
    actions: "sitAtMoneyTable" | "turnWithCard";
    delays: never;
    guards: never;
  };
  eventsCausingActions: {
    sitAtMoneyTable: "SELECT_TABLE";
    turnWithCard: "PLAYER_TURN";
  };
  eventsCausingDelays: Record<string, never>;
  eventsCausingGuards: Record<string, never>;
  eventsCausingServices: {
    loadUser: "LOAD_USER";
  };
  matchesStates: "idle";
  tags: never;
}

class TableStore {
  public bet = 0;
  public cardId = "";
  public userId = "";
}

export const typegenAwareOptions: MachineOptions<
  TableStore,
  TableEvent,
  Typegen0
> = {
  actions: {
    sitAtMoneyTable(event) {
      this.bet = event.payload.bet;

      // @ts-expect-error SELECT_TABLE cannot read PLAYER_TURN payload.
      this.cardId = event.payload.cardId;
    },
    turnWithCard(event) {
      this.cardId = event.payload.cardId;

      // @ts-expect-error PLAYER_TURN cannot read SELECT_TABLE payload.
      this.bet = event.payload.bet;
    },
  },
  effects: {
    loadUser(event) {
      this.userId = event.payload.userId;

      // @ts-expect-error LOAD_USER cannot read SELECT_TABLE payload.
      this.bet = event.payload.bet;
    },
  },
};
