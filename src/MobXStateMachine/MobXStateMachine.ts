import {action, computed, makeObservable, observable} from "mobx";
import {match as tsMatch} from "ts-pattern";

import type {
  EventObject,
  Machine,
  MachineOptions,
  MachineSendEvent,
  MachineStateValue,
  TypegenConstraint,
  TypegenDisabled,
  TypegenMeta,
} from "./stateMachine";
import {
  createMachineActor,
  type MachineActor,
  MachineActorStatus,
  MachineCleanupError,
  type MachineSnapshot,
} from "./runtime";

type MatchesState<Typegen extends TypegenConstraint> =
  Typegen extends TypegenMeta ? Typegen["matchesStates"] : MachineStateValue;

export type MachinePersistenceVersion = string | number;

export type MachinePersistenceTransform = (
  state: MachineStateValue,
  fromVersion: MachinePersistenceVersion | undefined,
) => MachineStateValue | undefined;

export interface MachinePersistenceConfig {
  persistentKey?: string;
  version?: MachinePersistenceVersion;
  transformPersistedState?: MachinePersistenceTransform;
}

interface PersistedMachineStateRecord {
  readonly type: "mobxstate.persistence.v1";
  readonly value: MachineStateValue;
  readonly version?: MachinePersistenceVersion;
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

  send(event: MachineSendEvent<Event>): void;

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

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isPersistenceVersion = (
  value: unknown,
): value is MachinePersistenceVersion => {
  return typeof value === "string" || typeof value === "number";
};

const isMachineStateValue = (value: unknown): value is MachineStateValue => {
  if (typeof value === "string") {
    return true;
  }

  return isObjectRecord(value) && Object.values(value).every(isMachineStateValue);
};

const isPersistedMachineStateRecord = (
  value: unknown,
): value is PersistedMachineStateRecord => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const version = value.version;

  return (
    value.type === "mobxstate.persistence.v1" &&
    isMachineStateValue(value.value) &&
    (version === undefined || isPersistenceVersion(version))
  );
};

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
    "delays" in value
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

    const initialState = this.getInitialState(actor, state);
    this.isStarted = true;
    return actor.start(initialState);
  };

  public send = (event: MachineSendEvent<Event>): void => {
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
      const errors: unknown[] = [];
      let runtimeError: unknown;

      try {
        this.actor.stop();
      } catch (error) {
        if (error instanceof MachineCleanupError) {
          errors.push(...error.errors);
        } else {
          runtimeError = error;
        }
      }

      this.actor = undefined;
      this.isStarted = false;

      this.disposes.forEach((cb) => {
        try {
          cb();
        } catch (error) {
          errors.push(error);
        }
      });
      this.disposes.length = 0;

      if (errors.length > 0) {
        throw new MachineCleanupError(
          "MobXStateMachine cleanup failed.",
          runtimeError === undefined ? errors : [runtimeError, ...errors],
        );
      }

      if (runtimeError !== undefined) {
        throw runtimeError;
      }
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

    MachinesStorage.setItem(this.storageKey, this.createPersistedState(state));
  };

  private getInitialState(
    actor: MachineActor<Scope, Event, Typegen>,
    state?: MachineStateValue,
  ): MachineStateValue | undefined {
    if (state !== undefined) {
      return actor.canRestoreStateValue(state) ? state : undefined;
    }

    if (!this.config?.persistentKey) {
      return undefined;
    }

    return this.getPersistedState(actor);
  }

  private getPersistedState(
    actor: MachineActor<Scope, Event, Typegen>,
  ): MachineStateValue | undefined {
    const persistedValue = MachinesStorage.getItem<unknown>(this.storageKey);
    if (persistedValue === undefined) {
      return undefined;
    }

    const record = isPersistedMachineStateRecord(persistedValue)
      ? persistedValue
      : undefined;
    const persistedState = record?.value ?? persistedValue;
    const fromVersion = record?.version;

    if (!isMachineStateValue(persistedState)) {
      return undefined;
    }

    const restoredState = this.transformPersistedState(
      persistedState,
      fromVersion,
    );

    return restoredState !== undefined &&
      actor.canRestoreStateValue(restoredState)
      ? restoredState
      : undefined;
  }

  private transformPersistedState(
    state: MachineStateValue,
    fromVersion: MachinePersistenceVersion | undefined,
  ): MachineStateValue | undefined {
    const currentVersion = this.config?.version;

    if (fromVersion !== currentVersion) {
      if (!this.config?.transformPersistedState) {
        return currentVersion === undefined ? state : undefined;
      }

      try {
        return this.config.transformPersistedState(state, fromVersion);
      } catch {
        return undefined;
      }
    }

    return state;
  }

  private createPersistedState(
    state: MachineStateValue,
  ): MachineStateValue | PersistedMachineStateRecord {
    if (
      this.config?.version === undefined &&
      !this.config?.transformPersistedState
    ) {
      return state;
    }

    return {
      type: "mobxstate.persistence.v1",
      value: state,
      ...(this.config.version === undefined
        ? {}
        : { version: this.config.version }),
    };
  }

  private get storageKey(): string {
    return `${this.config?.persistentKey ?? "default"}-${this.machine.id}`;
  }
}
