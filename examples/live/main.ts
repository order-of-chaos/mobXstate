import { autorun, makeObservable, observable } from "mobx";
import { createTranslator } from "@orderofchaos/ling";

import {
  MobXStateMachine,
  createMachine,
} from "../../src";

import {
  isPageLanguage,
  languageLabels,
  languageStorage,
  liveNamespace,
  supportedLanguages,
  translations,
  type PageLanguage,
} from "./i18n";

import "./styles.css";

const storedLanguage = languageStorage.getLanguage();
let currentLanguage: PageLanguage = isPageLanguage(storedLanguage)
  ? storedLanguage
  : "en";

const t = createTranslator({
  translations,
  namespace: liveNamespace,
  getLanguage: () => currentLanguage,
});

type CatEvent =
  | { type: "WAKE" }
  | { type: "REFILL" }
  | { type: "FEED" }
  | { type: "PLAY" }
  | { type: "GROOM" }
  | { type: "VET" }
  | { type: "BACK_HOME" };

const catMachine = createMachine<CatEvent>({
  id: "catRoutine",
  predictableActionArguments: true,
  schema: {
    events: {} as CatEvent,
  },
  initial: "sleeping",
  states: {
    sleeping: {
      entry: "recordNap",
      on: {
        WAKE: "hungry",
        REFILL: {
          actions: "refillFood",
        },
      },
    },
    hungry: {
      on: {
        REFILL: {
          actions: "refillFood",
        },
        FEED: {
          target: "eating",
          cond: "hasFood",
          actions: "startMeal",
        },
      },
    },
    eating: {
      after: {
        MEAL_DELAY: {
          target: "playful",
          actions: "finishMeal",
        },
      },
    },
    playful: {
      on: {
        PLAY: {
          target: "playing",
          actions: "startPlay",
        },
        GROOM: "grooming",
        VET: "vetVisit",
      },
    },
    playing: {
      after: {
        PLAY_DELAY: {
          target: "sleeping",
          actions: "finishPlay",
        },
      },
    },
    grooming: {
      after: {
        GROOM_DELAY: {
          target: "sleeping",
          actions: "finishGroom",
        },
      },
    },
    vetVisit: {
      entry: "recordVetVisit",
      on: {
        BACK_HOME: "sleeping",
      },
    },
  },
});

class CatStore extends MobXStateMachine<CatStore, CatEvent> {
  public foodPortions = 1;

  public grooms = 0;

  public lastNote = "Sleeping";

  public mealMs = 1200;

  public PLAY_DELAY = 1600;

  public GROOM_DELAY = 1200;

  public meals = 0;

  public naps = 0;

  public playSessions = 0;

  public vetVisits = 0;

  constructor() {
    super(catMachine);

    makeObservable(this, {
      foodPortions: observable,
      grooms: observable,
      lastNote: observable,
      mealMs: observable,
      meals: observable,
      naps: observable,
      playSessions: observable,
      vetVisits: observable,
    });
  }

  public get hasFood(): boolean {
    return this.foodPortions > 0;
  }

  public get MEAL_DELAY(): number {
    return this.mealMs;
  }

  public refillFood(): void {
    this.foodPortions += 1;
    this.lastNote = "Bowl refilled";
  }

  public startMeal(): void {
    this.foodPortions -= 1;
    this.lastNote = "Eating";
  }

  public finishMeal(): void {
    this.meals += 1;
    this.lastNote = "Fed and playful";
  }

  public startPlay(): void {
    this.playSessions += 1;
    this.lastNote = "Chasing toy";
  }

  public finishPlay(): void {
    this.lastNote = "Ready for a nap";
  }

  public finishGroom(): void {
    this.grooms += 1;
    this.lastNote = "Coat brushed";
  }

  public recordNap(): void {
    this.naps += 1;
  }

  public recordVetVisit(): void {
    this.vetVisits += 1;
    this.lastNote = "Vet check";
  }
}

type DogEvent =
  | { type: "LEASH" }
  | { type: "START_WALK" }
  | { type: "WALK_TICK" }
  | { type: "WATER" }
  | { type: "HOME" }
  | { type: "LOSE_LEASH" }
  | { type: "FOUND_LEASH" };

const dogMachine = createMachine<DogEvent>({
  id: "dogWalk",
  predictableActionArguments: true,
  schema: {
    events: {} as DogEvent,
  },
  initial: "home",
  states: {
    home: {
      on: {
        LEASH: "leashing",
      },
    },
    leashing: {
      entry: "recordLeash",
      after: {
        LEASH_DELAY: "ready",
      },
    },
    ready: {
      on: {
        START_WALK: "walking",
        LOSE_LEASH: "lostLeash",
      },
    },
    walking: {
      invoke: {
        id: "walkTracker",
        src: "walkTracker",
      },
      after: {
        THIRST_DELAY: "thirsty",
      },
      on: {
        WALK_TICK: {
          actions: "recordStep",
        },
        LOSE_LEASH: "lostLeash",
        HOME: "resting",
      },
    },
    thirsty: {
      on: {
        WATER: {
          target: "drinking",
          actions: "drinkWater",
        },
        LOSE_LEASH: "lostLeash",
        HOME: "resting",
      },
    },
    drinking: {
      after: {
        DRINK_DELAY: "walking",
      },
    },
    resting: {
      after: {
        REST_DELAY: "home",
      },
    },
    lostLeash: {
      on: {
        FOUND_LEASH: "home",
      },
    },
  },
});

class DogStore extends MobXStateMachine<DogStore, DogEvent> {
  public activeWalks = 0;

  public distanceMeters = 0;

  public leashChecks = 0;

  public sendFromWalk: (() => void) | undefined;

  public LEASH_DELAY = 600;

  public THIRST_DELAY = 3500;

  public REST_DELAY = 1800;

  public DRINK_DELAY = 700;

  public steps = 0;

  public walkCleanups = 0;

  public waterBreaks = 0;

  constructor() {
    super(dogMachine);

    makeObservable(this, {
      activeWalks: observable,
      distanceMeters: observable,
      leashChecks: observable,
      sendFromWalk: observable.ref,
      steps: observable,
      walkCleanups: observable,
      waterBreaks: observable,
    });
  }

  public step(): void {
    this.sendFromWalk?.();
  }

