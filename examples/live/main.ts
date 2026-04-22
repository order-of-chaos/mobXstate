import { autorun, makeObservable, observable } from "mobx";

import {
  MobXStateMachine,
  createMachine,
} from "../../src";

import "./styles.css";

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
  | { type: "HOME" };

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
        HOME: "resting",
      },
    },
    thirsty: {
      on: {
        WATER: {
          target: "walking",
          actions: "drinkWater",
        },
        HOME: "resting",
      },
    },
    resting: {
      after: {
        REST_DELAY: "home",
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
                HOME_READY: "approved",
              },
            },
            approved: {
              type: "final",
            },
          },
        },
      },
      on: {
        CANCEL: "cancelled",
      },
      onDone: {
        target: "matched",
        actions: "recordMatch",
      },
    },
    matched: {},
    cancelled: {},
  },
});

class ShelterStore extends MobXStateMachine<ShelterStore, ShelterEvent> {
  public adoptions = 0;

  public catVisits = 0;

  public dogWalks = 0;

  public lastMatch = "Pending";

  constructor() {
    super(shelterMachine);

    makeObservable(this, {
      adoptions: observable,
      catVisits: observable,
      dogWalks: observable,
      lastMatch: observable,
    });
  }

  public recordCatVisit(): void {
    this.catVisits += 1;
  }

  public recordDogWalk(): void {
    this.dogWalks += 1;
  }

  public recordMatch(): void {
    this.adoptions += 1;
    this.lastMatch = `Match ${this.adoptions}`;
  }
}

const cat = new CatStore();
const dog = new DogStore();
const shelter = new ShelterStore();

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

