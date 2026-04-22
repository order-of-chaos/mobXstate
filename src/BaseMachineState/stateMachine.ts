export type MachineContext = undefined;

export interface EventObject {
  type: string;
}

export type Sender<Event extends EventObject> = (event: Event) => void;

export type Receiver<Event extends EventObject> = (
  listener: (event: Event) => void,
) => void;

export type MachineStateValue = string | { [key: string]: MachineStateValue };

export interface TypegenDisabled {
  "@@xstate/typegen"?: false;
}

export interface TypegenMeta {
  "@@xstate/typegen": true;
  internalEvents: object;
  invokeSrcNameMap?: object;
  missingImplementations?: object;
  eventsCausingActions: object;
  eventsCausingDelays: object;
  eventsCausingGuards: object;
  eventsCausingServices: object;
  matchesStates: MachineStateValue;
  tags?: unknown;
}

export type TypegenConstraint = TypegenDisabled | TypegenMeta;

export type DoneInvokeEvent<Data = unknown, Id extends string = string> = {
  type: `done.invoke.${Id}`;
  data: Data;
};

export interface MachineActionObject {
  type: string;
}

export interface MachineSendAction<
  Event extends EventObject = EventObject,
> extends MachineActionObject {
  type: "xstate.send";
  event: Event;
  to?: string;
  id?: string;
}

export const sendTo = <Event extends EventObject>(
  event: Event,
  options: { to?: string } = {},
): MachineSendAction<Event> => {
  return {
    type: "xstate.send",
    event,
    ...(options.to === undefined ? {} : { to: options.to }),
    id: event.type,
  };
};

export interface MachineActionMeta<
  Event extends EventObject,
  Action extends MachineActionObject = MachineActionObject,
> {
  action: Action;
  event: Event;
}

export interface MachineGuardMeta<Event extends EventObject> {
  cond: string | MachineActionObject;
  event: Event;
}

export interface MachineEffectMeta {
  src: string;
}

export type MachineServiceMeta = MachineEffectMeta;

export type MachineAction<
  Scope,
  Event extends EventObject,
  Action extends MachineActionObject = MachineActionObject,
> = (this: Scope, event: Event, meta: MachineActionMeta<Event, Action>) => void;

export type MachineGuard<Scope, Event extends EventObject> = (
  this: Scope,
  event: Event,
  meta: MachineGuardMeta<Event>,
) => boolean;

export type MachineDelay<Scope, Event extends EventObject> =
  | number
  | ((this: Scope, event: Event) => number);

export type MachineEffectReturn =
  | PromiseLike<unknown>
  | RuntimeMachine
  | (() => void)
  | void;

export type MachineEffect<Scope, Event extends EventObject> = (
  this: Scope,
  event: Event,
  meta: MachineEffectMeta,
) => MachineEffectReturn;

export type MachineServiceReturn<
  Event extends EventObject,
  SentEvent extends EventObject = Event,
> =
  | PromiseLike<unknown>
  | RuntimeMachine
  | MachineInvokeCallback<Event, SentEvent>
  | void;

export type MachineService<
  Scope,
  Event extends EventObject,
  SentEvent extends EventObject = Event,
> = (
  this: Scope,
  event: Event,
  meta: MachineServiceMeta,
) => MachineServiceReturn<Event, SentEvent>;

export type MachineInvokeCallback<
  Event extends EventObject,
  SentEvent extends EventObject = Event,
> = (
  sendBack: Sender<Event>,
  receive: Receiver<SentEvent>,
) => void | (() => void);

export interface MachineActivityDefinition {
  type: string;
}

export type MachineActivity<Scope> = (
  this: Scope,
  activity: MachineActivityDefinition,
) => void | (() => void);

export type MachineActionReference =
  | string
  | MachineActionObject
  | Array<string | MachineActionObject>;

export type MachineCondition<Event extends EventObject> =
  | string
  | MachineActionObject
  | ((context: MachineContext, event: Event, meta: MachineGuardMeta<Event>) => boolean);

export interface MachineTransitionConfig<Event extends EventObject> {
  target?: string;
  actions?: MachineActionReference;
  cond?: MachineCondition<Event>;
  internal?: boolean;
  description?: string;
}

export type MachineTransition<Event extends EventObject> =
  | string
  | MachineTransitionConfig<Event>
  | Array<MachineTransitionConfig<Event>>;

export type MachineDelayTransition<Event extends EventObject> =
  | string
  | MachineTransitionConfig<Event>
  | Array<MachineTransitionConfig<Event>>;

export type MachineEntryExit = MachineActionReference;

export type MachineActivities = string | MachineActivityDefinition | Array<string | MachineActivityDefinition>;

export interface MachineInvokeConfig<Event extends EventObject> {
  id?: string;
  src: string;
  onDone?: MachineDelayTransition<Event>;
  onError?: MachineDelayTransition<Event>;
  autoForward?: boolean;
}

