import { describe, expect, it } from "vitest";

import {
  applySourceTextEdits,
  createVisualEditorSourcePatchPreview,
  readMachineConfigAst,
} from "../index";

const sourceText = `import { createMachine } from "@orderofchaos/mobxstate";

export const machine = createMachine({
  id: "patchable",
  initial: "idle",
  states: {
    idle: {},
    loading: {}
  }
});
`;

describe("devtools source patch planner", () => {
  it("previews a safe add-state editor command as a focused text edit", () => {
    const machine = readMachineConfigAst(sourceText, "file:///machine.ts").machines[0];

    const preview = createVisualEditorSourcePatchPreview(sourceText, machine!, {
      type: "DRAFT_COMMAND",
      command: "addState",
      params: {
        parentPath: [],
        key: "ready",
      },
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    expect(preview.title).toBe('Add state "ready"');
    expect(preview.edits).toHaveLength(1);
    expect(preview.previewText).toContain("ready: {}");
    expect(preview.previewText).toBe(applySourceTextEdits(sourceText, preview.edits));
    expect(preview.previewText).toContain(`states: {
    idle: {},
    loading: {},
    ready: {}
  }`);
  });
});
