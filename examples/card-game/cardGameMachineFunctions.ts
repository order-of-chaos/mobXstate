import { ROUTES } from "~/shared/constants/routes.ts";
import type { MachineOptions, Sender } from "mobxstate";
import { globalCounter, isOneOfList } from "~/shared/utils";
import { logger } from "~/shared/utils/logger.ts";

import { cardGameServiceREST } from "../api";
import { sendUIAction } from "../events/UIActions.ts";
import { gameLoop } from "../stores/CardGameLoop.ts";
import type { CardGameMachineEvent } from "../types";

import type { Typegen0 } from "./cardGameMachine.typegen";
import type { CardGameMachineObserver } from "./cardGameMachineObserver.ts";

export const cardGameMachineFunctions: MachineOptions<
  CardGameMachineObserver,
  CardGameMachineEvent,
  Typegen0
> = {
  services: {
    createPlayerName() {
      return (send: Sender<CardGameMachineEvent>) => {
        return cardGameServiceREST
          .setName(this.account.name)
          .then(({ result }) => {
            send({
              type: "PLAYER_NAME_CREATED_SUCCESSFULLY",
              payload: result[0],
            });
          })
          .catch((event) => {
            send({
              type: "PLAYER_NAME_CREATION_ERROR",
              payload: { message: event?.error?.message || "" },
            });
          });
      };
    },
  },
  actions: {
    playWithGameId() {
      this.createWebsocket(
        `/ws/join/${
          this.cardGameStore.gameId
        }?request-id=${globalCounter()}`,
      );
    },
    createFriendlyGame() {
      this.createWebsocket(`/ws/invite?request-id=${globalCounter()}`);
    },
    searchGame() {
      this.createWebsocket(`/ws/search?request-id=${globalCounter()}`);
    },
    reconnect() {
      this.createWebsocket(`/ws/reconnect?request-id=${globalCounter()}`);
    },
    sitAtMoneyTable(event) {
      this.createWebsocket(
        `/ws/sit-at-money-table?request-id=${globalCounter()}&bet=${event.payload.bet}&currency=Rusk`,
      );
    },
    resetData() {
      this.cardGameStore.resetData();
    },
    stopGameLoop() {
      gameLoop.stopGame();
    },

    playerTurningNotification() {
      this.cardGameStore.setIsOpponentTurn(false);
    },

    opponentTurningNotification() {
      this.cardGameStore.setIsOpponentTurn(true);
    },

    turnWithCard(event) {
      this.websocket?.turn(event.payload.card.id);
    },

    throwCard(event) {
      this.websocket?.throwCard(event.payload.card.id);
    },

    selectCard(event) {
      switch (event.type) {
        case "PLAYER_TURN":
        case "PLAYER_THROW": {
          this.cardGameStore.setActiveCard(event.payload.card);
          break;
        }
        case "OPPONENT_TURN": {
          this.cardGameStore.setActiveCard(event.payload.lastPickedCard);
          break;
        }
      }
    },

    setActiveCardStartPosition(event) {
      switch (event.type) {
        case "PLAYER_THROW":
        case "PLAYER_TURN":
        case "SET_CARD_POSITION": {
          this.cardGameStore.setActiveCardStartPosition(
            event.payload.cardStartPosition,
          );
          break;
        }
      }
    },

    setPayerName(event) {
      this.cardGameStore.setUserName(event.payload.userName);
    },

    arrowAnimation() {
      sendUIAction("arrowAnimation", null);
    },
    opponentTurnStart() {
      if (
        this.cardGameStore.opponent?.lastPickedCard &&
        this.cardGameStore.opponent?.lastPickedPosition !== null
      ) {
        sendUIAction("opponentTurn", {
          lastPickedCard: this.cardGameStore.opponent?.lastPickedCard,
          lastPickedPosition:
            this.cardGameStore.opponent?.lastPickedPosition,
        });
      } else {
        logger.error("no the corrent opponent data");
      }
    },
    startCardAnimation() {
      if (
        this.cardGameStore.activeCard !== null &&
        this.cardGameStore.activeCardStartPosition !== null
      ) {
        sendUIAction("startCardMoveAnimation", {
          activeCardStartPosition:
            this.cardGameStore.activeCardStartPosition,
          activeCard: this.cardGameStore.activeCard,
          cardsOnTable: this.cardGameStore.game?.cardsOnTable || [],
          discarded:
            this.cardGameStore.me?.lastPickedCard?.discarded ||
            this.cardGameStore.opponent?.lastPickedCard?.discarded ||
            false,
          turnAgain:
            isOneOfList(this.cardGameStore.me?.statusReason, [
              "IsWaitingToPlayCardAgainAfterHePlaysCard",
              "IsWaitingToPlayCardAgainAfterHeThrowsCard",
            ]) ||
            isOneOfList(this.cardGameStore.opponent?.statusReason, [
              "OpponentTurnAgainAfterHisTurn",
              "OpponentTurnAgainAfterHisThrow",
            ]),
        });
      } else {
        logger.error("no activeCard");
      }
    },
    cardMoveAnimation() {
      sendUIAction("cardMoveAnimation", null);
    },
    startCardDestroyAnimation() {
      sendUIAction("cardDestroyAnimation", null);
    },
    skip() {
      this.websocket?.skip();
    },
    surrender() {
      this.websocket?.surrender();
    },
    getOpponentCard() {
      if (
        this.cardGameStore.opponent &&
        this.cardGameStore.opponent.lastPickedPosition !== null
      ) {
        sendUIAction("getOpponentCard", {
          lastPickedPosition:
            this.cardGameStore.opponent?.lastPickedPosition,
        });
      }
    },
    setInviteKey(event) {
      this.cardGameStore.setInviteLink(event.payload.invite);
    },
    stopWebsocket() {
      this.closeWebsocket();
    },
    setUserParamsToStore(event) {
      if (event.payload.name) {
        this.cardGameStore.setUserName(event.payload.name);
      }
    },
    goToCleanCardGamePage() {
      this.navigate(ROUTES.CARD_GAME);
    },
    goToTavern() {
      this.navigate(ROUTES.TAVERN);
    },
    checkAutorization() {
      this.account.setIsAuthorized(false);
    },
    nextData() {
      this.getNextData();
    },
    setErrorMessage(event) {
      this.account.setNameError(event.payload.message);
    },
    clearGameId() {
      this.navigate(ROUTES.CARD_GAME);
    },
    setNoFirstEnter() {
      this.storageStore.setAccountData("noFirstCartGame", true);
    },
    getAchievementsUpdates() {
      this.getAchievementsUpdates();
    },
    leaveTheTable() {
      this.websocket?.leaveTheTable();
    },
    actualizeAchievements() {
      this.actualizeAchievements();
    },
  },
  guards: {
    withUserName(): boolean {
      return Boolean(this.account.name);
    },
    withGameId(): boolean {
      return Boolean(this.cardGameStore.gameId);
    },
    isFirstEnter(): boolean {
      return this.isFirstEnter;
    },
  },
};
