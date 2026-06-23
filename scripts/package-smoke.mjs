import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packageName = "@orderofchaos/mobxstate";
const packageSlug = "orderofchaos-mobxstate";
const npmCache = path.join(os.tmpdir(), `${packageSlug}-package-smoke-npm-cache`);

const run = (command, args, options = {}) => {
  const { env: extraEnv, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCache,
      npm_config_update_notifier: "false",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    ...spawnOptions,
  });

  if (result.status === 0) {
    return result.stdout;
  }

  if (result.stdout) {
    process.stderr.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  throw new Error(`Command failed: ${command} ${args.join(" ")}`);
};

const fileDependency = (packagePath) => {
  return `file:${packagePath}`;
};

const assertPackedFiles = (packInfo) => {
  const packedFiles = new Set(packInfo.files.map((file) => file.path));
  const requiredFiles = [
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.mjs",
    "dist/decorators.cjs",
    "dist/decorators.d.ts",
    "dist/decorators.mjs",
    "dist/MobXStateMachine/MobXStateMachine.decorators.d.ts",
    "dist/MobXStateMachine/MobXStateMachine.d.ts",
    "dist/MobXStateMachine/index.d.ts",
    "dist/MobXStateMachine/runtime.d.ts",
    "dist/MobXStateMachine/stateMachine.d.ts",
  ];

  requiredFiles.forEach((filePath) => {
    if (!packedFiles.has(filePath)) {
      throw new Error(
        `Package tarball is missing ${filePath}. Run npm run build before npm run smoke:package.`,
      );
    }
  });
};

const writeConsumerProject = async (consumerRoot, tarballPath) => {
  await fs.mkdir(consumerRoot, { recursive: true });

  await fs.writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "mobxstate-package-smoke",
        private: true,
        type: "module",
        dependencies: {
          [packageName]: fileDependency(tarballPath),
          mobx: fileDependency(path.join(repoRoot, "node_modules", "mobx")),
          "ts-pattern": fileDependency(
            path.join(repoRoot, "node_modules", "ts-pattern"),
          ),
          typescript: fileDependency(
            path.join(repoRoot, "node_modules", "typescript"),
          ),
        },
      },
      null,
      2,
    )}\n`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "esm.mjs"),
    `import { MobXStateMachine, createMachine } from "${packageName}";

