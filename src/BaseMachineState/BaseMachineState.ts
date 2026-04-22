import { action, computed, makeObservable, observable } from "mobx";
import { match as tsMatch } from "ts-pattern";

import type {
  EventObject,
  Machine,
  MachineOptions,
  MachineStateValue,
  TypegenConstraint,
  TypegenDisabled,
  TypegenMeta,
} from "./stateMachine";
import {
  createMachineActor,
  MachineActorStatus,
  type MachineActor,
  type MachineSnapshot,
} from "./runtime";

type MatchesState<Typegen extends TypegenConstraint> =
  Typegen extends TypegenMeta ? Typegen["matchesStates"] : MachineStateValue;

export interface MachinePersistenceConfig {
  persistentKey?: string;
}

export interface MachineStateConfig extends MachinePersistenceConfig {
  stopped?: boolean;
  devTools?: boolean;
  deferStart?: boolean;
  strict?: boolean;
}

export interface IMachineState<
  Scope extends object,
  Event extends EventObject,
  Typegen extends TypegenConstraint = TypegenDisabled,
> {
  readonly machineScope?: Scope;
  state: MachineStateValue | undefined;
  snapshot: MachineSnapshot<Event> | undefined;
  ready: Promise<MachineActorStatus | undefined>;

  send(event: Event | Event["type"]): void;

  matches(state: MatchesState<Typegen>): boolean;
  matchState: ReturnType<typeof tsMatch<MatchesState<Typegen>>>;
  stopMachine: () => void;
  startMachine: (
    state?: MachineStateValue,
  ) => Promise<MachineActorStatus | undefined>;
  restart: () => Promise<MachineActorStatus | undefined>;
  addDisposer: (cb: () => void) => void;
}

class MachinesStorageAdapter {
  private readonly memory = new Map<string, unknown>();

  constructor(private readonly namespace: string) {}

  public getItem<Value>(key: string): Value | undefined {
    const storage = this.getStorage();
    if (!storage) {
      return this.memory.get(key) as Value | undefined;
    }

    const rawValue = storage.getItem(this.namespace);
    if (!rawValue) {
      return undefined;
    }

    try {
      const data = JSON.parse(rawValue) as Record<string, Value>;
      return data[key];
    } catch {
      return undefined;
    }
  }

  public setItem<Value>(key: string, value: Value): void {
    const storage = this.getStorage();
    if (!storage) {
      this.memory.set(key, value);
      return;
    }

    let data: Record<string, Value> = {};
    const rawValue = storage.getItem(this.namespace);

    if (rawValue) {
      try {
        data = JSON.parse(rawValue) as Record<string, Value>;
      } catch {
        data = {};
      }
    }

    data[key] = value;
    storage.setItem(this.namespace, JSON.stringify(data));
  }

  private getStorage(): Storage | undefined {
    return typeof globalThis.localStorage === "undefined"
      ? undefined
      : globalThis.localStorage;
  }
}

export const MachinesStorage = new MachinesStorageAdapter("MachinesStorage");

const defer = (): Promise<void> => {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return new Promise((resolve) => {
      globalThis.requestAnimationFrame(() => resolve());
    });
  }

  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
};

const isMachineOptions = <
  Scope,
  Event extends EventObject,
  Typegen extends TypegenConstraint,
>(
  value: MachineOptions<Scope, Event, Typegen> | MachineStateConfig | undefined,
): value is MachineOptions<Scope, Event, Typegen> => {
  if (!value) {
    return false;
  }

  return (
    "actions" in value ||
    "guards" in value ||
    "effects" in value ||
    "services" in value ||
    "delays" in value ||
    "activities" in value
  );
};

