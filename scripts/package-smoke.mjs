import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCache = path.join(os.tmpdir(), "mobxstate-package-smoke-npm-cache");

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

const readJson = async (filePath) => {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
};

const assertPackedFiles = (packInfo) => {
  const packedFiles = new Set(packInfo.files.map((file) => file.path));
  const requiredFiles = [
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.mjs",
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

const containsPackageDirectory = async (directory, packageName) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (
      entry.name === packageName &&
      path.basename(path.dirname(entryPath)) === "node_modules"
    ) {
      return true;
    }

    if (entry.name === ".bin") {
      continue;
    }

    if (await containsPackageDirectory(entryPath, packageName)) {
      return true;
    }
  }

  return false;
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
          mobx: fileDependency(path.join(repoRoot, "node_modules", "mobx")),
          mobxstate: fileDependency(tarballPath),
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
    `import { MobXStateMachine, createMachine } from "mobxstate";

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
    `const { MobXStateMachine, createMachine } = require("mobxstate");

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
    path.join(consumerRoot, "types.ts"),
    `import {
  MobXStateMachine,
  createMachine,
  type MachineOptions,
  type MachineSendEvent,
} from "mobxstate";

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
        },
        include: ["types.ts"],
      },
      null,
      2,
    )}\n`,
  );
};

const main = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mobxstate-smoke-"));
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
    run(
      process.execPath,
      [
        path.join(consumerRoot, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        path.join(consumerRoot, "tsconfig.json"),
      ],
      { cwd: consumerRoot },
    );

    const installedPackage = await readJson(
      path.join(consumerRoot, "node_modules", "mobxstate", "package.json"),
    );
    if (
      installedPackage.dependencies?.xstate !== undefined ||
      installedPackage.peerDependencies?.xstate !== undefined
    ) {
      throw new Error("mobxstate package metadata must not depend on xstate.");
    }

    if (
      await containsPackageDirectory(
        path.join(consumerRoot, "node_modules"),
        "xstate",
      )
    ) {
      throw new Error("xstate must not be installed in the smoke project.");
    }

    console.log("Package smoke test passed.");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
