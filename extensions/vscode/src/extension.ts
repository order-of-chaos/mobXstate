import * as vscode from "vscode";
import {
  createVscodeDevtoolsExtension,
  type VscodeNativeApi,
  type VscodeNativeExtensionContext,
} from "@orderofchaos/mobxstate";

export const activate = (
  context: VscodeNativeExtensionContext,
): ReturnType<typeof createVscodeDevtoolsExtension> => {
  return createVscodeDevtoolsExtension(
    vscode as unknown as VscodeNativeApi,
    context,
  );
};

export const deactivate = (): void => {
  return undefined;
};