export type MachineInvokeReference<Event extends EventObject> =
  | string
  | MachineInvokeConfig<Event>
  | RuntimeMachine;

export interface MachineStateNodeConfig<Event extends EventObject> {
  initial?: string;
  type?: "atomic" | "compound" | "parallel" | "final" | "history" | string;
  history?: "shallow" | "deep" | boolean;
  states?: Record<string, MachineStateNodeConfig<Event>>;
  on?: Record<string, MachineTransition<Event>>;
  always?: MachineDelayTransition<Event>;
  after?: Record<string, MachineDelayTransition<Event>>;
  entry?: MachineEntryExit;
  exit?: MachineEntryExit;
  activities?: MachineActivities;
  invoke?: MachineInvokeReference<Event> | Array<MachineInvokeReference<Event>>;
  onDone?: MachineDelayTransition<Event>;
}

export interface MachineConfig<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> extends MachineStateNodeConfig<Event> {
  id: string;
  predictableActionArguments?: boolean;
  schema?: {
    events?: Event;
    context?: MachineContext;
    actions?: MachineActionObject;
    guards?: MachineActionObject;
    effects?: Record<string, unknown>;
    services?: Record<string, unknown>;
  };
  tsTypes?: Typegen;
}

export interface RuntimeMachine {
  readonly id: string;
  readonly config: unknown;
}

export interface Machine<
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> extends RuntimeMachine {
  readonly id: string;
  readonly config: MachineConfig<Event, Typegen>;
}

type TypegenInternalEvent<Typegen extends TypegenConstraint> =
  Typegen extends TypegenMeta
    ? Typegen["internalEvents"][keyof Typegen["internalEvents"]] extends EventObject
      ? Typegen["internalEvents"][keyof Typegen["internalEvents"]]
      : never
    : never;

type EventByType<
  Event extends EventObject,
  Typegen extends TypegenConstraint,
  EventType,
> = EventType extends string
  ? Extract<Event | TypegenInternalEvent<Typegen>, { type: EventType }>
  : never;

type EventForImplementation<
  Event extends EventObject,
  Typegen extends TypegenConstraint,
  EventType,
> = [EventByType<Event, Typegen, EventType>] extends [never]
  ? Event
  : EventByType<Event, Typegen, EventType>;

type MachineActionOptions<
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Typegen extends TypegenMeta
  ? {
      [Name in keyof Typegen["eventsCausingActions"] & string]?: MachineAction<
        Scope,
        EventForImplementation<
          Event,
          Typegen,
          Typegen["eventsCausingActions"][Name]
        >
      >;
    }
  : Record<string, MachineAction<Scope, Event>>;

type MachineGuardOptions<
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Typegen extends TypegenMeta
  ? {
      [Name in keyof Typegen["eventsCausingGuards"] & string]?: MachineGuard<
        Scope,
        EventForImplementation<
          Event,
          Typegen,
          Typegen["eventsCausingGuards"][Name]
        >
      >;
    }
  : Record<string, MachineGuard<Scope, Event>>;

type MachineServiceOptions<
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Typegen extends TypegenMeta
  ? {
      [Name in keyof Typegen["eventsCausingServices"] & string]?: MachineService<
        Scope,
        EventForImplementation<
          Event,
          Typegen,
          Typegen["eventsCausingServices"][Name]
        >,
        Event
      >;
    }
  : Record<string, MachineService<Scope, Event, Event>>;

type MachineEffectOptions<
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Typegen extends TypegenMeta
  ? {
      [Name in keyof Typegen["eventsCausingServices"] & string]?: MachineEffect<
        Scope,
        EventForImplementation<
          Event,
          Typegen,
          Typegen["eventsCausingServices"][Name]
        >
      >;
    }
  : Record<string, MachineEffect<Scope, Event>>;

type MachineDelayOptions<
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
> = Typegen extends TypegenMeta
  ? {
      [Name in keyof Typegen["eventsCausingDelays"] & string]?: MachineDelay<
        Scope,
        EventForImplementation<
          Event,
          Typegen,
          Typegen["eventsCausingDelays"][Name]
        >
      >;
    }
  : Record<string, MachineDelay<Scope, Event>>;

export interface MachineOptions<
  Scope = unknown,
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  actions?: MachineActionOptions<Scope, Event, Typegen>;
  guards?: MachineGuardOptions<Scope, Event, Typegen>;
  effects?: MachineEffectOptions<Scope, Event, Typegen>;
  /** @deprecated Use store methods or MachineOptions.effects for new invoke code. */
  services?: MachineServiceOptions<Scope, Event, Typegen>;
  delays?: MachineDelayOptions<Scope, Event, Typegen>;
  /** @deprecated Prefer invoke effects with cleanup functions. */
  activities?: Record<string, MachineActivity<Scope>>;
  types?: Typegen;
}

export const createMachine = <
  Event extends EventObject = EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
>(
  config: MachineConfig<Event, Typegen>,
): Machine<Event, Typegen> => {
  return {
    id: config.id,
    config,
  };
};
