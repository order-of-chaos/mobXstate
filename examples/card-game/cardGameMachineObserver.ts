import { action, computed, makeObservable, observable } from "mobx";
import { inject, injectable, singleton } from "tsyringe";

import type { ICardGameStore } from "~/widgets/card-game";

import type {
  LogicResultType,
  IAchievementsStore
} from "~/features/achievements";
import type { EmoticonType } from "~/features/reactions";

import { type IAccountStore } from "~/entities/Account";
import { type IConnectionQualityStore } from "~/entities/ConnectionQuality";
import { type IRouterStore } from "~/entities/Router";

import {
  MobXStateMachine,
  type IMachineState,
} from "mobxstate";
import type { IStorageStore } from "~/shared/lib/Storage";
import { globalCounter } from "~/shared/utils";
import { logger } from "~/shared/utils/logger.ts";
import { Queue } from "~/shared/utils/Queue.ts";

import { CardGameServiceWS } from "../api";
import type { NormalizedResult } from "../matchers";
import { normalizeCardServiceResponse } from "../matchers";
import { gameLoop } from "../stores/CardGameLoop.ts";
import type {
  CardGameMachineEvent,
  CardServiceResponseType,
  GameType,
  MeType,
  OpponentType
} from "../types";

import { cardGameMachine } from "./cardGameMachine.ts";
import { cardGameMachineFunctions } from "./cardGameMachineFunctions.ts";
import type { Typegen0 } from "./cardGameMachine.typegen";

export type ICardGameMachineObserver = IMachineState<
  CardGameMachineObserver,
  CardGameMachineEvent,
  Typegen0
> & {
  websocket: CardGameServiceWS | null;
  dataQueue: Queue<NormalizedResult>;

  closeWebsocket: () => void;
  navigate: (url: string) => void;
  createWebsocket: (url: string) => void;
  sendEmoticon: (emoticon: EmoticonType) => void;

  achievementsUpdates: LogicResultType[];
};