  public recordLeash(): void {
    this.leashChecks += 1;
  }

  public recordStep(): void {
    this.steps += 1;
    this.distanceMeters += 14;
  }

  public drinkWater(): void {
    this.waterBreaks += 1;
  }

  public walkTracker(): () => void {
    this.activeWalks += 1;
    this.sendFromWalk = () => {
      this.send({ type: "WALK_TICK" });
    };

    return () => {
      this.walkCleanups += 1;
      this.sendFromWalk = undefined;
    };
  }
}

type ShelterEvent =
  | { type: "CAT_VISITED" }
  | { type: "DOG_WALKED" }
  | { type: "HOME_READY" }
  | { type: "CANCEL" };

const shelterMachine = createMachine<ShelterEvent>({
  id: "shelterMatch",
  predictableActionArguments: true,
  schema: {
    events: {} as ShelterEvent,
  },
  initial: "screening",
  states: {
    screening: {
      entry: "recordScreening",
      type: "parallel",
      states: {
        cat: {
          initial: "waiting",
          states: {
            waiting: {
              on: {
                CAT_VISITED: {
                  target: "approved",
                  actions: "recordCatVisit",
                },
              },
            },
            approved: {
              type: "final",
            },
          },
        },
        dog: {
          initial: "waiting",
          states: {
            waiting: {
              on: {
                DOG_WALKED: {
                  target: "approved",
                  actions: "recordDogWalk",
                },
              },
            },
            approved: {
              type: "final",
            },
          },
        },
        home: {
          initial: "waiting",
          states: {
            waiting: {
              on: {
                HOME_READY: {
                  target: "approved",
                  actions: "recordHomeReady",
                },
              },
            },
            approved: {
              type: "final",
            },
          },
        },
      },
      on: {
        CANCEL: {
          target: "cancelled",
          actions: "recordCancel",
        },
      },
      onDone: {
        target: "allChecked",
        actions: "recordAllChecked",
      },
    },
    allChecked: {
      after: {
        MATCH_DELAY: {
          target: "matched",
          actions: "recordMatch",
        },
      },
    },
    matched: {},
    cancelled: {},
  },
});

type ShelterSpriteState =
  | "cat-no"
  | "cat-yes"
  | "dog-no"
  | "dog-yes"
  | "home-no"
  | "home-yes"
  | "complete"
  | "cancelled"
  | "matched";

class ShelterStore extends MobXStateMachine<ShelterStore, ShelterEvent> {
  public adoptions = 0;

  public catVisits = 0;

  public dogWalks = 0;

  public lastMatch = "Pending";

  public MATCH_DELAY = 900;

  public checklistTile: ShelterSpriteState = "cat-no";

  constructor() {
    super(shelterMachine);

    makeObservable(this, {
      adoptions: observable,
      catVisits: observable,
      checklistTile: observable,
      dogWalks: observable,
      lastMatch: observable,
    });
  }

  public recordScreening(): void {
    this.checklistTile = "cat-no";
    this.lastMatch = "Pending";
  }

  public recordCatVisit(): void {
    this.catVisits += 1;
    this.checklistTile = "cat-yes";
  }

  public recordDogWalk(): void {
    this.dogWalks += 1;
    this.checklistTile = "dog-yes";
  }

  public recordHomeReady(): void {
    this.checklistTile = "home-yes";
  }

  public recordAllChecked(): void {
    this.checklistTile = "complete";
    this.lastMatch = "Checklist complete";
  }

  public recordCancel(): void {
    this.checklistTile = "cancelled";
    this.lastMatch = "Cancelled";
  }

  public recordMatch(): void {
    this.adoptions += 1;
    this.checklistTile = "matched";
    this.lastMatch = `Match ${this.adoptions}`;
  }
}

type TrafficLightEvent =
  | { type: "POWER_OUTAGE" }
  | { type: "RESET" };

const trafficLightMachine = createMachine<TrafficLightEvent>({
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
      on: {
        POWER_OUTAGE: "off",
      },
    },
    red: {
      after: {
        RED_DELAY: "green",
      },
      on: {
        POWER_OUTAGE: "off",
      },
    },
    off: {
      on: {
        RESET: "green",
      },
    },
  },
});

class TrafficLightStore extends MobXStateMachine<
  TrafficLightStore,
  TrafficLightEvent
> {
  public greenEntries = 0;

  public GREEN_DELAY = 1200;

  public YELLOW_DELAY = 700;

  public RED_DELAY = 1100;

  constructor() {
    super(trafficLightMachine);

    makeObservable(this, {
      greenEntries: observable,
    });
  }

  public recordGreen(): void {
    this.greenEntries += 1;
  }
}

type LoaderEvent =
  | { type: "LOAD" }
  | { type: "RESOLVE" }
  | { type: "EMPTY" }
  | { type: "FAIL" }
  | { type: "RETRY" }
  | { type: "CANCEL" }
  | { type: "OFFLINE" }
  | { type: "CACHE" }
  | { type: "RESET" };

const loaderMachine = createMachine<LoaderEvent>({
  id: "asyncLoader",
  predictableActionArguments: true,
  schema: {
    events: {} as LoaderEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        LOAD: "loading",
        OFFLINE: "offline",
        CACHE: "staleCache",
      },
    },
    loading: {
      entry: "recordRequest",
      on: {
        RESOLVE: "success",
        EMPTY: "empty",
        FAIL: "error",
        CANCEL: "cancelled",
        OFFLINE: "offline",
      },
    },
    success: {
      on: {
        LOAD: "loading",
        CACHE: "staleCache",
        RESET: "idle",
      },
    },
    empty: {
      on: {
        LOAD: "loading",
        RESET: "idle",
      },
    },
    error: {
      on: {
        RETRY: "retrying",
        RESET: "idle",
      },
    },
    retrying: {
      after: {
        RETRY_DELAY: "loading",
      },
      on: {
        CANCEL: "cancelled",
      },
    },
    cancelled: {
      on: {
        LOAD: "loading",
        RESET: "idle",
      },
    },
    offline: {
      on: {
        CACHE: "staleCache",
        RESET: "idle",
      },
    },
    staleCache: {
      on: {
        LOAD: "loading",
        RESET: "idle",
      },
    },
  },
});