export class MobXStateMachine<
    Scope extends object,
    Event extends EventObject,
    Typegen extends TypegenConstraint = TypegenDisabled,
  >
  implements IMachineState<Scope, Event, Typegen>
{
  public state: MachineStateValue | undefined;

  public snapshot: MachineSnapshot<Event> | undefined;

  public ready: Promise<MachineActorStatus | undefined> =
    Promise.resolve(undefined);

  private actor: MachineActor<Scope, Event, Typegen> | undefined;

  private readonly machineOptions?: MachineOptions<Scope, Event, Typegen>;

  private readonly config?: MachineStateConfig;

  private readonly disposes: Array<() => void> = [];

  private isStarted = false;

  constructor(
    private readonly machine: Machine<Event, Typegen>,
    optionsOrConfig?: MachineOptions<Scope, Event, Typegen> | MachineStateConfig,
    config?: MachineStateConfig,
  ) {
    this.machineOptions = isMachineOptions(optionsOrConfig)
      ? optionsOrConfig
      : undefined;
    this.config = isMachineOptions(optionsOrConfig) ? config : optionsOrConfig;
    this.state = undefined;
    this.snapshot = undefined;

    makeObservable<
      this,
      "setState" | "setSnapshot" | "setReady" | "onStateChange"
    >(this, {
      state: observable.ref,
      snapshot: observable.ref,
      ready: observable.ref,
      setState: action,
      setSnapshot: action,
      setReady: action,
      onStateChange: action,
      matchState: computed,
    });

    if (!this.config?.stopped) {
      this.setReady(this.init());
    }
  }

  public addDisposer = (cb: () => void): void => {
    this.disposes.push(cb);
  };

  public onStop: () => void = () => undefined;

  protected init = async (
    state?: MachineStateValue,
  ): Promise<MachineActorStatus | undefined> => {
    const actor = createMachineActor(
      this.machine,
      this.machineOptions,
      this as unknown as Scope,
      undefined,
      { strict: this.config?.strict },
    );
    this.actor = actor;

    actor.onStop(() => this.onStop());

    actor.subscribe((newState) => {
      this.setSnapshot(newState);
    });

    if (this.config?.deferStart !== false) {
      await defer();
    }

    const initialState = this.getInitialState(state);
    this.isStarted = true;
    return actor.start(initialState);
  };

  public send = (event: Event | Event["type"]): void => {
    this.actor?.send(event);
  };

  public matches = (state: MatchesState<Typegen>): boolean => {
    return this.snapshot?.matches(state as MachineStateValue) ?? false;
  };

  get matchState(): ReturnType<typeof tsMatch<MatchesState<Typegen>>> {
    return tsMatch<MatchesState<Typegen>>(
      this.state as MatchesState<Typegen>,
    );
  }

  public stopMachine = (): void => {
    if (this.actor?.status === MachineActorStatus.Running) {
      this.actor.stop();
      this.actor = undefined;
      this.isStarted = false;
      this.disposes.forEach((cb) => cb());
      this.disposes.length = 0;
    }
  };

  public startMachine = async (
    state?: MachineStateValue,
  ): Promise<MachineActorStatus | undefined> => {
    if (
      this.actor === undefined ||
      this.actor.status !== MachineActorStatus.Running
    ) {
      this.setReady(this.init(state));
    }

    return this.ready;
  };

  public restart = async (): Promise<MachineActorStatus | undefined> => {
    this.stopMachine();
    return this.startMachine();
  };

  private setState = (value: MachineStateValue): void => {
    this.state = value;
    this.onStateChange(value);
  };

  private setSnapshot = (value: MachineSnapshot<Event>): void => {
    this.snapshot = value;
    this.setState(value.value);
  };

  private setReady = (
    value: Promise<MachineActorStatus | undefined>,
  ): void => {
    this.ready = value;
  };

  private onStateChange = (state: MachineStateValue) => {
    if (!this.config?.persistentKey) {
      return;
    }

    if (!this.isStarted) {
      return;
    }

    MachinesStorage.setItem(this.storageKey, state);
  };

  private getInitialState(
    state?: MachineStateValue,
  ): MachineStateValue | undefined {
    if (!this.config?.persistentKey) {
      return state;
    }

    return (
      state ??
      MachinesStorage.getItem<MachineStateValue>(this.storageKey)
    );
  }

  private get storageKey(): string {
    return `${this.config?.persistentKey ?? "default"}-${this.machine.id}`;
  }
}

export { MobXStateMachine as BaseMachineState };
