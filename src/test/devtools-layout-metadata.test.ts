import { describe, expect, it } from "vitest";

import {
  createMobxstateLayoutTextEdit,
  decodeMobxstateLayoutComment,
  encodeMobxstateLayoutComment,
  readMobxstateLayoutComment,
} from "../index";
import type { SourceRange } from "../index";

const configRange: SourceRange = {
  start: "export const machine = createMachine(".length,
  end: 0,
};

describe("devtools layout metadata", () => {
  it("encodes layout metadata into an opaque mobxstate comment", () => {
    const encoded = encodeMobxstateLayoutComment({
      positions: {
        "flow.idle": { x: 120, y: 80 },
        "flow.ready": { x: 420, y: 80 },
      },
      labelPositions: {
        "flow.idle:on:START:0": { x: 260, y: 94 },
      },
    });

    expect(encoded).toMatch(/^\/\*\* @mobxstate [A-Za-z0-9_-]+ \*\*\/$/);
    expect(decodeMobxstateLayoutComment(encoded)).toEqual({
      version: 1,
      positions: {
        "flow.idle": { x: 120, y: 80 },
        "flow.ready": { x: 420, y: 80 },
      },
      labelPositions: {
        "flow.idle:on:START:0": { x: 260, y: 94 },
      },
    });
  });

  it("creates an insert edit after the machine config opening brace", () => {
    const text = `export const machine = createMachine({
  id: "flow",
});`;
    const range = {
      ...configRange,
      end: text.lastIndexOf("}") + 1,
    };

    const edit = createMobxstateLayoutTextEdit(text, range, {
      positions: {
        "flow.idle": { x: 10, y: 20 },
      },
      labelPositions: {
        "flow.idle:on:START:0": { x: 18, y: 32 },
      },
    });
    const next = `${text.slice(0, edit.range.start)}${edit.text}${text.slice(edit.range.end)}`;
    const metadata = readMobxstateLayoutComment(next, range);

    expect(next).toContain("  /** @mobxstate ");
    expect(metadata?.positions["flow.idle"]).toEqual({
      x: 10,
      y: 20,
    });
    expect(metadata?.labelPositions?.["flow.idle:on:START:0"]).toEqual({
      x: 18,
      y: 32,
    });
  });

  it("replaces an existing layout comment", () => {
    const first = encodeMobxstateLayoutComment({
      positions: {
        "flow.idle": { x: 10, y: 20 },
      },
    });
    const text = `export const machine = createMachine({
  ${first}
  id: "flow",
});`;
    const range = {
      ...configRange,
      end: text.lastIndexOf("}") + 1,
    };

    const edit = createMobxstateLayoutTextEdit(text, range, {
      positions: {
        "flow.idle": { x: 30, y: 40 },
      },
    });
    const next = `${text.slice(0, edit.range.start)}${edit.text}${text.slice(edit.range.end)}`;

    expect(next.match(/@mobxstate/g)).toHaveLength(1);
    expect(readMobxstateLayoutComment(next, range)?.positions["flow.idle"]).toEqual({
      x: 30,
      y: 40,
    });
  });
});