class LoaderStore extends MobXStateMachine<LoaderStore, LoaderEvent> {
  public requests = 0;

  public RETRY_DELAY = 800;

  constructor() {
    super(loaderMachine);

    makeObservable(this, {
      requests: observable,
    });
  }

  public recordRequest(): void {
    this.requests += 1;
  }
}

type CheckoutEvent =
  | { type: "START" }
  | { type: "ADDRESS" }
  | { type: "PAY" }
  | { type: "PAYMENT_OK" }
  | { type: "PAYMENT_FAIL" }
  | { type: "PACK" }
  | { type: "SHIP" }
  | { type: "DELIVER" }
  | { type: "RESET" };

const checkoutMachine = createMachine<CheckoutEvent>({
  id: "checkout",
  predictableActionArguments: true,
  schema: {
    events: {} as CheckoutEvent,
  },
  initial: "cart",
  states: {
    cart: {
      on: {
        START: "address",
      },
    },
    address: {
      on: {
        ADDRESS: "payment",
      },
    },
    payment: {
      on: {
        PAY: "validating",
      },
    },
    validating: {
      on: {
        PAYMENT_OK: {
          target: "paid",
          actions: "recordPaidOrder",
        },
        PAYMENT_FAIL: "failedPayment",
      },
    },
    paid: {
      on: {
        PACK: "packing",
      },
    },
    packing: {
      on: {
        SHIP: "shipped",
      },
    },
    shipped: {
      on: {
        DELIVER: "delivered",
      },
    },
    delivered: {
      on: {
        RESET: "cart",
      },
    },
    failedPayment: {
      on: {
        PAY: "validating",
        RESET: "cart",
      },
    },
  },
});

class CheckoutStore extends MobXStateMachine<CheckoutStore, CheckoutEvent> {
  public paidOrders = 0;

  constructor() {
    super(checkoutMachine);

    makeObservable(this, {
      paidOrders: observable,
    });
  }

  public recordPaidOrder(): void {
    this.paidOrders += 1;
  }
}

const cat = new CatStore();
const dog = new DogStore();
const shelter = new ShelterStore();
const traffic = new TrafficLightStore();
const loader = new LoaderStore();
const checkout = new CheckoutStore();

const query = <ElementType extends HTMLElement>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
};

const setText = (selector: string, value: string | number): void => {
  query<HTMLElement>(selector).textContent = String(value);
};

const setDisabled = (selector: string, value: boolean): void => {
  query<HTMLButtonElement>(selector).disabled = value;
};

const setClassName = (selector: string, value: string): void => {
  query<HTMLElement>(selector).className = value;
};

