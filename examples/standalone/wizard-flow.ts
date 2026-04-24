import { makeObservable, observable } from "mobx";
import {
  MobXStateMachine,
  createMachine,
} from "@orderofchaos/mobxstate";

interface WizardResult {
  id: string;
}

type WizardEvent =
  | { type: "SET_EMAIL"; value: string }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "DISABLE" }
  | { type: "ENABLE" }
  | { type: "SUBMIT" }
  | { type: "done.invoke.submitWizard"; data: WizardResult }
  | { type: "error.platform.submitWizard"; data: unknown };

export const wizardMachine = createMachine<WizardEvent>({
  id: "wizard",
  predictableActionArguments: true,
  schema: {
    events: {} as WizardEvent,
  },
  initial: "form",
  states: {
    form: {
      initial: "account",
      states: {
        account: {
          on: {
            SET_EMAIL: {
              actions: "setEmail",
            },
            NEXT: {
              target: "profile",
              cond: "hasEmail",
            },
          },
        },
        profile: {
          on: {
            BACK: "account",
            NEXT: "review",
          },
        },
        review: {
          on: {
            BACK: "profile",
            SUBMIT: "#wizard.submitting",
          },
        },
        hist: {
          history: "shallow",
        },
      },
      on: {
        DISABLE: "disabled",
      },
    },
    disabled: {
      on: {
        ENABLE: "form.hist",
      },
    },
    submitting: {
      invoke: {
        id: "submitWizard",
        src: "submitWizard",
        onDone: {
          target: "success",
          actions: "setResult",
        },
        onError: {
          target: "form.review",
          actions: "setError",
        },
      },
    },
    success: {
      type: "final",
    },
  },
});

export class WizardStore extends MobXStateMachine<WizardStore, WizardEvent> {
  public email = "";

  public error = "";

  public result: WizardResult | undefined;

  constructor() {
    super(wizardMachine);

    makeObservable(this, {
      email: observable,
      error: observable,
      result: observable.ref,
    });
  }

  public get hasEmail(): boolean {
    return this.email.includes("@");
  }

  public setEmail(event: WizardEvent): void {
    if (event.type === "SET_EMAIL") {
      this.email = event.value;
    }
  }

  public setResult(event: WizardEvent): void {
    if (event.type === "done.invoke.submitWizard") {
      this.result = event.data;
    }
  }

  public setError(event: WizardEvent): void {
    if (event.type === "error.platform.submitWizard") {
      this.error = event.data instanceof Error ? event.data.message : "error";
    }
  }

  public submitWizard(): Promise<WizardResult> {
    return Promise.resolve({
      id: `wizard:${this.email}`,
    });
  }
}