const machine = createMachine({
  id: "esmSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class Store extends MobXStateMachine {
  count = 0;

  constructor() {
    super(machine, { deferStart: false });
  }

  increment(event) {
    this.count += event.by;
  }
}

const store = new Store();
await store.ready;
store.send({ type: "INC", by: 2 });

if (!store.matches("idle") || store.count !== 2) {
  throw new Error("ESM import smoke failed.");
}
`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "cjs.cjs"),
    `const { MobXStateMachine, createMachine } = require("${packageName}");

const machine = createMachine({
  id: "cjsSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class Store extends MobXStateMachine {
  count = 0;

  constructor() {
    super(machine, { deferStart: false });
  }

  increment(event) {
    this.count += event.by;
  }
}

(async () => {
  const store = new Store();
  await store.ready;
  store.send({ type: "INC", by: 3 });

  if (!store.matches("idle") || store.count !== 3) {
    throw new Error("CJS require smoke failed.");
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "decorators-esm.mjs"),
    `import {
  MobXStateMachine,
  createMachine,
} from "${packageName}/decorators";

const machine = createMachine({
  id: "decoratorsEsmSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class Store extends MobXStateMachine {
  count = 0;

  constructor() {
    super(machine, { deferStart: false });
  }

  increment(event) {
    this.count += event.by;
  }
}

const store = new Store();
await store.ready;
store.send({ type: "INC", by: 4 });

if (!store.matches("idle") || store.count !== 4) {
  throw new Error("Decorators ESM import smoke failed.");
}
`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "decorators-cjs.cjs"),
    `const {
  MobXStateMachine,
  createMachine,
} = require("${packageName}/decorators");

const machine = createMachine({
  id: "decoratorsCjsSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class Store extends MobXStateMachine {
  count = 0;

  constructor() {
    super(machine, { deferStart: false });
  }

  increment(event) {
    this.count += event.by;
  }
}

(async () => {
  const store = new Store();
  await store.ready;
  store.send({ type: "INC", by: 5 });

  if (!store.matches("idle") || store.count !== 5) {
    throw new Error("Decorators CJS require smoke failed.");
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "types.ts"),
    `import {
  MobXStateMachine,
  createMachine,
  type MachineOptions,
  type MachineSendEvent,
} from "${packageName}";
import {
  MobXStateMachine as DecoratorMobXStateMachine,
  createMachine as createDecoratorMachine,
  type IMachineState as DecoratorMachineState,
} from "${packageName}/decorators";
import { makeObservable, observable } from "mobx";

type SmokeEvent =
  | { type: "RESET" }
  | { type: "INC"; by: number };

const machine = createMachine<SmokeEvent>({
  id: "typeSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class Store extends MobXStateMachine<Store, SmokeEvent> {
  public count = 0;

  public increment(event: SmokeEvent): void {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }
}

const decoratorMachine = createDecoratorMachine<SmokeEvent>({
  id: "decoratorTypeSmoke",
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: {
          actions: "increment",
        },
      },
    },
  },
});

class DecoratorStore extends DecoratorMobXStateMachine<
  DecoratorStore,
  SmokeEvent
> {
  @observable
  public count = 0;

  constructor() {
    super(decoratorMachine, { deferStart: false });
    makeObservable(this);
  }

  public increment(event: SmokeEvent): void {
    if (event.type === "INC") {
      this.count += event.by;
    }
  }
}

const decoratorState: DecoratorMachineState<DecoratorStore, SmokeEvent> =
  new DecoratorStore();

const options: MachineOptions<Store, SmokeEvent> = {
  actions: {
    increment(event) {
      if (event.type === "INC") {
        this.count += event.by;
      }
    },
  },
};

const resetEvent: MachineSendEvent<SmokeEvent> = "RESET";
const incEvent: MachineSendEvent<SmokeEvent> = { type: "INC", by: 1 };

// @ts-expect-error INC requires payload.
const invalidStringEvent: MachineSendEvent<SmokeEvent> = "INC";

const removedServices: MachineOptions<Store, SmokeEvent> = {
  // @ts-expect-error MachineOptions.services was removed.
  services: {},
};

createMachine<SmokeEvent>({
  id: "removedActivities",
  initial: "idle",
  states: {
    idle: {
      // @ts-expect-error state node activities were removed.
      activities: "polling",
    },
  },
});

void machine;
void options;
void resetEvent;
void incEvent;
void invalidStringEvent;
void removedServices;
void decoratorState;
`,
  );

  await fs.writeFile(
    path.join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          experimentalDecorators: true,
        },
        include: ["types.ts"],
      },
      null,
      2,
    )}\n`,
  );
};

const main = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `${packageSlug}-smoke-`));
  const consumerRoot = path.join(tempRoot, "consumer");

  try {
    const packOutput = run(
      npmCommand,
      ["pack", "--json", "--pack-destination", tempRoot],
      { cwd: repoRoot },
    );
    const [packInfo] = JSON.parse(packOutput);

    if (!packInfo) {
      throw new Error("npm pack did not return package metadata.");
    }

    assertPackedFiles(packInfo);

    const tarballPath = path.join(tempRoot, packInfo.filename);
    await writeConsumerProject(consumerRoot, tarballPath);

    run(npmCommand, ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: consumerRoot,
    });
    run(process.execPath, [path.join(consumerRoot, "esm.mjs")], {
      cwd: consumerRoot,
    });
    run(process.execPath, [path.join(consumerRoot, "cjs.cjs")], {
      cwd: consumerRoot,
    });
    run(process.execPath, [path.join(consumerRoot, "decorators-esm.mjs")], {
      cwd: consumerRoot,
    });
    run(process.execPath, [path.join(consumerRoot, "decorators-cjs.cjs")], {
      cwd: consumerRoot,
    });
    run(
      process.execPath,
      [
        path.join(consumerRoot, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        path.join(consumerRoot, "tsconfig.json"),
      ],
      { cwd: consumerRoot },
    );

    console.log("Package smoke test passed.");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
