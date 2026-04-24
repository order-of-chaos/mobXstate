import type { Translations } from "@orderofchaos/ling";

export const pt = {
  LiveMarketing: {
    "Actions directly in the store": "Actions direto no store",
    "A form, CRUD screen or view without a strict lifecycle.":
      "Um formulário, tela CRUD ou view sem lifecycle rígido.",
    "A MobX app where workflows should be explicit and testable.":
      "Uma aplicação MobX em que workflows precisam ser explícitos e testáveis.",
    "A named action is resolved as a MobX store method first and runs inside a MobX transaction.":
      "Uma named action é resolvida primeiro como método do MobX store e executa dentro de uma transação MobX.",
    "A simple serializable transition model without MobX store methods.":
      "Um modelo de transição serializável simples, sem métodos do MobX store.",
    Approach: "Abordagem",
    "Approach comparison": "Comparação de abordagens",
    "Async lifecycle, guards and cleanup usually have to be specified manually.":
      "Async lifecycle, guards e cleanup normalmente precisam ser definidos manualmente.",
    "Buttons send typed events, guards block invalid transitions, delays move the process by timer, invoke starts a lifecycle effect with cleanup, parallel state completes the checklist, and sprite tiles show the current state without manual synchronization.":
      "Botões enviam eventos tipados, guards bloqueiam transições inválidas, delays movem o processo por timer, invoke inicia um lifecycle effect com cleanup, parallel state conclui o checklist e sprite tiles mostram o estado atual sem sincronização manual.",
    "Call <code>store.send(event)</code>, check <code>store.matches(...)</code>, show <code>store.state</code>.":
      "Chame <code>store.send(event)</code>, verifique <code>store.matches(...)</code>, mostre <code>store.state</code>.",
    "Cats, dogs and adoption flow show the entire runtime in action":
      "Gatos, cães e adoption flow mostram todo o runtime em ação",
    "Complex processes often spread across flags and imperative checks.":
      "Processos complexos frequentemente se espalham por flags e checks imperativos.",
    "Connect the UI": "Conecte a UI",
    "Current states": "Estados atuais",
    "Describe events and the statechart": "Descreva eventos e o statechart",
    Documentation: "Documentação",
    "Documentation on one page": "Documentação em uma página",
    "Does not try to cover the entire XState runtime surface.":
      "Não tenta cobrir toda a superfície do runtime XState.",
    "Events type the inputs; config describes states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> and <code>invoke</code>.":
      "Eventos tipam as entradas; config descreve states, transitions, <code>entry</code>, <code>exit</code>, <code>after</code>, <code>always</code> e <code>invoke</code>.",
    "Explicit events and pure updates.": "Eventos explícitos e updates puros.",
    "Fewer boolean flags": "Menos flags booleanas",
    "Full actor/statechart model and a rich state machine ecosystem.":
      "Modelo completo de actors/statecharts e ecossistema rico de state machines.",
    "Guards as computed values": "Guards como computed values",
    "Guards read getters, observable properties or pure methods, so rules live next to data.":
      "Guards leem getters, observable properties ou pure methods, então as regras ficam perto dos dados.",
    "Implement behavior in the store": "Implemente o comportamento no store",
    "Instead of <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, you keep one state value with explicit transitions.":
      "Em vez de <code>isLoading</code>, <code>isReady</code>, <code>isError</code>, você mantém um state value com transições explícitas.",
    "Live scenarios": "Cenários ao vivo",
    "Methods become actions/effects, getters and boolean properties become guards, number properties become delays.":
      "Métodos viram actions/effects, getters e propriedades booleanas viram guards, propriedades numéricas viram delays.",
    "Minimal mental model": "Modelo mental mínimo",
    "MobXstate describes states and transitions as a statechart, while data, guards, delays, actions and effects stay in the familiar MobX store. It is useful for interfaces where the process matters more than a set of flags.":
      "MobXstate descreve estados e transições como um statechart, enquanto dados, guards, delays, actions e effects ficam no MobX store familiar. É útil para interfaces em que o processo importa mais do que um conjunto de flags.",
    "MobXstate does not replace every tool; it covers MobX-first workflows":
      "MobXstate não substitui todas as ferramentas; ele cobre workflows MobX-first",
    "MobX store as source of behavior": "MobX store como fonte do comportamento",
    "MobX-first state machines": "State machines MobX-first",
    "One state value chooses the right sprite tile.":
      "Um state value escolhe o sprite tile correto.",
    "Open live examples": "Abrir exemplos ao vivo",
    "Payload-aware <code>send</code> and callback contracts":
      "<code>send</code> com payload-aware e contratos de callbacks",
    "Persistence without surprises": "Persistência sem surpresas",
    "Predictable workflows without a separate machine context":
      "Workflows previsíveis sem um machine context separado",
    "Runtime checks for core machine semantics":
      "Verificações de runtime para a semântica central da máquina",
    "Saved state values are validated before restore and can be normalized through <code>transformPersistedState</code>.":
      "State values salvos são validados antes do restore e podem ser normalizados via <code>transformPersistedState</code>.",
    "Separate context/actions/effects next to MobX require an integration layer.":
      "Context/actions/effects separados ao lado do MobX exigem uma camada de integração.",
    "Simple observable models, computed values and reactive UI.":
      "Modelos observáveis simples, computed values e UI reativa.",
    "Start in 3 steps": "Começar em 3 passos",
    "Statechart + MobX store methods, typed events, observable runtime state.":
      "Statechart + métodos do MobX store, eventos tipados e estado runtime observável.",
    "Statechart controls the process, MobX store controls the data":
      "O statechart controla o processo, o MobX store controla os dados",
    "Statecharts for MobX stores": "Statecharts para stores MobX",
    "State-driven assets": "Assets guiados por estado",
    "Strict event types": "Tipos de eventos estritos",
    "Strong at": "Forte em",
    "The library is useful when UI depends on rules: an order cannot be paid before validation, a pet cannot be fed without food, and an async connection must be cleaned up when leaving a state.":
      "A biblioteca é útil quando a UI depende de regras: um pedido não pode ser pago antes da validação, um pet não pode ser alimentado sem comida, e uma conexão async deve ser limpa ao sair de um estado.",
    "The machine answers what is allowed now, the store answers what data changes. UI sends events and observes state.":
      "A máquina responde o que é permitido agora; o store responde quais dados mudam. A UI envia eventos e observa o estado.",
    "This table describes practical tradeoffs without pretending one approach is universal. If an app is already built on MobX, MobXstate adds an explicit process model without moving behavior into a separate runtime context.":
      "Esta tabela descreve tradeoffs práticos sem fingir que uma abordagem é universal. Se a aplicação já usa MobX, MobXstate adiciona um modelo de processo explícito sem mover comportamento para um runtime context separado.",
    Tradeoff: "Tradeoff",
    Typed: "Tipado",
    "Unofficial library for MobX; not affiliated with MobX, Stately or XState.":
      "Biblioteca não oficial para MobX; sem afiliação com MobX, Stately ou XState.",
    "When to choose": "Quando escolher",
    "Why it is useful": "Por que é útil",
    "XState runtime dependency": "Dependência de runtime XState",
    "You need the full XState surface or the app is built around actors.":
      "Você precisa da superfície completa do XState ou a aplicação é construída em torno de actors.",
    "<code>invoke</code> starts a store method that may return a promise, cleanup function or child machine.":
      "<code>invoke</code> inicia um método do store que pode retornar uma promise, cleanup function ou child machine.",
    "<code>send(\"RESET\")</code> works for payloadless events, while payload events require an object.":
      "<code>send(\"RESET\")</code> funciona para eventos sem payload, enquanto eventos com payload exigem um objeto.",

    Address: "Endereço",
    Approve: "Aprovar",
    "Async Loader": "Async Loader",
    "At home": "Em casa",
    "Back home": "Voltou para casa",
    Benefits: "Benefícios",
    "Bowl refilled": "Tigela reabastecida",
    Break: "Quebrar",
    Cache: "Cache",
    Cancel: "Cancelar",
    Cancelled: "Cancelado",
    Cat: "Gato",
    "Cat Routine": "Rotina do gato",
    "Checklist complete": "Checklist concluído",
    Checkout: "Checkout",
    "Checkout Flow": "Fluxo de checkout",
    "Chasing toy": "Correndo atrás do brinquedo",
    "Coat brushed": "Pelo escovado",
    Comparison: "Comparação",
    "Delayed transitions and failure state":
      "Transições atrasadas e estado de falha",
    Deliver: "Entregar",
    Demos: "Demos",
    Dog: "Cão",
    "Dog Walk": "Passeio do cão",
    Drinking: "Bebendo água",
    "Effects with cleanup": "Effects com cleanup",
    Eating: "Comendo",
    Empty: "Vazio",
    Error: "Erro",
    Fail: "Falhar",
    Feed: "Alimentar",
    "Fed and playful": "Alimentado e brincalhão",
    Found: "Encontrada",
    Groom: "Escovar",
    Grooming: "Sendo escovado",
    Home: "Casa",
    "Hungry, empty bowl": "Com fome, tigela vazia",
    "Hungry, food ready": "Com fome, comida pronta",
    Leash: "Coleira",
    Leashing: "Colocando guia",
    Load: "Carregar",
    "Lose leash": "Perder guia",
    "Lost leash": "Guia perdida",
    "Match {{count}}": "Match {{count}}",
    "Meet cat": "Conhecer gato",
    "Needs water": "Precisa de água",
    "New case": "Novo caso",
    Offline: "Offline",
    Pack: "Embalar",
    "Parallel applicant checklist": "Checklist paralelo do candidato",
    Pay: "Pagar",
    Pending: "Pendente",
    Play: "Brincar",
    Playing: "Brincando",
    Playful: "Quer brincar",
    "Prepare home": "Preparar casa",
    "Ready for a nap": "Pronto para cochilar",
    "Ready to walk": "Pronto para passear",
    Refill: "Repor",
    "Result, error, retry and cache states":
      "Estados de resultado, erro, retry e cache",
    Reset: "Resetar",
    Resting: "Descansando",
    Retry: "Tentar novamente",
    "Sequential order workflow": "Workflow sequencial de pedido",
    Shelter: "Abrigo",
    Ship: "Enviar",
    "Shelter Match": "Match de adoção",
    Sleeping: "Dormindo",
    Start: "Iniciar",
    Step: "Passo",
    Success: "Sucesso",
    Tested: "Testado",
    "Traffic Light": "Semáforo",
    Vet: "Veterinário",
    "Vet check": "Check-up veterinário",
    "Vet visit": "Consulta veterinária",
    Wake: "Acordar",
    Walking: "Passeando",
    "Walk dog": "Passear com cão",
    Water: "Água",
    cat: "gato",
    cleanups: "cleanups",
    dog: "cão",
    done: "feito",
    food: "comida",
    "green entries": "entradas no verde",
    grooms: "escovações",
    home: "casa",
    last: "último",
    matches: "matches",
    meals: "refeições",
    meters: "metros",
    note: "nota",
    paid: "pagos",
    play: "brincadeira",
    requests: "requisições",
    state: "estado",
    steps: "passos",
    vet: "vet",
    waiting: "aguardando",
    water: "água",
  },
} satisfies Translations;
