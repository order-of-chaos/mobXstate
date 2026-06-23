declare module "vscode" {
  import type { VscodeNativeApi } from "@orderofchaos/mobxstate";

  const vscode: VscodeNativeApi;
  export = vscode;
}