const formatState = (value: unknown): string => {
  if (value === undefined) {
    return "not started";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
};

const catStatus = (): string => {
  if (cat.matches("sleeping")) {
    return t("Sleeping");
  }

  if (cat.matches("hungry")) {
    return cat.foodPortions > 0
      ? t("Hungry, food ready")
      : t("Hungry, empty bowl");
  }

  if (cat.matches("eating")) {
    return t("Eating");
  }

  if (cat.matches("playful")) {
    return t("Playful");
  }

  if (cat.matches("playing")) {
    return t("Playing");
  }

  if (cat.matches("grooming")) {
    return t("Grooming");
  }

  return t("Vet visit");
};

const catNote = (): string => {
  switch (cat.lastNote) {
    case "Bowl refilled":
      return t("Bowl refilled");
    case "Eating":
      return t("Eating");
    case "Fed and playful":
      return t("Fed and playful");
    case "Chasing toy":
      return t("Chasing toy");
    case "Ready for a nap":
      return t("Ready for a nap");
    case "Coat brushed":
      return t("Coat brushed");
    case "Vet check":
      return t("Vet check");
    default:
      return t("Sleeping");
  }
};

const catSpriteState = (): string => {
  if (cat.matches("sleeping")) {
    return "sleeping";
  }

  if (cat.matches("hungry")) {
    return cat.foodPortions > 0 ? "begging" : "hungry";
  }

  if (cat.matches("eating")) {
    return "eating";
  }

  if (cat.matches("playing")) {
    return "playing";
  }

  if (cat.matches("grooming")) {
    return "grooming";
  }

  if (cat.matches("vetVisit")) {
    return "sick";
  }

  return "begging";
};

const dogStatus = (): string => {
  if (dog.matches("home")) {
    return dog.walkCleanups > 0 ? t("Back home") : t("At home");
  }

  if (dog.matches("leashing")) {
    return t("Leashing");
  }

  if (dog.matches("ready")) {
    return t("Ready to walk");
  }

  if (dog.matches("walking")) {
    return t("Walking");
  }

  if (dog.matches("thirsty")) {
    return t("Needs water");
  }

  if (dog.matches("drinking")) {
    return t("Drinking");
  }

  if (dog.matches("lostLeash")) {
    return t("Lost leash");
  }

  return t("Resting");
};

const dogSpriteState = (): string => {
  if (dog.matches("leashing")) {
    return "leashing";
  }

  if (dog.matches("ready")) {
    return "ready";
  }

  if (dog.matches("walking")) {
    return "walking";
  }

  if (dog.matches("thirsty")) {
    return "thirsty";
  }

  if (dog.matches("drinking")) {
    return "drinking";
  }

  if (dog.matches("resting")) {
    return "resting";
  }

  if (dog.matches("lostLeash")) {
    return "error";
  }

  return dog.walkCleanups > 0 ? "returned" : "home";
};

const trafficSpriteState = (): string => {
  if (traffic.matches("red")) {
    return "red";
  }

  if (traffic.matches("yellow")) {
    return "yellow";
  }

  if (traffic.matches("off")) {
    return "off";
  }

  return "green";
};

const loaderSpriteState = (): string => {
  if (loader.matches("loading")) {
    return "loading";
  }

  if (loader.matches("success")) {
    return "success";
  }

  if (loader.matches("empty")) {
    return "empty";
  }

  if (loader.matches("error")) {
    return "error";
  }

  if (loader.matches("retrying")) {
    return "retrying";
  }

  if (loader.matches("cancelled")) {
    return "cancelled";
  }

  if (loader.matches("offline")) {
    return "offline";
  }

  if (loader.matches("staleCache")) {
    return "stale";
  }

  return "idle";
};

const checkoutSpriteState = (): string => {
  if (checkout.matches("address")) {
    return "address";
  }

  if (checkout.matches("payment")) {
    return "payment";
  }

  if (checkout.matches("validating")) {
    return "validating";
  }

  if (checkout.matches("paid")) {
    return "paid";
  }

  if (checkout.matches("packing")) {
    return "packing";
  }

  if (checkout.matches("shipped")) {
    return "shipped";
  }

  if (checkout.matches("delivered")) {
    return "delivered";
  }

  if (checkout.matches("failedPayment")) {
    return "failed";
  }

  return "cart";
};

const shelterSpriteState = (): ShelterSpriteState => {
  if (shelter.matches("matched")) {
    return "matched";
  }

  if (shelter.matches("cancelled")) {
    return "cancelled";
  }

  if (shelter.matches("allChecked")) {
    return "complete";
  }

  return shelter.checklistTile;
};

const yesNo = (value: boolean): string =>
  value ? t("done") : t("waiting");

const shelterLastMatch = (): string => {
  if (shelter.lastMatch.startsWith("Match ")) {
    return t("Match {{count}}", { count: shelter.adoptions });
  }

  if (shelter.lastMatch === "Checklist complete") {
    return t("Checklist complete");
  }

  if (shelter.lastMatch === "Cancelled") {
    return t("Cancelled");
  }

  return t("Pending");
};

const changeLanguage = (language: PageLanguage): void => {
  currentLanguage = language;
  languageStorage.setLanguage(language);
  mount();
  bindEvents();
  render();
};

const renderLanguageButtons = (): void => {
  document.documentElement.lang = currentLanguage;

  document
    .querySelectorAll<HTMLButtonElement>("[data-language]")
    .forEach((button) => {
      const language = button.dataset.language;
      const isActive = language === currentLanguage;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
};

const render = (): void => {
  renderLanguageButtons();

  setText("[data-hero-cat-state]", catStatus());
  setText("[data-hero-dog-state]", dogStatus());
  setText("[data-hero-shelter-state]", formatState(shelter.state));
  setClassName(
    "[data-hero-cat-sprite]",
    `sprite-tile cat-sprite cat-${catSpriteState()}`,
  );

  setText("[data-cat-status]", catStatus());
  setClassName(
    "[data-cat-sprite]",
    `sprite-tile cat-demo-sprite cat-${catSpriteState()}`,
  );
  setText("[data-cat-food]", cat.foodPortions);
  setText("[data-cat-meals]", cat.meals);
  setText("[data-cat-play-count]", cat.playSessions);
  setText("[data-cat-grooms]", cat.grooms);
  setText("[data-cat-vet]", cat.vetVisits);
  setText("[data-cat-note]", catNote());
  setText("[data-cat-state]", formatState(cat.state));
  setDisabled("[data-cat-feed]", !cat.matches("hungry"));
  setDisabled("[data-cat-play-button]", !cat.matches("playful"));
  setDisabled("[data-cat-groom]", !cat.matches("playful"));
  setDisabled("[data-cat-vet-button]", !cat.matches("playful"));
  setDisabled("[data-cat-home]", !cat.matches("vetVisit"));

  setText("[data-dog-status]", dogStatus());
  setClassName(
    "[data-dog-sprite]",
    `sprite-tile dog-sprite dog-${dogSpriteState()}`,
  );
  setText("[data-dog-steps]", dog.steps);
  setText("[data-dog-distance]", dog.distanceMeters);
  setText("[data-dog-water]", dog.waterBreaks);
  setText("[data-dog-cleanups]", dog.walkCleanups);
  setText("[data-dog-state]", formatState(dog.state));
  setDisabled("[data-dog-start]", !dog.matches("ready"));
  setDisabled("[data-dog-step]", !dog.matches("walking"));
  setDisabled("[data-dog-water-button]", !dog.matches("thirsty"));
  setDisabled(
    "[data-dog-home]",
    dog.matches("home") || dog.matches("resting") || dog.matches("lostLeash"),
  );
  setDisabled(
    "[data-dog-lose]",
    dog.matches("home") || dog.matches("resting") || dog.matches("lostLeash"),
  );
  setDisabled("[data-dog-found]", !dog.matches("lostLeash"));

  const shelterScreening = shelter.matches("screening");
  const shelterFinished =
    shelter.matches("allChecked") || shelter.matches("matched");
  const catReady =
    shelterFinished || shelter.matches({ screening: { cat: "approved" } });
  const dogReady =
    shelterFinished || shelter.matches({ screening: { dog: "approved" } });
  const homeReady =
    shelterFinished || shelter.matches({ screening: { home: "approved" } });

  setText("[data-shelter-cat]", yesNo(catReady));
  setText("[data-shelter-dog]", yesNo(dogReady));
  setText("[data-shelter-home]", yesNo(homeReady));
  setText("[data-shelter-matches]", shelter.adoptions);
  setText("[data-shelter-last]", shelterLastMatch());
  setText("[data-shelter-state]", formatState(shelter.state));
  setClassName(
    "[data-shelter-sprite]",
    `sprite-tile adoption-sprite adoption-${shelterSpriteState()}`,
  );
  setDisabled("[data-shelter-cat-button]", !shelterScreening || catReady);
  setDisabled("[data-shelter-dog-button]", !shelterScreening || dogReady);
  setDisabled("[data-shelter-home-button]", !shelterScreening || homeReady);
  setDisabled("[data-shelter-cancel]", !shelterScreening);

  setText("[data-traffic-status]", formatState(traffic.state));
  setText("[data-traffic-green-count]", traffic.greenEntries);
  setClassName(
    "[data-traffic-sprite]",
    `sprite-tile traffic-sprite traffic-${trafficSpriteState()}`,
  );
  setDisabled("[data-traffic-reset]", !traffic.matches("off"));
  setDisabled("[data-traffic-outage]", traffic.matches("off"));

  setText("[data-loader-status]", formatState(loader.state));
  setText("[data-loader-requests]", loader.requests);
  setClassName(
    "[data-loader-sprite]",
    `sprite-tile loader-sprite loader-${loaderSpriteState()}`,
  );
  setDisabled("[data-loader-load]", loader.matches("loading"));
  setDisabled("[data-loader-success]", !loader.matches("loading"));
  setDisabled("[data-loader-empty]", !loader.matches("loading"));
  setDisabled("[data-loader-fail]", !loader.matches("loading"));
  setDisabled("[data-loader-retry]", !loader.matches("error"));
  setDisabled(
    "[data-loader-cancel]",
    !loader.matches("loading") && !loader.matches("retrying"),
  );
  setDisabled("[data-loader-cache]", loader.matches("loading"));
  setDisabled("[data-loader-reset]", loader.matches("idle"));

  setText("[data-checkout-status]", formatState(checkout.state));
  setText("[data-checkout-paid]", checkout.paidOrders);
  setClassName(
    "[data-checkout-sprite]",
    `sprite-tile checkout-sprite checkout-${checkoutSpriteState()}`,
  );
  setDisabled("[data-checkout-start]", !checkout.matches("cart"));
  setDisabled("[data-checkout-address]", !checkout.matches("address"));
  setDisabled(
    "[data-checkout-pay]",
    !checkout.matches("payment") && !checkout.matches("failedPayment"),
  );
  setDisabled("[data-checkout-ok]", !checkout.matches("validating"));
  setDisabled("[data-checkout-fail]", !checkout.matches("validating"));
  setDisabled("[data-checkout-pack]", !checkout.matches("paid"));
  setDisabled("[data-checkout-ship]", !checkout.matches("packing"));
  setDisabled("[data-checkout-deliver]", !checkout.matches("shipped"));
  setDisabled("[data-checkout-reset]", checkout.matches("cart"));
};

const mount = (): void => {
  query<HTMLElement>("#app").innerHTML = `
    <main class="app-shell">
      <header class="site-header">
        <a class="brand" href="#top" aria-label="MobXstate home">
          <span class="brand-mark">M</span>
          <span>
            <strong>MobXstate</strong>
            <small>${t("Statecharts for MobX stores")}</small>
          </span>
        </a>
        <nav class="nav-links" aria-label="Primary navigation">
          <a href="#benefits">${t("Benefits")}</a>
          <a href="#compare">${t("Comparison")}</a>
          <a href="#docs">${t("Documentation")}</a>
          <a href="#live-examples">${t("Demos")}</a>
        </nav>
        <div class="language-switch" aria-label="Language">
          ${supportedLanguages
            .map(
              (language) => `
                <button class="language-button" data-language="${language}" type="button">
                  ${languageLabels[language]}
                </button>
              `,
            )
            .join("")}
        </div>
        <a class="btn btn-compact" href="https://github.com/order-of-chaos/mobXstate">GitHub</a>
      </header>

      <section class="hero" id="top">
        <div class="section-inner hero-layout">
          <div class="hero-copy">
            <span class="eyebrow">${t("MobX-first state machines")}</span>
            <h1>${t("Predictable workflows without a separate machine context")}</h1>
            <p>
              ${t("MobXstate describes states and transitions as a statechart, while data, guards, delays, actions and effects stay in the familiar MobX store. It is useful for interfaces where the process matters more than a set of flags.")}
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#live-examples">${t("Open live examples")}</a>
              <a class="btn btn-light" href="#docs">${t("Start in 3 steps")}</a>
            </div>
            <p class="disclaimer">
              ${t("Unofficial library for MobX; not affiliated with MobX, Stately or XState.")}
            </p>
          </div>

          <div class="hero-product" aria-label="MobXstate product preview">
            <div class="browser-bar">
              <span></span>
              <span></span>
              <span></span>
              <strong>petWorkflow.ts</strong>
            </div>
            <div class="product-grid">
              <div class="sprite-showcase">
                <div class="sprite-tile cat-sprite cat-sleeping" data-hero-cat-sprite aria-hidden="true"></div>
                <div class="sprite-caption">
                  <strong>${t("State-driven assets")}</strong>
                  <span>${t("One state value chooses the right sprite tile.")}</span>
                </div>
              </div>
              <div class="runtime-card">
                <span class="runtime-label">${t("Current states")}</span>
                <strong>${t("Cat")}: <span data-hero-cat-state></span></strong>
                <strong>${t("Dog")}: <span data-hero-dog-state></span></strong>
                <strong>${t("Shelter")}: <span data-hero-shelter-state></span></strong>
              </div>
              <pre class="hero-code"><code>class PetStore extends MobXStateMachine {
  get hasFood() {
    return this.foodPortions &gt; 0;
  }

  feed() {
    this.foodPortions -= 1;
  }
}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section class="metric-band">
        <div class="section-inner metric-grid" aria-label="MobXstate highlights">
          <div>
            <strong>0</strong>
            <span>${t("XState runtime dependency")}</span>
          </div>
          <div>
            <strong>1</strong>
            <span>${t("MobX store as source of behavior")}</span>
          </div>
          <div>
            <strong>${t("Tested")}</strong>
            <span>${t("Runtime checks for core machine semantics")}</span>
          </div>
          <div>
            <strong>${t("Typed")}</strong>
            <span>${t("Payload-aware <code>send</code> and callback contracts")}</span>
          </div>
        </div>
      </section>

      <section class="section section-light" id="benefits">
        <div class="section-inner">
          <div class="section-heading">
            <span class="eyebrow">${t("Why it is useful")}</span>
            <h2>${t("Statechart controls the process, MobX store controls the data")}</h2>
            <p>
              ${t("The library is useful when UI depends on rules: an order cannot be paid before validation, a pet cannot be fed without food, and an async connection must be cleaned up when leaving a state.")}
            </p>
          </div>

          <div class="benefit-grid">
            <article class="benefit-card">
              <span class="card-icon">01</span>
              <h3>${t("Fewer boolean flags")}</h3>
              <p>${t("Instead of <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, you keep one state value with explicit transitions.")}</p>
            </article>
            <article class="benefit-card">
              <span class="card-icon">02</span>
              <h3>${t("Actions directly in the store")}</h3>
              <p>${t("A named action is resolved as a MobX store method first and runs inside a MobX transaction.")}</p>
            </article>
            <article class="benefit-card">
              <span class="card-icon">03</span>
              <h3>${t("Guards as computed values")}</h3>
              <p>${t("Guards read getters, observable properties or pure methods, so rules live next to data.")}</p>
            </article>
            <article class="benefit-card">
              <span class="card-icon">04</span>
              <h3>${t("Effects with cleanup")}</h3>
              <p>${t("<code>invoke</code> starts a store method that may return a promise, cleanup function or child machine.")}</p>
            </article>
            <article class="benefit-card">
              <span class="card-icon">05</span>
              <h3>${t("Strict event types")}</h3>
              <p>${t("<code>send(\"RESET\")</code> works for payloadless events, while payload events require an object.")}</p>
            </article>
            <article class="benefit-card">
              <span class="card-icon">06</span>
              <h3>${t("Persistence without surprises")}</h3>
              <p>${t("Saved state values are validated before restore and can be normalized through <code>transformPersistedState</code>.")}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section section-contrast" id="compare">
        <div class="section-inner">
          <div class="section-heading">
            <span class="eyebrow">${t("Approach comparison")}</span>
            <h2>${t("MobXstate does not replace every tool; it covers MobX-first workflows")}</h2>
            <p>
              ${t("This table describes practical tradeoffs without pretending one approach is universal. If an app is already built on MobX, MobXstate adds an explicit process model without moving behavior into a separate runtime context.")}
            </p>
          </div>

          <div class="comparison-table" role="table" aria-label="MobXstate comparison">
            <div class="comparison-row comparison-head" role="row">
              <span role="columnheader">${t("Approach")}</span>
              <span role="columnheader">${t("Strong at")}</span>
              <span role="columnheader">${t("Tradeoff")}</span>
              <span role="columnheader">${t("When to choose")}</span>
            </div>
            <div class="comparison-row" role="row">
              <strong role="cell">MobXstate</strong>
              <span role="cell">${t("Statechart + MobX store methods, typed events, observable runtime state.")}</span>
              <span role="cell">${t("Does not try to cover the entire XState runtime surface.")}</span>
              <span role="cell">${t("A MobX app where workflows should be explicit and testable.")}</span>
            </div>
            <div class="comparison-row" role="row">
              <strong role="cell">Plain MobX</strong>
              <span role="cell">${t("Simple observable models, computed values and reactive UI.")}</span>
              <span role="cell">${t("Complex processes often spread across flags and imperative checks.")}</span>
              <span role="cell">${t("A form, CRUD screen or view without a strict lifecycle.")}</span>
            </div>
            <div class="comparison-row" role="row">
              <strong role="cell">XState runtime</strong>
              <span role="cell">${t("Full actor/statechart model and a rich state machine ecosystem.")}</span>
              <span role="cell">${t("Separate context/actions/effects next to MobX require an integration layer.")}</span>
              <span role="cell">${t("You need the full XState surface or the app is built around actors.")}</span>
            </div>
            <div class="comparison-row" role="row">
              <strong role="cell">Reducers</strong>
              <span role="cell">${t("Explicit events and pure updates.")}</span>
              <span role="cell">${t("Async lifecycle, guards and cleanup usually have to be specified manually.")}</span>
              <span role="cell">${t("A simple serializable transition model without MobX store methods.")}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section section-light" id="docs">
        <div class="section-inner docs-layout">
          <div class="section-heading docs-heading">
            <span class="eyebrow">${t("Documentation on one page")}</span>
            <h2>${t("Minimal mental model")}</h2>
            <p>
              ${t("The machine answers what is allowed now, the store answers what data changes. UI sends events and observes state.")}
            </p>
          </div>

          <div class="docs-steps">
            <article>
              <span>1</span>
              <h3>${t("Describe events and the statechart")}</h3>
              <p>${t("Events type the inputs; config describes states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> and <code>invoke</code>.")}</p>
            </article>
            <article>
              <span>2</span>
              <h3>${t("Implement behavior in the store")}</h3>
              <p>${t("Methods become actions/effects, getters and boolean properties become guards, number properties become delays.")}</p>
            </article>
            <article>
              <span>3</span>
              <h3>${t("Connect the UI")}</h3>
              <p>${t("Call <code>store.send(event)</code>, check <code>store.matches(...)</code>, show <code>store.state</code>.")}</p>
            </article>
          </div>

          <div class="code-showcase">
            <div class="browser-bar">
              <span></span>
              <span></span>
              <span></span>
              <strong>quick-start.ts</strong>
            </div>
            <pre><code>type CatEvent =
  | { type: "REFILL" }
  | { type: "FEED" };

const catMachine = createMachine&lt;CatEvent&gt;({
  id: "cat",
  initial: "hungry",
  states: {
    hungry: {
      on: {
        REFILL: { actions: "refillFood" },
        FEED: { target: "sleeping", cond: "hasFood" },
      },
    },
    sleeping: {},
  },
});

class CatStore extends MobXStateMachine&lt;CatStore, CatEvent&gt; {
  foodPortions = 0;

  get hasFood() {
    return this.foodPortions &gt; 0;
  }

  refillFood() {
    this.foodPortions += 1;
  }
}</code></pre>
          </div>
        </div>
      </section>

      <section class="section section-white" id="live-examples">
        <div class="section-inner examples-intro">
          <span class="eyebrow">${t("Live scenarios")}</span>
          <h2>${t("Cats, dogs and adoption flow show the entire runtime in action")}</h2>
          <p>
            ${t("Buttons send typed events, guards block invalid transitions, delays move the process by timer, invoke starts a lifecycle effect with cleanup, parallel state completes the checklist, and sprite tiles show the current state without manual synchronization.")}
          </p>
        </div>
      </section>

      <section class="grid">
        <article class="panel panel-wide pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile cat-demo-sprite cat-sleeping" data-cat-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Cat Routine")}</h2>
              <div class="meter-label" data-cat-status></div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-cat-wake>${t("Wake")}</button>
            <button class="btn" data-cat-refill>${t("Refill")}</button>
            <button class="btn btn-primary" data-cat-feed>${t("Feed")}</button>
            <button class="btn" data-cat-play-button>${t("Play")}</button>
            <button class="btn" data-cat-groom>${t("Groom")}</button>
            <button class="btn" data-cat-vet-button>${t("Vet")}</button>
            <button class="btn" data-cat-home>${t("Home")}</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">${t("food")}</span><span class="meter-value" data-cat-food></span></div>
            <div class="meter"><span class="meter-label">${t("meals")}</span><span class="meter-value" data-cat-meals></span></div>
            <div class="meter"><span class="meter-label">${t("play")}</span><span class="meter-value" data-cat-play-count></span></div>
            <div class="meter"><span class="meter-label">${t("grooms")}</span><span class="meter-value" data-cat-grooms></span></div>
          </div>
          <div class="pill-row">
            <span class="pill">${t("vet")}: <span data-cat-vet></span></span>
            <span class="pill pill-ok">${t("note")}: <span data-cat-note></span></span>
          </div>
          <div class="state-line" data-cat-state></div>
        </article>

        <article class="panel panel-medium pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile dog-sprite dog-home" data-dog-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Dog Walk")}</h2>
              <div class="meter-label" data-dog-status></div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-dog-leash>${t("Leash")}</button>
            <button class="btn btn-primary" data-dog-start>${t("Start")}</button>
            <button class="btn" data-dog-step>${t("Step")}</button>
            <button class="btn" data-dog-water-button>${t("Water")}</button>
            <button class="btn btn-danger" data-dog-home>${t("Home")}</button>
            <button class="btn btn-danger" data-dog-lose>${t("Lose leash")}</button>
            <button class="btn" data-dog-found>${t("Found")}</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">${t("steps")}</span><span class="meter-value" data-dog-steps></span></div>
            <div class="meter"><span class="meter-label">${t("meters")}</span><span class="meter-value" data-dog-distance></span></div>
            <div class="meter"><span class="meter-label">${t("water")}</span><span class="meter-value" data-dog-water></span></div>
            <div class="meter"><span class="meter-label">${t("cleanups")}</span><span class="meter-value" data-dog-cleanups></span></div>
          </div>
          <div class="state-line" data-dog-state></div>
        </article>

        <article class="panel panel-half pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile loader-sprite loader-idle" data-loader-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Async Loader")}</h2>
              <div class="meter-label">${t("Result, error, retry and cache states")}</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-loader-load>${t("Load")}</button>
            <button class="btn btn-primary" data-loader-success>${t("Success")}</button>
            <button class="btn" data-loader-empty>${t("Empty")}</button>
            <button class="btn btn-danger" data-loader-fail>${t("Error")}</button>
            <button class="btn" data-loader-retry>${t("Retry")}</button>
            <button class="btn btn-danger" data-loader-cancel>${t("Cancel")}</button>
            <button class="btn" data-loader-offline>${t("Offline")}</button>
            <button class="btn" data-loader-cache>${t("Cache")}</button>
            <button class="btn" data-loader-reset>${t("Reset")}</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">${t("state")}</span><span class="meter-value" data-loader-status></span></div>
            <div class="meter"><span class="meter-label">${t("requests")}</span><span class="meter-value" data-loader-requests></span></div>
          </div>
          <div class="state-line">
            idle -> loading -> success | empty | error | cancelled
          </div>
        </article>

        <article class="panel panel-half pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile checkout-sprite checkout-cart" data-checkout-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Checkout Flow")}</h2>
              <div class="meter-label">${t("Sequential order workflow")}</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-checkout-start>${t("Checkout")}</button>
            <button class="btn" data-checkout-address>${t("Address")}</button>
            <button class="btn" data-checkout-pay>${t("Pay")}</button>
            <button class="btn btn-primary" data-checkout-ok>${t("Approve")}</button>
            <button class="btn btn-danger" data-checkout-fail>${t("Fail")}</button>
            <button class="btn" data-checkout-pack>${t("Pack")}</button>
            <button class="btn" data-checkout-ship>${t("Ship")}</button>
            <button class="btn" data-checkout-deliver>${t("Deliver")}</button>
            <button class="btn" data-checkout-reset>${t("Reset")}</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">${t("state")}</span><span class="meter-value" data-checkout-status></span></div>
            <div class="meter"><span class="meter-label">${t("paid")}</span><span class="meter-value" data-checkout-paid></span></div>
          </div>
          <div class="state-line">
            cart -> address -> payment -> validating -> paid -> delivered
          </div>
        </article>

        <article class="panel panel-medium pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile traffic-sprite traffic-green" data-traffic-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Traffic Light")}</h2>
              <div class="meter-label">${t("Delayed transitions and failure state")}</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-danger" data-traffic-outage>${t("Break")}</button>
            <button class="btn btn-primary" data-traffic-reset>${t("Reset")}</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">${t("state")}</span><span class="meter-value" data-traffic-status></span></div>
            <div class="meter"><span class="meter-label">${t("green entries")}</span><span class="meter-value" data-traffic-green-count></span></div>
          </div>
          <div class="state-line">
            green --after--&gt; yellow --after--&gt; red --after--&gt; green
          </div>
        </article>

        <article class="panel panel-wide pet-panel">
          <div class="pet-heading">
            <div class="sprite-tile adoption-sprite adoption-cat-no" data-shelter-sprite aria-hidden="true"></div>
            <div>
              <h2>${t("Shelter Match")}</h2>
              <div class="meter-label">${t("Parallel applicant checklist")}</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-shelter-cat-button>${t("Meet cat")}</button>
            <button class="btn btn-primary" data-shelter-dog-button>${t("Walk dog")}</button>
            <button class="btn btn-primary" data-shelter-home-button>${t("Prepare home")}</button>
            <button class="btn btn-danger" data-shelter-cancel>${t("Cancel")}</button>
            <button class="btn" data-shelter-restart>${t("New case")}</button>
          </div>
          <div class="pill-row">
            <span class="pill">${t("cat")}: <span data-shelter-cat></span></span>
            <span class="pill">${t("dog")}: <span data-shelter-dog></span></span>
            <span class="pill">${t("home")}: <span data-shelter-home></span></span>
            <span class="pill pill-ok">${t("matches")}: <span data-shelter-matches></span></span>
            <span class="pill pill-warn">${t("last")}: <span data-shelter-last></span></span>
          </div>
          <div class="state-line" data-shelter-state></div>
        </article>
      </section>
    </main>
  `;
};

const bindEvents = (): void => {
  document
    .querySelectorAll<HTMLButtonElement>("[data-language]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const language = button.dataset.language;

        if (isPageLanguage(language)) {
          changeLanguage(language);
        }
      });
    });

  query<HTMLButtonElement>("[data-cat-wake]").addEventListener("click", () => {
    cat.send({ type: "WAKE" });
  });
  query<HTMLButtonElement>("[data-cat-refill]").addEventListener("click", () => {
    cat.send({ type: "REFILL" });
  });
  query<HTMLButtonElement>("[data-cat-feed]").addEventListener("click", () => {
    cat.send({ type: "FEED" });
  });
  query<HTMLButtonElement>("[data-cat-play-button]").addEventListener(
    "click",
    () => {
      cat.send({ type: "PLAY" });
    },
  );
  query<HTMLButtonElement>("[data-cat-groom]").addEventListener("click", () => {
    cat.send({ type: "GROOM" });
  });
  query<HTMLButtonElement>("[data-cat-vet-button]").addEventListener(
    "click",
    () => {
      cat.send({ type: "VET" });
    },
  );
  query<HTMLButtonElement>("[data-cat-home]").addEventListener("click", () => {
    cat.send({ type: "BACK_HOME" });
  });

  query<HTMLButtonElement>("[data-dog-leash]").addEventListener("click", () => {
    dog.send({ type: "LEASH" });
  });
  query<HTMLButtonElement>("[data-dog-start]").addEventListener("click", () => {
    dog.send({ type: "START_WALK" });
  });
  query<HTMLButtonElement>("[data-dog-step]").addEventListener("click", () => {
    dog.step();
  });
  query<HTMLButtonElement>("[data-dog-water-button]").addEventListener(
    "click",
    () => {
      dog.send({ type: "WATER" });
    },
  );
  query<HTMLButtonElement>("[data-dog-home]").addEventListener("click", () => {
    dog.send({ type: "HOME" });
  });
  query<HTMLButtonElement>("[data-dog-lose]").addEventListener("click", () => {
    dog.send({ type: "LOSE_LEASH" });
  });
  query<HTMLButtonElement>("[data-dog-found]").addEventListener("click", () => {
    dog.send({ type: "FOUND_LEASH" });
  });

  query<HTMLButtonElement>("[data-loader-load]").addEventListener("click", () => {
    loader.send({ type: "LOAD" });
  });
  query<HTMLButtonElement>("[data-loader-success]").addEventListener(
    "click",
    () => {
      loader.send({ type: "RESOLVE" });
    },
  );
  query<HTMLButtonElement>("[data-loader-empty]").addEventListener("click", () => {
    loader.send({ type: "EMPTY" });
  });
  query<HTMLButtonElement>("[data-loader-fail]").addEventListener("click", () => {
    loader.send({ type: "FAIL" });
  });
  query<HTMLButtonElement>("[data-loader-retry]").addEventListener("click", () => {
    loader.send({ type: "RETRY" });
  });
  query<HTMLButtonElement>("[data-loader-cancel]").addEventListener(
    "click",
    () => {
      loader.send({ type: "CANCEL" });
    },
  );
  query<HTMLButtonElement>("[data-loader-offline]").addEventListener(
    "click",
    () => {
      loader.send({ type: "OFFLINE" });
    },
  );
  query<HTMLButtonElement>("[data-loader-cache]").addEventListener("click", () => {
    loader.send({ type: "CACHE" });
  });
  query<HTMLButtonElement>("[data-loader-reset]").addEventListener("click", () => {
    loader.send({ type: "RESET" });
  });

  query<HTMLButtonElement>("[data-checkout-start]").addEventListener(
    "click",
    () => {
      checkout.send({ type: "START" });
    },
  );
  query<HTMLButtonElement>("[data-checkout-address]").addEventListener(
    "click",
    () => {
      checkout.send({ type: "ADDRESS" });
    },
  );
  query<HTMLButtonElement>("[data-checkout-pay]").addEventListener("click", () => {
    checkout.send({ type: "PAY" });
  });
  query<HTMLButtonElement>("[data-checkout-ok]").addEventListener("click", () => {
    checkout.send({ type: "PAYMENT_OK" });
  });
  query<HTMLButtonElement>("[data-checkout-fail]").addEventListener(
    "click",
    () => {
      checkout.send({ type: "PAYMENT_FAIL" });
    },
  );
  query<HTMLButtonElement>("[data-checkout-pack]").addEventListener("click", () => {
    checkout.send({ type: "PACK" });
  });
  query<HTMLButtonElement>("[data-checkout-ship]").addEventListener("click", () => {
    checkout.send({ type: "SHIP" });
  });
  query<HTMLButtonElement>("[data-checkout-deliver]").addEventListener(
    "click",
    () => {
      checkout.send({ type: "DELIVER" });
    },
  );
  query<HTMLButtonElement>("[data-checkout-reset]").addEventListener(
    "click",
    () => {
      checkout.send({ type: "RESET" });
    },
  );

  query<HTMLButtonElement>("[data-shelter-cat-button]").addEventListener(
    "click",
    () => {
      shelter.send({ type: "CAT_VISITED" });
    },
  );
  query<HTMLButtonElement>("[data-shelter-dog-button]").addEventListener(
    "click",
    () => {
      shelter.send({ type: "DOG_WALKED" });
    },
  );
  query<HTMLButtonElement>("[data-shelter-home-button]").addEventListener(
    "click",
    () => {
      shelter.send({ type: "HOME_READY" });
    },
  );
  query<HTMLButtonElement>("[data-shelter-cancel]").addEventListener(
    "click",
    () => {
      shelter.send({ type: "CANCEL" });
    },
  );
  query<HTMLButtonElement>("[data-shelter-restart]").addEventListener(
    "click",
    () => {
      void shelter.restart().then(render);
    },
  );

  query<HTMLButtonElement>("[data-traffic-outage]").addEventListener(
    "click",
    () => {
      traffic.send({ type: "POWER_OUTAGE" });
    },
  );
  query<HTMLButtonElement>("[data-traffic-reset]").addEventListener(
    "click",
    () => {
      traffic.send({ type: "RESET" });
    },
  );
};

mount();
bindEvents();
autorun(render);
void Promise.all([
  cat.ready,
  dog.ready,
  shelter.ready,
  traffic.ready,
  loader.ready,
  checkout.ready,
]).then(render);
