
  // This file was automatically generated. Edits will be overwritten

  export interface Typegen0 {
        '@@xstate/typegen': true;
        internalEvents: {
          "": { type: "" };
"done.invoke.startGameMachine.gameFlow.prepare.playerCreation:invocation[0]": { type: "done.invoke.startGameMachine.gameFlow.prepare.playerCreation:invocation[0]"; data: unknown; __tip: "See the XState TS docs to learn how to strongly type this." };
"error.platform.startGameMachine.gameFlow.prepare.playerCreation:invocation[0]": { type: "error.platform.startGameMachine.gameFlow.prepare.playerCreation:invocation[0]"; data: unknown };
"xstate.after(10)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.startAnimation": { type: "xstate.after(10)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.startAnimation" };
"xstate.after(100)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.startAnimation": { type: "xstate.after(100)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.startAnimation" };
"xstate.after(100)#startGameMachine.gameFlow.init": { type: "xstate.after(100)#startGameMachine.gameFlow.init" };
"xstate.after(1000)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.moveCardToTable": { type: "xstate.after(1000)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.moveCardToTable" };
"xstate.after(300)#startGameMachine.gameFlow.surrender": { type: "xstate.after(300)#startGameMachine.gameFlow.surrender" };
"xstate.after(500)#startGameMachine.tutorial.iddle": { type: "xstate.after(500)#startGameMachine.tutorial.iddle" };
"xstate.after(670)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.moveCardToTable": { type: "xstate.after(670)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.moveCardToTable" };
"xstate.init": { type: "xstate.init" };
"xstate.stop": { type: "xstate.stop" };
        };
        invokeSrcNameMap: {
          "createPlayerName": "done.invoke.startGameMachine.gameFlow.prepare.playerCreation:invocation[0]";
        };
        missingImplementations: {
          actions: "actualizeAchievements" | "arrowAnimation" | "cardMoveAnimation" | "checkAutorization" | "clearGameId" | "createFriendlyGame" | "getAchievementsUpdates" | "getOpponentCard" | "goToCleanCardGamePage" | "goToTavern" | "leaveTheTable" | "nextData" | "opponentTurnStart" | "opponentTurningNotification" | "playWithGameId" | "playerTurningNotification" | "reconnect" | "resetData" | "searchGame" | "selectCard" | "setActiveCardStartPosition" | "setErrorMessage" | "setInviteKey" | "setNoFirstEnter" | "setPayerName" | "setUserParamsToStore" | "sitAtMoneyTable" | "skip" | "startCardAnimation" | "startCardDestroyAnimation" | "stopGameLoop" | "stopWebsocket" | "surrender" | "throwCard" | "turnWithCard";
          delays: never;
          guards: "isFirstEnter" | "withGameId" | "withUserName";
          services: "createPlayerName";
        };
        eventsCausingActions: {
          "actualizeAchievements": "START";
"arrowAnimation": "" | "LEAVE_THE_GAME" | "ON_ERROR" | "done.state.startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation" | "done.state.startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation" | "xstate.stop";
"cardMoveAnimation": "xstate.after(10)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.startAnimation" | "xstate.after(100)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.startAnimation";
"checkAutorization": "ON_ERROR";
"clearGameId": "INVITE_CLAIMED";
"createFriendlyGame": "CREATE_LINK";
"getAchievementsUpdates": "DRAW" | "LOSE" | "WIN";
"getOpponentCard": "OPPONENT_TURN";
"goToCleanCardGamePage": "BACK_TO_JASTOR" | "CLOSE";
"goToTavern": "LEAVE_THE_GAME" | "xstate.after(300)#startGameMachine.gameFlow.surrender";
"leaveTheTable": "BACK_TO_JASTOR" | "CLOSE" | "LEAVE_THE_GAME" | "xstate.after(300)#startGameMachine.gameFlow.surrender";
"nextData": "" | "OPPONENT_QUEUE" | "PLAYER_QUEUE" | "xstate.after(1000)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.moveCardToTable" | "xstate.after(670)#startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.moveCardToTable";
"opponentTurnStart": "";
"opponentTurningNotification": "OPPONENT_QUEUE";
"playWithGameId": "";
"playerTurningNotification": "PLAYER_QUEUE";
"reconnect": "xstate.after(100)#startGameMachine.gameFlow.init";
"resetData": "BACK_TO_JASTOR" | "CLOSE" | "LEAVE_THE_GAME" | "xstate.after(300)#startGameMachine.gameFlow.surrender";
"searchGame": "SEARCH";
"selectCard": "OPPONENT_TURN" | "PLAYER_THROW" | "PLAYER_TURN";
"setActiveCardStartPosition": "PLAYER_THROW" | "PLAYER_TURN" | "SET_CARD_POSITION";
"setErrorMessage": "PLAYER_NAME_CREATION_ERROR";
"setInviteKey": "FRIENDLY_GAME_CREATED";
"setNoFirstEnter": "CLOSE_RULES";
"setPayerName": "CREATE_PLAYER";
"setUserParamsToStore": "PLAYER_NAME_CREATED_SUCCESSFULLY";
"sitAtMoneyTable": "SELECT_TABLE";
"skip": "SKIP";
"startCardAnimation": "";
"startCardDestroyAnimation": "" | "LEAVE_THE_GAME" | "ON_ERROR" | "done.state.startGameMachine.gameFlow.game.turningFlow.playerFlow.playerTurnAnimation" | "xstate.after(1000)#startGameMachine.gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.moveCardToTable" | "xstate.stop";
"stopGameLoop": "BACK_TO_JASTOR" | "CLOSE" | "LEAVE_THE_GAME" | "xstate.after(300)#startGameMachine.gameFlow.surrender";
"stopWebsocket": "BACK_TO_JASTOR" | "CANCEL" | "CLOSE" | "INVITE_CLAIMED" | "LEAVE_THE_GAME" | "NO_ACTIVITY_FOUND" | "ON_THROW_CLOSE" | "xstate.after(300)#startGameMachine.gameFlow.surrender";
"surrender": "FINISH";
"throwCard": "PLAYER_THROW";
"turnWithCard": "PLAYER_TURN";
        };
        eventsCausingDelays: {
          
        };
        eventsCausingGuards: {
          "isFirstEnter": "xstate.after(500)#startGameMachine.tutorial.iddle";
"withGameId": "";
"withUserName": "";
        };
        eventsCausingServices: {
          "createPlayerName": "CREATE_PLAYER";
        };
        matchesStates: "gameFlow" | "gameFlow.exitFromGame" | "gameFlow.game" | "gameFlow.game.gameExit" | "gameFlow.game.gameExit.gameExitPopup" | "gameFlow.game.gameExit.iddle" | "gameFlow.game.gameProcess" | "gameFlow.game.gameProcess.iddle" | "gameFlow.game.gameProcess.showGameResult" | "gameFlow.game.gameProcess.showGameResult.drawMessage" | "gameFlow.game.gameProcess.showGameResult.loseMessage" | "gameFlow.game.gameProcess.showGameResult.winMessage" | "gameFlow.game.turningFlow" | "gameFlow.game.turningFlow.muligan" | "gameFlow.game.turningFlow.muligan.active" | "gameFlow.game.turningFlow.muligan.noActive" | "gameFlow.game.turningFlow.opponentFlow" | "gameFlow.game.turningFlow.opponentFlow.opponentCanTurnOrThrow" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.cardDestroying" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.cardOnTable" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.getCard" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.getNewCard" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.inTimeout" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.moveCardToTable" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.startAnimation" | "gameFlow.game.turningFlow.opponentFlow.opponentTurnAnimation.withdrawalOfResources" | "gameFlow.game.turningFlow.opponentFlow.waitingServer" | "gameFlow.game.turningFlow.playerFlow" | "gameFlow.game.turningFlow.playerFlow.playerCanTurnOrThrow" | "gameFlow.game.turningFlow.playerFlow.playerThrowOnly" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.cardDestroying" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.cardOnTable" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.getNewCard" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.inTimeout" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.moveCardToTable" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.startAnimation" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.waitData" | "gameFlow.game.turningFlow.playerFlow.playerTurnAnimation.withdrawalOfResources" | "gameFlow.game.turningFlow.playerFlow.waitingServer" | "gameFlow.init" | "gameFlow.prepare" | "gameFlow.prepare.checkGameId" | "gameFlow.prepare.chooseGameMode" | "gameFlow.prepare.chooseGameMode.copyLink" | "gameFlow.prepare.chooseGameMode.initial" | "gameFlow.prepare.chooseGameMode.searching" | "gameFlow.prepare.chooseGameMode.selectTable" | "gameFlow.prepare.chooseGameMode.spinner" | "gameFlow.prepare.chooseGameMode.transferForm" | "gameFlow.prepare.init" | "gameFlow.prepare.joinWithId" | "gameFlow.prepare.messageAboutRestart" | "gameFlow.prepare.playerCreation" | "gameFlow.prepare.searchingOpponents" | "gameFlow.prepare.startGameForm" | "gameFlow.prepare.triedClaimedInvite" | "gameFlow.restartGame" | "gameFlow.surrender" | "gameFlow.tryReconnect" | "tutorial" | "tutorial.gameRules" | "tutorial.iddle" | "tutorial.showTutor" | { "gameFlow"?: "exitFromGame" | "game" | "init" | "prepare" | "restartGame" | "surrender" | "tryReconnect" | { "game"?: "gameExit" | "gameProcess" | "turningFlow" | { "gameExit"?: "gameExitPopup" | "iddle";
"gameProcess"?: "iddle" | "showGameResult" | { "showGameResult"?: "drawMessage" | "loseMessage" | "winMessage"; };
"turningFlow"?: "muligan" | "opponentFlow" | "playerFlow" | { "muligan"?: "active" | "noActive";
"opponentFlow"?: "opponentCanTurnOrThrow" | "opponentTurnAnimation" | "waitingServer" | { "opponentTurnAnimation"?: "cardDestroying" | "cardOnTable" | "getCard" | "getNewCard" | "inTimeout" | "moveCardToTable" | "startAnimation" | "withdrawalOfResources"; };
"playerFlow"?: "playerCanTurnOrThrow" | "playerThrowOnly" | "playerTurnAnimation" | "waitingServer" | { "playerTurnAnimation"?: "cardDestroying" | "cardOnTable" | "getNewCard" | "inTimeout" | "moveCardToTable" | "startAnimation" | "waitData" | "withdrawalOfResources"; }; }; };
"prepare"?: "checkGameId" | "chooseGameMode" | "init" | "joinWithId" | "messageAboutRestart" | "playerCreation" | "searchingOpponents" | "startGameForm" | "triedClaimedInvite" | { "chooseGameMode"?: "copyLink" | "initial" | "searching" | "selectTable" | "spinner" | "transferForm"; }; };
"tutorial"?: "gameRules" | "iddle" | "showTutor"; };
        tags: never;
      }
  