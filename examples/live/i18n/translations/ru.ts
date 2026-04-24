import type { Translations } from "@orderofchaos/ling";

export const ru = {
  LiveMarketing: {
    "Actions directly in the store": "Actions прямо в store",
    "A form, CRUD screen or view without a strict lifecycle.":
      "Форма, CRUD или экран без жесткого lifecycle.",
    "A MobX app where workflows should be explicit and testable.":
      "MobX-приложение, где workflows должны быть явными и тестируемыми.",
    "A named action is resolved as a MobX store method first and runs inside a MobX transaction.":
      "Named action сначала ищется как метод MobX store и выполняется внутри MobX transaction.",
    "A simple serializable transition model without MobX store methods.":
      "Нужна простая serializable transition model без MobX store methods.",
    "Approach": "Подход",
    "Approach comparison": "Сравнение подходов",
    "Async lifecycle, guards and cleanup usually have to be specified manually.":
      "Async lifecycle, guards и cleanup обычно приходится договорить вручную.",
    "Buttons send typed events, guards block invalid transitions, delays move the process by timer, invoke starts a lifecycle effect with cleanup, parallel state completes the checklist, and sprite tiles show the current state without manual synchronization.":
      "Кнопки отправляют typed events, guards блокируют неверные переходы, delays двигают процесс по таймеру, invoke запускает lifecycle effect с cleanup, parallel state завершает checklist, а sprite tiles показывают текущее состояние без ручной синхронизации.",
    "Call <code>store.send(event)</code>, check <code>store.matches(...)</code>, show <code>store.state</code>.":
      "Вызывайте <code>store.send(event)</code>, проверяйте <code>store.matches(...)</code>, показывайте <code>store.state</code>.",
    "Cats, dogs and adoption flow show the entire runtime in action":
      "Коты, собаки и adoption flow показывают весь runtime в действии",
    "Complex processes often spread across flags and imperative checks.":
      "Сложные процессы часто расползаются по флагам и imperative checks.",
    "Connect the UI": "Подключите UI",
    "Current states": "Текущие состояния",
    "Describe events and the statechart": "Опишите события и statechart",
    "Documentation": "Документация",
    "Documentation on one page": "Документация на одной странице",
    "Does not try to cover the entire XState runtime surface.":
      "Не стремится покрыть весь XState runtime surface.",
    "Events type the inputs; config describes states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> and <code>invoke</code>.":
      "События типизируют входы, config описывает states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> и <code>invoke</code>.",
    "Explicit events and pure updates.": "Явные events и pure updates.",
    "Fewer boolean flags": "Меньше boolean-флагов",
    "Full actor/statechart model and a rich state machine ecosystem.":
      "Полная actor/statechart модель и богатая экосистема state machines.",
    "Guards as computed values": "Guards как computed",
    "Guards read getters, observable properties or pure methods, so rules live next to data.":
      "Guards читаются из getters, observable properties или pure methods, поэтому правила живут рядом с данными.",
    "Implement behavior in the store": "Реализуйте поведение в store",
    "Instead of <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, you keep one state value with explicit transitions.":
      "Вместо <code>isLoading</code>, <code>isReady</code>, <code>isError</code> хранится один state value с явными переходами.",
    "Live scenarios": "Живые сценарии",
    "Methods become actions/effects, getters and boolean properties become guards, number properties become delays.":
      "Методы становятся actions/effects, getters и boolean properties становятся guards, number properties становятся delays.",
    "Minimal mental model": "Минимальная mental model",
    "MobXstate describes states and transitions as a statechart, while data, guards, delays, actions and effects stay in the familiar MobX store. It is useful for interfaces where the process matters more than a set of flags.":
      "MobXstate описывает состояния и переходы как statechart, а данные, guards, delays, actions и effects оставляет в привычном MobX store. Это удобно для интерфейсов, где процесс важнее набора флагов.",
    "MobXstate does not replace every tool; it covers MobX-first workflows":
      "MobXstate не заменяет все инструменты, он закрывает MobX-first workflows",
    "MobX store as source of behavior": "MobX store как источник поведения",
    "MobX-first state machines": "MobX-first state machines",
    "One state value chooses the right sprite tile.":
      "Один state value выбирает нужный sprite tile.",
    "Open live examples": "Открыть живые примеры",
    "Payload-aware <code>send</code> and callback contracts":
      "Payload-aware <code>send</code> и contracts callbacks",
    "Persistence without surprises": "Persistence без сюрпризов",
    "Predictable workflows without a separate machine context":
      "Предсказуемые workflows без отдельного machine context",
    "Runtime checks for core machine semantics":
      "Runtime-проверки core machine semantics",
    "Saved state values are validated before restore and can be normalized through <code>transformPersistedState</code>.":
      "Сохраненный state value валидируется перед restore и может быть нормализован через <code>transformPersistedState</code>.",
    "Separate context/actions/effects next to MobX require an integration layer.":
      "Отдельные context/actions/effects рядом с MobX требуют integration layer.",
    "Simple observable models, computed values and reactive UI.":
      "Простые observable модели, computed values и реактивные UI.",
    "Start in 3 steps": "Начать за 3 шага",
    "Statechart + MobX store methods, typed events, observable runtime state.":
      "Statechart + MobX store methods, typed events, observable runtime state.",
    "Statechart controls the process, MobX store controls the data":
      "Statechart управляет процессом, MobX store управляет данными",
    "Statecharts for MobX stores": "Statecharts для MobX stores",
    "State-driven assets": "Assets от состояния",
    "Strict event types": "Строгие типы событий",
    "Strong at": "Силен в",
    "The library is useful when UI depends on rules: an order cannot be paid before validation, a pet cannot be fed without food, and an async connection must be cleaned up when leaving a state.":
      "Библиотека нужна там, где UI зависит от правил: заказ нельзя оплатить до проверки, питомца нельзя покормить без еды, async подключение надо закрыть при выходе из состояния.",
    "The machine answers what is allowed now, the store answers what data changes. UI sends events and observes state.":
      "Машина отвечает на вопрос \"что сейчас допустимо\", store отвечает на вопрос \"какие данные меняются\". UI отправляет события и подписывается на observable state.",
    "This table describes practical tradeoffs without pretending one approach is universal. If an app is already built on MobX, MobXstate adds an explicit process model without moving behavior into a separate runtime context.":
      "Таблица описывает практические tradeoffs без попытки объявить один подход универсальным. Если приложение уже построено на MobX, MobXstate добавляет явную модель процесса без выноса поведения в отдельный runtime context.",
    "Tradeoff": "Цена подхода",
    "Typed": "Типизировано",
    "Unofficial library for MobX; not affiliated with MobX, Stately or XState.":
      "Неофициальная библиотека для MobX; не связана с MobX, Stately или XState.",
    "When to choose": "Когда выбирать",
    "Why it is useful": "Почему это удобно",
    "XState runtime dependency": "XState runtime dependency",
    "You need the full XState surface or the app is built around actors.":
      "Нужен полный XState surface или приложение строится вокруг actors.",
    "<code>invoke</code> starts a store method that may return a promise, cleanup function or child machine.":
      "<code>invoke</code> запускает метод store, который может вернуть promise, cleanup function или child machine.",
    "<code>send(\"RESET\")</code> works for payloadless events, while payload events require an object.":
      "<code>send(\"RESET\")</code> работает для payloadless events, а событие с payload требует объект.",

    Address: "Адрес",
    Approve: "Подтвердить",
    "Async Loader": "Async Loader",
    "At home": "Дома",
    "Back home": "Вернулась домой",
    Benefits: "Преимущества",
    "Bowl refilled": "Миска наполнена",
    Break: "Сломать",
    Cache: "Кэш",
    Cancel: "Отмена",
    Cancelled: "Отменено",
    Cat: "Кот",
    "Cat Routine": "Cat Routine",
    "Checklist complete": "Checklist готов",
    Checkout: "Оформить",
    "Checkout Flow": "Checkout Flow",
    "Chasing toy": "Гоняется за игрушкой",
    "Coat brushed": "Шерсть вычесана",
    Comparison: "Сравнение",
    "Delayed transitions and failure state":
      "Delayed transitions и failure state",
    Deliver: "Доставить",
    Demos: "Демо",
    Dog: "Собака",
    "Dog Walk": "Dog Walk",
    Drinking: "Пьет воду",
    "Effects with cleanup": "Effects с cleanup",
    Eating: "Ест",
    Empty: "Пусто",
    Error: "Ошибка",
    Fail: "Сломать",
    Feed: "Покормить",
    "Fed and playful": "Сыт и хочет играть",
    Found: "Нашли",
    Groom: "Вычесать",
    Grooming: "Вычесывается",
    Home: "Домой",
    "Hungry, empty bowl": "Голоден, миска пустая",
    "Hungry, food ready": "Голоден, еда готова",
    Leash: "Поводок",
    Leashing: "Надеваем поводок",
    Load: "Загрузить",
    "Lose leash": "Потерять поводок",
    "Lost leash": "Потерян поводок",
    "Match {{count}}": "Match {{count}}",
    "Meet cat": "Познакомиться с котом",
    "Needs water": "Хочет пить",
    "New case": "Новая заявка",
    Offline: "Offline",
    Pack: "Упаковать",
    "Parallel applicant checklist": "Parallel checklist заявки",
    Pay: "Оплатить",
    Pending: "Ожидание",
    Play: "Играть",
    Playing: "Играет",
    Playful: "Просит поиграть",
    "Prepare home": "Подготовить дом",
    "Ready for a nap": "Готов поспать",
    "Ready to walk": "Готова гулять",
    Refill: "Наполнить",
    "Result, error, retry and cache states":
      "Result, error, retry и cache states",
    Reset: "Сброс",
    Resting: "Отдыхает",
    Retry: "Повторить",
    "Sequential order workflow": "Sequential order workflow",
    Shelter: "Приют",
    Ship: "Отправить",
    "Shelter Match": "Shelter Match",
    Sleeping: "Спит",
    Start: "Старт",
    Step: "Шаг",
    Success: "Успех",
    Tested: "Протестировано",
    "Traffic Light": "Светофор",
    Vet: "Ветеринар",
    "Vet check": "Ветеринарный осмотр",
    "Vet visit": "У ветеринара",
    Wake: "Разбудить",
    Walking: "Гуляет",
    "Walk dog": "Погулять с собакой",
    Water: "Вода",
    cat: "кот",
    cleanups: "cleanups",
    dog: "собака",
    done: "готово",
    food: "еда",
    "green entries": "входы в зеленый",
    grooms: "вычесывания",
    home: "дом",
    last: "последний",
    matches: "matches",
    meals: "приемы еды",
    meters: "метры",
    note: "заметка",
    paid: "оплачено",
    play: "игра",
    requests: "запросы",
    state: "состояние",
    steps: "шаги",
    vet: "ветеринар",
    waiting: "ожидание",
    water: "вода",
  },
} satisfies Translations;