@singleton()
@injectable()
export class CardGameMachineObserver
  extends MobXStateMachine<
    CardGameMachineObserver,
    CardGameMachineEvent,
    Typegen0
  >
  implements ICardGameMachineObserver {
  public websocket: CardGameServiceWS | null = null;

  public dataQueue: Queue<NormalizedResult> = new Queue();

  constructor(
    @inject("ICardGameStore")
    public cardGameStore: ICardGameStore,
    @inject("IAccountStore") public account: IAccountStore,
    @inject("IRouterStore") private routerStore: IRouterStore,
    @inject("IAchievementsStore") private achievementsStore: IAchievementsStore,
    @inject("IConnectionQualityStore")
    private connectionQualityStore: IConnectionQualityStore,
    @inject("IStorageStore") public storageStore: IStorageStore
  ) {
    super(cardGameMachine, cardGameMachineFunctions);
    makeObservable(this);
  }

  closeWebsocket = () => {
    this.websocket?.close();
  };

  public navigate(url: string) {
    this.routerStore.navigate(url);
  }

  public override onStop = () => {
    gameLoop.stopGame();
    this.closeWebsocket();
  };

  private latencyUpdate = (latency: number) => {
    this.connectionQualityStore.setLatency(latency);
  };

  public createWebsocket = (url: string) => {
    if (this.websocket) {
      this.websocket.close();
    }
    this.websocket = new CardGameServiceWS(
      url,
      {
        onMessage: this.handleMessage,
        onOpen: this.handleOpen,
        onClose: this.handleClose,
        onError: this.handleError,
        onLatencyUpdate: this.latencyUpdate,
        getReconnectUrl: () => `/ws/reconnect?request-id=${globalCounter()}`
      },
      this.serverIsNotResponding
    );
  };

  private serverIsNotResponding = () => {
    this.send("NOT_RESPONDING");
  };

  private handleMessage = (data: CardServiceResponseType) => {
    if ("error" in data) {
      if (data.error.code == 301) {
        this.send({ type: "NO_ACTIVITY_FOUND" });
      } else if (data.error.code == 305) {
        this.send({ type: "INVITE_CLAIMED" });
      } else if (data.error.code == 307) {
        this.send({ type: "SERVER_RESTART" });
      } else {
        logger.error(data);
        this.send({ type: "ON_THROW_ERROR" });
      }
    } else {
      if ("result" in data) {
        const index = data.result.findIndex((item) => item.type === "Invite");
        if (index >= 0) {
          const result = data.result[index];
          if (result.type == "Invite") {
            this.send({
              type: "FRIENDLY_GAME_CREATED",
              payload: { invite: result.id }
            });
          }
        }
      }
      normalizeCardServiceResponse(data, (result) => {
        this.dataQueue.enqueue(result);
      });
      this.getNextData();
    }
  };

  public getNextData() {
    const result = this.dataQueue.dequeue();
    if (!result) {
      return;
    }
    this.changePoints(result.me, result.opponent);
    this.cardGameStore.updateData({
      me: result.me,
      opponent: result.opponent,
      game: result.game
    });
    this.resetGameTime(result.game);
    this.changeMeStatus(result.me);
    this.changeOpponentStatus(result.opponent);
    this.send("DATA_RECEIVED");
    return result;
  }

  private handleOpen = () => {
    this.send({ type: "ON_OPEN" });
  };

  private getAllData = () => {
    if (this.getNextData()) {
      this.getAllData();
    }
  };

  private handleClose = () => {
    this.getAllData();
    this.send({ type: "ON_CLOSE" });
  };

  private handleError = (event?: ErrorEvent): void => {
    logger.error("handleError", event);
    this.send({ type: "ON_ERROR" });
  };

  private changePoints = (
    me?: Partial<MeType>,
    opponent?: Partial<OpponentType>
  ) => {
    const { me: oldMe, opponent: oldOpponent } = this.cardGameStore;
    const isPointsChanged = (
      points: number | undefined,
      oldPoints: number | undefined
    ): boolean => {
      return points !== undefined && points !== oldPoints;
    };
    const isDamage = (
      points: number | undefined,
      oldPoints: number | undefined
    ): boolean => {
      return points !== undefined && points < (oldPoints || 0);
    };
    const checkPoints = (
      points: number | undefined,
      oldPoints: number | undefined
    ) => ({
      arrow: isPointsChanged(points, oldPoints),
      damage: isDamage(points, oldPoints)
    });
    const mePoints = {
      tower: checkPoints(me?.towerPoints, oldMe?.towerPoints),
      wall: checkPoints(me?.wallPoints, oldMe?.wallPoints)
    };
    const opponentPoints = {
      tower: checkPoints(opponent?.towerPoints, oldOpponent?.towerPoints),
      wall: checkPoints(opponent?.wallPoints, oldOpponent?.wallPoints)
    };

    this.cardGameStore.setArrowSide({
      toMe: mePoints.tower.arrow || mePoints.wall.arrow,
      damageToMe: mePoints.tower.damage || mePoints.wall.damage,
      toOpponent: opponentPoints.tower.arrow || opponentPoints.wall.arrow,
      damageToOpponent:
        opponentPoints.tower.damage || opponentPoints.wall.damage
    });
  };

  private resetGameTime = (game?: Partial<GameType>) => {
    if (game?.start) {
      if (!gameLoop.isGameRun()) {
        gameLoop.setGameStart(game.start);
        this.send({ type: "START" });
      }
    }
  };

  private changeMeStatus = (me?: Partial<MeType>) => {
    if (!me) {
      return;
    }
    switch (me.status) {
      case "Win": {
        this.send({ type: "WIN" });
        // this.send({ type: "ON_CLOSE" });
        break;
      }
      case "Lose": {
        this.send({ type: "LOSE" });
        // this.send({ type: "ON_CLOSE" });
        break;
      }
      case "InDraw": {
        this.send({ type: "DRAW" });
        // this.send({ type: "ON_CLOSE" });
        break;
      }
      case "Turning": {
        this.send({ type: "PLAYER_QUEUE" });
        break;
      }
      case "Throwing": {
        this.send({ type: "PLAYER_QUEUE_TO_THROWING" });
        break;
      }
      case "InMulligan": {
        this.send({ type: "START_MULIGAN" });
        break;
      }
    }
  };

  private changeOpponentStatus = (opponent?: Partial<OpponentType>) => {
    if (!opponent) {
      return;
    }
    switch (opponent.status) {
      case "Turning":
      case "Throwing": {
        this.send({ type: "OPPONENT_QUEUE" });
        break;
      }
    }
    if (opponent.lastPickedCard != null) {
      this.send({
        type: "OPPONENT_TURN",
        payload: {
          lastPickedCard: opponent.lastPickedCard,
          lastPickedPosition: opponent.lastPickedPosition || null
        }
      });
    }
  };

  @observable
  public achievementsUpdates: LogicResultType[] = [];

  @action
  public getAchievementsUpdates = () => {
    this.achievementsUpdates = [];
    this.achievementsStore.getData((updates) => {
      this.achievementsUpdates = updates;
    });
  };

  @action
  public actualizeAchievements = () => {
    this.achievementsStore.getData();
  };

  public sendEmoticon = (emoticon: EmoticonType) => {
    this.websocket?.sendEmoticon(emoticon);
  };

  @computed
  public get isFirstEnter() {
    return !this.storageStore.getObservableAccountData("noFirstCartGame");
  }
}
