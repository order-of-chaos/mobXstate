import type { SourceRange, SourceTextEdit } from "./sourceReader";

export interface MobxstateLayoutPosition {
  readonly x: number;
  readonly y: number;
}

export interface MobxstateLayoutMetadata {
  readonly version: 1;
  readonly positions: Readonly<Record<string, MobxstateLayoutPosition>>;
  readonly labelPositions?: Readonly<Record<string, MobxstateLayoutPosition>>;
}

export interface MobxstateLayoutMetadataInput {
  readonly positions: Readonly<Record<string, MobxstateLayoutPosition>>;
  readonly labelPositions?: Readonly<Record<string, MobxstateLayoutPosition>>;
}

interface LayoutCommentMatch {
  readonly range: SourceRange;
  readonly text: string;
}

const layoutCommentPattern = /\/\*\*\s*@mobxstate\s+([A-Za-z0-9_-]+)\s*\*+\//g;

const normalizePosition = (
  position: MobxstateLayoutPosition,
): MobxstateLayoutPosition | undefined => {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return undefined;
  }

  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
};

const normalizePositionMap = (
  input: Readonly<Record<string, MobxstateLayoutPosition>> | undefined,
): Record<string, MobxstateLayoutPosition> => {
  const positions: Record<string, MobxstateLayoutPosition> = {};

  Object.entries(input ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([id, position]) => {
      const normalized = normalizePosition(position);
      if (id.length > 0 && normalized) {
        positions[id] = normalized;
      }
    });

  return positions;
};

const normalizeMetadata = (
  input: MobxstateLayoutMetadataInput,
): MobxstateLayoutMetadata => {
  const positions = normalizePositionMap(input.positions);
  const labelPositions = normalizePositionMap(input.labelPositions);

  return {
    version: 1,
    positions,
    ...(Object.keys(labelPositions).length > 0 ? { labelPositions } : {}),
  };
};

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const decodeBase64Url = (value: string): string | undefined => {
  try {
    const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(
      (4 - (value.length % 4)) % 4,
    )}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseMetadata = (value: unknown): MobxstateLayoutMetadata | undefined => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.positions)) {
    return undefined;
  }

  const readPositions = (
    positionsValue: Record<string, unknown>,
  ): Record<string, MobxstateLayoutPosition> => {
    const positions: Record<string, MobxstateLayoutPosition> = {};

    Object.entries(positionsValue).forEach(([id, position]) => {
      if (!isRecord(position)) {
        return;
      }

      const x = position.x;
      const y = position.y;
      if (typeof x !== "number" || typeof y !== "number") {
        return;
      }

      const normalized = normalizePosition({ x, y });
      if (id.length > 0 && normalized) {
        positions[id] = normalized;
      }
    });

    return positions;
  };
  const positions = readPositions(value.positions);
  const labelPositions = isRecord(value.labelPositions)
    ? readPositions(value.labelPositions)
    : {};

  return {
    version: 1,
    positions,
    ...(Object.keys(labelPositions).length > 0 ? { labelPositions } : {}),
  };
};

const findLayoutComment = (
  text: string,
  configRange: SourceRange,
): LayoutCommentMatch | undefined => {
  const body = text.slice(
    configRange.start,
    Math.min(text.length, Math.max(configRange.end, configRange.start + 64_000)),
  );
  layoutCommentPattern.lastIndex = 0;
  const match = layoutCommentPattern.exec(body);

  if (!match) {
    return undefined;
  }

  return {
    range: {
      start: configRange.start + match.index,
      end: configRange.start + match.index + match[0].length,
    },
    text: match[0],
  };
};

const findInsertIndent = (text: string, insertOffset: number): string => {
  const nextLineStart = text.indexOf("\n", insertOffset);
  if (nextLineStart < 0) {
    return "  ";
  }

  const match = /^[ \t]*/.exec(text.slice(nextLineStart + 1));
  return match?.[0] ?? "  ";
};

export const encodeMobxstateLayoutComment = (
  input: MobxstateLayoutMetadataInput,
): string => {
  const encoded = encodeBase64Url(JSON.stringify(normalizeMetadata(input)));
  return `/** @mobxstate ${encoded} **/`;
};

export const decodeMobxstateLayoutComment = (
  comment: string,
): MobxstateLayoutMetadata | undefined => {
  layoutCommentPattern.lastIndex = 0;
  const match = layoutCommentPattern.exec(comment);
  const encoded = match?.[1];
  if (!encoded) {
    return undefined;
  }

  const decoded = decodeBase64Url(encoded);
  if (!decoded) {
    return undefined;
  }

  try {
    return parseMetadata(JSON.parse(decoded));
  } catch {
    return undefined;
  }
};

export const readMobxstateLayoutComment = (
  text: string,
  configRange: SourceRange,
): MobxstateLayoutMetadata | undefined => {
  const match = findLayoutComment(text, configRange);
  return match ? decodeMobxstateLayoutComment(match.text) : undefined;
};

export const createMobxstateLayoutTextEdit = (
  text: string,
  configRange: SourceRange,
  input: MobxstateLayoutMetadataInput,
): SourceTextEdit => {
  const nextComment = encodeMobxstateLayoutComment(input);
  const existing = findLayoutComment(text, configRange);

  if (existing) {
    return {
      range: existing.range,
      text: nextComment,
    };
  }

  const insertOffset = configRange.start + 1;
  const indent = findInsertIndent(text, insertOffset);

  return {
    range: {
      start: insertOffset,
      end: insertOffset,
    },
    text: `\n${indent}${nextComment}`,
  };
};
