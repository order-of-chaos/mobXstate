import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
  type DoneInvokeEvent,
} from "@orderofchaos/mobxstate";

interface User {
  id: string;
  name: string;
}

type UserLoaderEvent = { type: "LOAD" } | DoneInvokeEvent<User>;

export const userLoaderMachine = createMachine<UserLoaderEvent>({
  id: "userLoader",
  predictableActionArguments: true,
  schema: {
    events: {} as UserLoaderEvent,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        LOAD: "loading",
      },
    },
    loading: {
      invoke: {
        id: "loadUser",
        src: "loadUser",
        onDone: {
          target: "success",
          actions: "setUser",
        },
      },
    },
    success: {},
  },
});

export class UserLoaderStore extends MobXStateMachine<
  UserLoaderStore,
  UserLoaderEvent
> {
  public user: User | undefined;

  constructor(private readonly nextUser: User) {
    super(userLoaderMachine);

    makeObservable(this, {
      user: observable.ref,
    });
  }

  public setUser(event: UserLoaderEvent): void {
    if (event.type === "done.invoke.loadUser") {
      this.user = event.data;
    }
  }

  public loadUser(): Promise<User> {
    return this.fetchUser();
  }

  public fetchUser = async (): Promise<User> => {
    return this.nextUser;
  };
}