const formatState = (value: unknown): string => {
  if (value === undefined) {
    return "not started";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
};

const catStatus = (): string => {
  if (cat.matches("sleeping")) {
    return "Sleeping";
  }

  if (cat.matches("hungry")) {
    return cat.foodPortions > 0 ? "Hungry, food ready" : "Hungry, empty bowl";
  }

  if (cat.matches("eating")) {
    return "Eating";
  }

  if (cat.matches("playful")) {
    return "Playful";
  }

  if (cat.matches("playing")) {
    return "Playing";
  }

  if (cat.matches("grooming")) {
    return "Grooming";
  }

  return "Vet visit";
};

const dogStatus = (): string => {
  if (dog.matches("home")) {
    return "At home";
  }

  if (dog.matches("leashing")) {
    return "Leashing";
  }

  if (dog.matches("ready")) {
    return "Ready to walk";
  }

  if (dog.matches("walking")) {
    return "Walking";
  }

  if (dog.matches("thirsty")) {
    return "Needs water";
  }

  return "Resting";
};

const yesNo = (value: boolean): string => (value ? "done" : "waiting");

const render = (): void => {
  setText("[data-cat-status]", catStatus());
  setText("[data-cat-food]", cat.foodPortions);
  setText("[data-cat-meals]", cat.meals);
  setText("[data-cat-play-count]", cat.playSessions);
  setText("[data-cat-grooms]", cat.grooms);
  setText("[data-cat-vet]", cat.vetVisits);
  setText("[data-cat-note]", cat.lastNote);
  setText("[data-cat-state]", formatState(cat.state));
  setDisabled("[data-cat-feed]", !cat.matches("hungry"));
  setDisabled("[data-cat-play-button]", !cat.matches("playful"));
  setDisabled("[data-cat-groom]", !cat.matches("playful"));
  setDisabled("[data-cat-vet-button]", !cat.matches("playful"));
  setDisabled("[data-cat-home]", !cat.matches("vetVisit"));

  setText("[data-dog-status]", dogStatus());
  setText("[data-dog-steps]", dog.steps);
  setText("[data-dog-distance]", dog.distanceMeters);
  setText("[data-dog-water]", dog.waterBreaks);
  setText("[data-dog-cleanups]", dog.walkCleanups);
  setText("[data-dog-state]", formatState(dog.state));
  setDisabled("[data-dog-start]", !dog.matches("ready"));
  setDisabled("[data-dog-step]", !dog.matches("walking"));
  setDisabled("[data-dog-water-button]", !dog.matches("thirsty"));
  setDisabled("[data-dog-home]", dog.matches("home") || dog.matches("resting"));

  const catReady = shelter.matches({ screening: { cat: "approved" } });
  const dogReady = shelter.matches({ screening: { dog: "approved" } });
  const homeReady = shelter.matches({ screening: { home: "approved" } });

  setText("[data-shelter-cat]", yesNo(catReady));
  setText("[data-shelter-dog]", yesNo(dogReady));
  setText("[data-shelter-home]", yesNo(homeReady));
  setText("[data-shelter-matches]", shelter.adoptions);
  setText("[data-shelter-last]", shelter.lastMatch);
  setText("[data-shelter-state]", formatState(shelter.state));
  setDisabled("[data-shelter-cat-button]", catReady);
  setDisabled("[data-shelter-dog-button]", dogReady);
  setDisabled("[data-shelter-home-button]", homeReady);
};

const mount = (): void => {
  query<HTMLElement>("#app").innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>MobXstate</h1>
          <p>State machines for MobX stores</p>
        </div>
        <div class="status-strip">
          <span class="status-dot"></span>
          <strong>MobX</strong>
          <span>observable state</span>
        </div>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Для интерфейсов с понятными правилами</span>
          <h2>Опишите поведение котов, собак или любого продукта как конечный автомат</h2>
          <p>
            MobXstate оставляет данные, guards, delays и effects в MobX store, а
            машина описывает только состояния и переходы. Получается предсказуемый
            runtime без отдельного machine context.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-link" href="#live-examples">Попробовать примеры</a>
            <a class="btn btn-link" href="#how-it-works">Как это работает</a>
          </div>
        </div>
        <div class="hero-visual" aria-label="Pet state machine preview">
          <div class="hero-pet hero-cat"></div>
          <div class="hero-pet hero-dog"></div>
          <div class="flow-card flow-card-main">MobX Store</div>
          <div class="flow-card">createMachine</div>
          <div class="flow-card">store methods</div>
          <div class="flow-card">observable UI</div>
        </div>
      </section>

      <section class="explain-grid" id="how-it-works">
        <article class="explain-panel">
          <h2>Как это работает</h2>
          <p>
            Машина хранит только состояние процесса: спит кот, гуляет собака,
            проверяется анкета. Все счетчики, данные и методы остаются в MobX
            store. Action names вызывают методы store, guards читают getters,
            delays берутся из свойств, а <code>invoke</code> запускает lifecycle
            effect.
          </p>
          <div class="flow-row">
            <span>event</span>
            <span>transition</span>
            <span>store action</span>
            <span>MobX render</span>
          </div>
        </article>

        <article class="explain-panel">
          <h2>Как с этим работать</h2>
          <ol class="steps">
            <li>Опишите события: <code>FEED</code>, <code>WATER</code>, <code>HOME_READY</code>.</li>
            <li>Опишите состояния и переходы через <code>createMachine</code>.</li>
            <li>Реализуйте методы, getters и effects прямо в MobX store.</li>
            <li>В UI вызывайте <code>store.send(event)</code> и читайте observable state.</li>
          </ol>
        </article>

        <article class="explain-panel code-panel">
          <h2>Как должен выглядеть код</h2>
          <pre><code>class CatStore extends MobXStateMachine&lt;CatStore, CatEvent&gt; {
  get hasFood() {
    return this.foodPortions &gt; 0;
  }

  refillFood() {
    this.foodPortions += 1;
  }
}</code></pre>
        </article>
      </section>

      <section class="principles">
        <div>
          <strong>Предсказуемость</strong>
          <span>Кнопка активна только когда событие допустимо текущим состоянием.</span>
        </div>
        <div>
          <strong>Побочные эффекты рядом со store</strong>
          <span>Async invoke и callback cleanup работают через методы MobX store.</span>
        </div>
        <div>
          <strong>Совместимость с XState tooling</strong>
          <span>Конфиг остается похожим на XState и понятным для визуализации.</span>
        </div>
      </section>

      <section class="examples-intro" id="live-examples">
        <span class="eyebrow">Живые сценарии</span>
        <h2>Нажимайте действия и смотрите, как меняется state value</h2>
        <p>
          Эти примеры не симулируют UI отдельно от машины: кнопки отправляют
          события в store, guards блокируют неверные действия, delays и invokes
          переводят процесс дальше.
        </p>
      </section>

      <section class="grid">
        <article class="panel panel-wide pet-panel">
          <div class="pet-heading">
            <div class="pet-portrait cat-portrait" aria-hidden="true">
              <span></span>
            </div>
            <div>
              <h2>Cat Routine</h2>
              <div class="meter-label" data-cat-status></div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-cat-wake>Wake</button>
            <button class="btn" data-cat-refill>Refill</button>
            <button class="btn btn-primary" data-cat-feed>Feed</button>
            <button class="btn" data-cat-play-button>Play</button>
            <button class="btn" data-cat-groom>Groom</button>
            <button class="btn" data-cat-vet-button>Vet</button>
            <button class="btn" data-cat-home>Home</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">food</span><span class="meter-value" data-cat-food></span></div>
            <div class="meter"><span class="meter-label">meals</span><span class="meter-value" data-cat-meals></span></div>
            <div class="meter"><span class="meter-label">play</span><span class="meter-value" data-cat-play-count></span></div>
            <div class="meter"><span class="meter-label">grooms</span><span class="meter-value" data-cat-grooms></span></div>
          </div>
          <div class="pill-row">
            <span class="pill">vet: <span data-cat-vet></span></span>
            <span class="pill pill-ok">note: <span data-cat-note></span></span>
          </div>
          <div class="state-line" data-cat-state></div>
        </article>

        <article class="panel panel-medium pet-panel">
          <div class="pet-heading">
            <div class="pet-portrait dog-portrait" aria-hidden="true">
              <span></span>
            </div>
            <div>
              <h2>Dog Walk</h2>
              <div class="meter-label" data-dog-status></div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-dog-leash>Leash</button>
            <button class="btn btn-primary" data-dog-start>Start</button>
            <button class="btn" data-dog-step>Step</button>
            <button class="btn" data-dog-water-button>Water</button>
            <button class="btn btn-danger" data-dog-home>Home</button>
          </div>
          <div class="stat-grid">
            <div class="meter"><span class="meter-label">steps</span><span class="meter-value" data-dog-steps></span></div>
            <div class="meter"><span class="meter-label">meters</span><span class="meter-value" data-dog-distance></span></div>
            <div class="meter"><span class="meter-label">water</span><span class="meter-value" data-dog-water></span></div>
            <div class="meter"><span class="meter-label">cleanups</span><span class="meter-value" data-dog-cleanups></span></div>
          </div>
          <div class="state-line" data-dog-state></div>
        </article>

        <article class="panel panel-wide pet-panel">
          <div class="pet-heading">
            <div class="pet-portrait shelter-portrait" aria-hidden="true">
              <span></span>
            </div>
            <div>
              <h2>Shelter Match</h2>
              <div class="meter-label">Applicant checklist</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-primary" data-shelter-cat-button>Meet cat</button>
            <button class="btn btn-primary" data-shelter-dog-button>Walk dog</button>
            <button class="btn btn-primary" data-shelter-home-button>Prepare home</button>
            <button class="btn btn-danger" data-shelter-cancel>Cancel</button>
            <button class="btn" data-shelter-restart>New case</button>
          </div>
          <div class="pill-row">
            <span class="pill">cat: <span data-shelter-cat></span></span>
            <span class="pill">dog: <span data-shelter-dog></span></span>
            <span class="pill">home: <span data-shelter-home></span></span>
            <span class="pill pill-ok">matches: <span data-shelter-matches></span></span>
            <span class="pill pill-warn">last: <span data-shelter-last></span></span>
          </div>
          <div class="state-line" data-shelter-state></div>
        </article>
      </section>
    </main>
  `;
};

const bindEvents = (): void => {
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
};

mount();
bindEvents();
autorun(render);
void Promise.all([cat.ready, dog.ready, shelter.ready]).then(render);
