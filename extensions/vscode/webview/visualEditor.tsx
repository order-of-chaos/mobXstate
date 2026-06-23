import "@xyflow/react/dist/style.css";
import "./visualEditor.css";

import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type XYPosition,
} from "@xyflow/react";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

type PanelMode = "viewer" | "visualEditor";
type UiMode = "editor" | "simulation";
type DiagnosticSeverity = "error" | "warning" | "info";
type StateNodeType = "atomic" | "compound" | "parallel" | "final" | "history";
type TransitionKind = "on" | "after" | "always" | "onDone" | "onError";

interface Diagnostic {
  readonly code?: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
}

interface GraphStateNode {
  readonly id: string;
  readonly key: string;
  readonly path: readonly string[];
  readonly parentPath?: readonly string[];
  readonly type: StateNodeType;
  readonly declaredType?: string;
  readonly initial?: string;
  readonly entryActions: readonly string[];
  readonly exitActions: readonly string[];
  readonly invokeSources: readonly string[];
}

interface GraphTransitionEdge {
  readonly id: string;
  readonly sourcePath: readonly string[];
  readonly target?: string;
  readonly targetPath?: readonly string[];
  readonly trigger: {
    readonly kind: TransitionKind;
    readonly key?: string;
    readonly invokeId?: string;
  };
  readonly actions: readonly string[];
  readonly guard?: string;
}

interface GraphModel {
  readonly id: string;
  readonly nodes: readonly GraphStateNode[];
  readonly edges: readonly GraphTransitionEdge[];
}

interface PanelPayload {
  readonly mode: PanelMode;
  readonly machine: {
    readonly id: string;
    readonly graph: GraphModel;
  };
  readonly diagnostics: readonly Diagnostic[];
  readonly layout?: {
    readonly version: 1;
    readonly positions: Readonly<Record<string, XYPosition>>;
    readonly labelPositions?: Readonly<Record<string, XYPosition>>;
  };
}

interface DraftUpdatedPayload {
  readonly type: "DRAFT_UPDATED";
  readonly graph: GraphModel;
  readonly diagnostics: readonly Diagnostic[];
  readonly exportText: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly isDirty: boolean;
  readonly error?: string;
}

interface VscodeApi {
  postMessage(message: unknown): void;
}

declare const acquireVsCodeApi: undefined | (() => VscodeApi);

interface StateFormValue {
  readonly parentPath: string;
  readonly key: string;
  readonly renameKey: string;
  readonly stateType: string;
}

interface TransitionFormValue {
  readonly sourcePath: string;
  readonly triggerKind: TransitionKind;
  readonly triggerKey: string;
  readonly target: string;
  readonly actions: string;
  readonly cond: string;
}

interface StateNodeData extends Record<string, unknown> {
  readonly node: GraphStateNode;
  readonly active: boolean;
}

interface TransitionEdgeData extends Record<string, unknown> {
  readonly transition: GraphTransitionEdge;
  readonly label: string;
  readonly labelPosition: XYPosition;
  readonly labelSize: FlowLabelSize;
  readonly sourceNodeRect: FlowNodeRect;
  readonly targetNodeRect: FlowNodeRect;
}

const stateNodeSize = {
  width: 188,
  height: 82,
};

const transitionEdgeLabelSize = {
  minWidth: 72,
  maxWidth: 204,
  height: 26,
};

interface FlowNodeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface FlowLabelSize {
  readonly width: number;
  readonly height: number;
}

type HandleSide = "top" | "right" | "bottom" | "left";

const handleSides: ReadonlyArray<{
  readonly id: HandleSide;
  readonly position: Position;
}> = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

const getVscodeApi = (): VscodeApi | undefined => {
  if (typeof acquireVsCodeApi !== "function") {
    return undefined;
  }

  return acquireVsCodeApi() as VscodeApi;
};

const readInitialPayload = (): PanelPayload => {
  const element = document.getElementById("mobxstate-payload");
  if (!element?.textContent) {
    throw new Error("MobXstate webview payload is missing.");
  }

  return JSON.parse(element.textContent) as PanelPayload;
};

const parsePath = (value: string): string[] => {
  return value
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
};

const serializePath = (path: readonly string[] | undefined): string => {
  return path && path.length > 0 ? path.join(".") : "";
};

const getNodeId = (graphId: string, path: readonly string[]): string => {
  return path.length === 0 ? graphId : `${graphId}.${path.join(".")}`;
};

const getEdgeLabel = (edge: GraphTransitionEdge): string => {
  const trigger = edge.trigger.key
    ? `${edge.trigger.kind}: ${edge.trigger.key}`
    : edge.trigger.kind;
  const guard = edge.guard ? ` if ${edge.guard}` : "";
  const actions =
    edge.actions.length > 0 ? ` / ${edge.actions.join(", ")}` : "";

  return `${trigger}${guard}${actions}`;
};

const getRenderedGraphNodes = (graph: GraphModel): readonly GraphStateNode[] => {
  const states = graph.nodes.filter((node) => node.path.length > 0);
  return states.length > 0 ? states : graph.nodes;
};

const getDefaultNodePositions = (
  graph: GraphModel,
): Record<string, XYPosition> => {
  const renderedStates = getRenderedGraphNodes(graph);
  const rows = new Map<number, GraphStateNode[]>();

  renderedStates.forEach((node) => {
    const depth = Math.max(1, node.path.length);
    rows.set(depth, [...(rows.get(depth) ?? []), node]);
  });

  const positions: Record<string, XYPosition> = {};

  renderedStates.forEach((node) => {
    const depth = Math.max(1, node.path.length);
    const row = rows.get(depth) ?? [];
    const index = row.findIndex((rowNode) => rowNode.id === node.id);
    const offset = depth % 2 === 0 ? 72 : 0;

    positions[node.id] = {
      x: 120 + offset + Math.max(index, 0) * 260,
      y: 110 + (depth - 1) * 160,
    };
  });

  return positions;
};

const getNodeCenter = (position: XYPosition): XYPosition => {
  return {
    x: position.x + stateNodeSize.width / 2,
    y: position.y + stateNodeSize.height / 2,
  };
};

const getNodeRect = (position: XYPosition): FlowNodeRect => {
  return {
    x: position.x,
    y: position.y,
    width: stateNodeSize.width,
    height: stateNodeSize.height,
  };
};

const getRectCenter = (rect: FlowNodeRect): XYPosition => {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const getHandlePair = (
  sourcePosition: XYPosition,
  targetPosition: XYPosition,
): { readonly sourceHandle: HandleSide; readonly targetHandle: HandleSide } => {
  const sourceCenter = getNodeCenter(sourcePosition);
  const targetCenter = getNodeCenter(targetPosition);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return {
      sourceHandle: "right",
      targetHandle: "right",
    };
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  }

  return dy >= 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
};

const getTransitionEndpoints = (
  graph: GraphModel,
  edge: GraphTransitionEdge,
  layoutPositions: Readonly<Record<string, XYPosition>>,
  nodeIds: ReadonlySet<string>,
):
  | {
      readonly source: string;
      readonly target: string;
      readonly sourcePosition: XYPosition;
      readonly targetPosition: XYPosition;
    }
  | undefined => {
  const source = getNodeId(graph.id, edge.sourcePath);
  const target = edge.targetPath
    ? getNodeId(graph.id, edge.targetPath)
    : source;
  const sourcePosition = layoutPositions[source];
  const targetPosition = layoutPositions[target];

  if (
    !nodeIds.has(source) ||
    !nodeIds.has(target) ||
    !sourcePosition ||
    !targetPosition
  ) {
    return undefined;
  }

  return {
    source,
    target,
    sourcePosition,
    targetPosition,
  };
};

const getDefaultTransitionLabelPositions = (
  graph: GraphModel,
  positions: Readonly<Record<string, XYPosition>>,
): Record<string, XYPosition> => {
  const defaultPositions = getDefaultNodePositions(graph);
  const layoutPositions = {
    ...defaultPositions,
    ...positions,
  };
  const nodeIds = new Set(Object.keys(defaultPositions));
  const pairCounts = new Map<string, number>();
  const labelPositions: Record<string, XYPosition> = {};

  graph.edges.forEach((edge) => {
    const endpoints = getTransitionEndpoints(
      graph,
      edge,
      layoutPositions,
      nodeIds,
    );
    if (!endpoints) {
      return;
    }

    const pairKey = `${endpoints.source}->${endpoints.target}`;
    const pairIndex = pairCounts.get(pairKey) ?? 0;
    pairCounts.set(pairKey, pairIndex + 1);

    const label = getEdgeLabel(edge);
    const labelSize = getTransitionLabelSize(label);
    const sourceCenter = getNodeCenter(endpoints.sourcePosition);
    const targetCenter = getNodeCenter(endpoints.targetPosition);
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      labelPositions[edge.id] = {
        x: endpoints.sourcePosition.x + stateNodeSize.width + 28,
        y: endpoints.sourcePosition.y + pairIndex * 36,
      };
      return;
    }

    const pairOffset = pairIndex * 32;
    const isMostlyHorizontal = Math.abs(dx) >= Math.abs(dy);

    labelPositions[edge.id] = {
      x:
        (sourceCenter.x + targetCenter.x) / 2 -
        labelSize.width / 2 +
        (isMostlyHorizontal ? 0 : pairOffset),
      y:
        (sourceCenter.y + targetCenter.y) / 2 -
        labelSize.height / 2 +
        (isMostlyHorizontal ? pairOffset : 0),
    };
  });

  return labelPositions;
};

const getTransitionLabelCenter = (
  position: XYPosition,
  size: FlowLabelSize,
): XYPosition => {
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const getTransitionLabelSize = (label: string): FlowLabelSize => {
  return {
    width: clamp(
      Math.round(label.length * 6.4 + 24),
      transitionEdgeLabelSize.minWidth,
      transitionEdgeLabelSize.maxWidth,
    ),
    height: transitionEdgeLabelSize.height,
  };
};

const getNodeBoundaryAnchor = (
  rect: FlowNodeRect,
  toward: XYPosition,
): XYPosition => {
  const center = getRectCenter(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const edgeInset = 14;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? rect.x + rect.width : rect.x,
      y: clamp(toward.y, rect.y + edgeInset, rect.y + rect.height - edgeInset),
    };
  }

  return {
    x: clamp(toward.x, rect.x + edgeInset, rect.x + rect.width - edgeInset),
    y: dy >= 0 ? rect.y + rect.height : rect.y,
  };
};

const getSelfTransitionAnchors = (
  rect: FlowNodeRect,
  toward: XYPosition,
): { readonly sourceAnchor: XYPosition; readonly targetAnchor: XYPosition } => {
  const edgeInset = 18;
  const y = clamp(toward.y, rect.y + edgeInset, rect.y + rect.height - edgeInset);

  return {
    sourceAnchor: {
      x: rect.x + rect.width,
      y: clamp(y - edgeInset, rect.y + edgeInset, rect.y + rect.height - edgeInset),
    },
    targetAnchor: {
      x: rect.x + rect.width,
      y: clamp(y + edgeInset, rect.y + edgeInset, rect.y + rect.height - edgeInset),
    },
  };
};

const areRectsEqual = (first: FlowNodeRect, second: FlowNodeRect): boolean => {
  return (
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  );
};

const getElbowPoints = (
  from: XYPosition,
  to: XYPosition,
): readonly XYPosition[] => {
  if (Math.abs(from.x - to.x) < 1 || Math.abs(from.y - to.y) < 1) {
    return [from, to];
  }

  return [
    from,
    {
      x: to.x,
      y: from.y,
    },
    to,
  ];
};

const compactPathPoints = (
  points: readonly XYPosition[],
): readonly XYPosition[] => {
  return points.reduce<XYPosition[]>((result, point) => {
    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.x - point.x) < 1 &&
      Math.abs(previous.y - point.y) < 1
    ) {
      return result;
    }

    result.push(point);
    return result;
  }, []);
};

const isOrthogonalCorner = (
  previous: XYPosition,
  corner: XYPosition,
  next: XYPosition,
): boolean => {
  const incomingVertical = Math.abs(previous.x - corner.x) < 1;
  const incomingHorizontal = Math.abs(previous.y - corner.y) < 1;
  const outgoingVertical = Math.abs(corner.x - next.x) < 1;
  const outgoingHorizontal = Math.abs(corner.y - next.y) < 1;

  return (
    (incomingVertical && outgoingHorizontal) ||
    (incomingHorizontal && outgoingVertical)
  );
};

const formatCoordinate = (value: number): string => {
  return `${Math.round(value * 100) / 100}`;
};

const formatPoint = (point: XYPosition): string => {
  return `${formatCoordinate(point.x)},${formatCoordinate(point.y)}`;
};

const getRoundedOrthogonalTransitionPath = (
  points: readonly XYPosition[],
): string => {
  const compactedPoints = compactPathPoints(points);
  const first = compactedPoints[0];
  if (!first) {
    return "";
  }

  if (compactedPoints.length === 1) {
    return `M ${formatPoint(first)}`;
  }

  let path = `M ${formatPoint(first)}`;
  const cornerRadius = 10;

  for (let index = 1; index < compactedPoints.length - 1; index += 1) {
    const previous = compactedPoints[index - 1];
    const corner = compactedPoints[index];
    const next = compactedPoints[index + 1];

    if (!isOrthogonalCorner(previous, corner, next)) {
      path += ` L ${formatPoint(corner)}`;
      continue;
    }

    const incomingLength =
      Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y);
    const outgoingLength =
      Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
    const radius = Math.min(cornerRadius, incomingLength / 2, outgoingLength / 2);
    const incomingDirection = {
      x: Math.sign(corner.x - previous.x),
      y: Math.sign(corner.y - previous.y),
    };
    const outgoingDirection = {
      x: Math.sign(next.x - corner.x),
      y: Math.sign(next.y - corner.y),
    };
    const beforeCorner = {
      x: corner.x - incomingDirection.x * radius,
      y: corner.y - incomingDirection.y * radius,
    };
    const afterCorner = {
      x: corner.x + outgoingDirection.x * radius,
      y: corner.y + outgoingDirection.y * radius,
    };

    path += [
      ` L ${formatPoint(beforeCorner)}`,
      ` Q ${formatPoint(corner)} ${formatPoint(afterCorner)}`,
    ].join("");
  }

  const lastPoint = compactedPoints[compactedPoints.length - 1];
  return `${path} L ${formatPoint(lastPoint)}`;
};

const getTransitionPathThroughLabel = (
  sourceNodeRect: FlowNodeRect,
  targetNodeRect: FlowNodeRect,
  labelPosition: XYPosition,
  labelSize: FlowLabelSize,
): string => {
  const labelCenter = getTransitionLabelCenter(labelPosition, labelSize);
  const { sourceAnchor, targetAnchor } = areRectsEqual(
    sourceNodeRect,
    targetNodeRect,
  )
    ? getSelfTransitionAnchors(sourceNodeRect, labelCenter)
    : {
        sourceAnchor: getNodeBoundaryAnchor(sourceNodeRect, labelCenter),
        targetAnchor: getNodeBoundaryAnchor(targetNodeRect, labelCenter),
      };
  const sourceToLabel = getElbowPoints(sourceAnchor, labelCenter);
  const labelToTarget = getElbowPoints(labelCenter, targetAnchor);

  return getRoundedOrthogonalTransitionPath([
    ...sourceToLabel,
    ...labelToTarget.slice(1),
  ]);
};

const createInitialStateForm = (
  node: GraphStateNode | undefined,
): StateFormValue => {
  return {
    parentPath: serializePath(node?.path.slice(0, -1)),
    key: "",
    renameKey: node?.key ?? "",
    stateType: node?.declaredType ?? node?.type ?? "",
  };
};

const createInitialTransitionForm = (
  edge: GraphTransitionEdge | undefined,
): TransitionFormValue => {
  return {
    sourcePath: serializePath(edge?.sourcePath),
    triggerKind: edge?.trigger.kind ?? "on",
    triggerKey: edge?.trigger.key ?? "",
    target: edge?.target ?? "",
    actions: edge?.actions.join(", ") ?? "",
    cond: edge?.guard ?? "",
  };
};

const toFlowNodes = (
  graph: GraphModel,
  selectedNodeId: string,
  positions: Readonly<Record<string, XYPosition>>,
): Array<Node<StateNodeData>> => {
  const renderedStates = getRenderedGraphNodes(graph);
  const defaultPositions = getDefaultNodePositions(graph);

  return renderedStates.map((node) => {
    return {
      id: node.id,
      type: "stateNode",
      width: stateNodeSize.width,
      height: stateNodeSize.height,
      initialWidth: stateNodeSize.width,
      initialHeight: stateNodeSize.height,
      measured: stateNodeSize,
      position: positions[node.id] ?? defaultPositions[node.id] ?? { x: 0, y: 0 },
      data: {
        node,
        active: node.id === selectedNodeId,
      },
    };
  });
};

const toFlowEdges = (
  graph: GraphModel,
  positions: Readonly<Record<string, XYPosition>>,
  labelPositions: Readonly<Record<string, XYPosition>>,
  selectedEdgeId: string,
): Array<Edge<TransitionEdgeData>> => {
  const defaultPositions = getDefaultNodePositions(graph);
  const layoutPositions = {
    ...defaultPositions,
    ...positions,
  };
  const defaultLabelPositions = getDefaultTransitionLabelPositions(
    graph,
    positions,
  );
  const nodeIds = new Set(Object.keys(defaultPositions));

  return graph.edges.flatMap((edge): Array<Edge<TransitionEdgeData>> => {
    const endpoints = getTransitionEndpoints(
      graph,
      edge,
      layoutPositions,
      nodeIds,
    );
    if (!endpoints) {
      return [];
    }

    const handlePair = getHandlePair(
      endpoints.sourcePosition,
      endpoints.targetPosition,
    );
    const label = getEdgeLabel(edge);
    const labelSize = getTransitionLabelSize(label);
    const labelPosition =
      labelPositions[edge.id] ?? defaultLabelPositions[edge.id];

    if (!labelPosition) {
      return [];
    }

    return [
      {
        id: edge.id,
        source: endpoints.source,
        target: endpoints.target,
        sourceHandle: `source-${handlePair.sourceHandle}`,
        targetHandle: `target-${handlePair.targetHandle}`,
        type: "transitionEdge",
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        data: {
          transition: edge,
          label,
          labelPosition,
          labelSize,
          sourceNodeRect: getNodeRect(endpoints.sourcePosition),
          targetNodeRect: getNodeRect(endpoints.targetPosition),
        },
        selected: edge.id === selectedEdgeId,
      },
    ];
  });
};

const TransitionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  selected,
  data,
}: EdgeProps<Edge<TransitionEdgeData>>) => {
  const labelPosition = data?.labelPosition ?? { x: 0, y: 0 };
  const labelSize = data?.labelSize ?? {
    width: transitionEdgeLabelSize.maxWidth,
    height: transitionEdgeLabelSize.height,
  };
  const edgePath = data
    ? getTransitionPathThroughLabel(
        data.sourceNodeRect,
        data.targetNodeRect,
        labelPosition,
        labelSize,
      )
    : getRoundedOrthogonalTransitionPath([
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      ]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={[
          "transition-edge-path",
          selected ? "transition-edge-path-selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {data ? (
        <EdgeLabelRenderer>
          <div
            className={[
              "transition-edge-label",
              "nodrag",
              "nopan",
              selected ? "transition-edge-label-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-transition-edge-id={data.transition.id}
            style={{
              transform: `translate(${labelPosition.x}px, ${labelPosition.y}px)`,
              width: `${labelSize.width}px`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};

const StateNode = ({
  data,
  selected,
}: NodeProps<Node<StateNodeData, "stateNode">>) => {
  const { node, active } = data;
  const metadata = [
    node.initial ? `initial: ${node.initial}` : "",
    node.entryActions.length > 0 ? `entry: ${node.entryActions.join(", ")}` : "",
    node.invokeSources.length > 0 ? `invoke: ${node.invokeSources.join(", ")}` : "",
  ].filter(Boolean);

  return (
    <div
      className={[
        "state-node",
        `state-node-${node.type}`,
        active || selected ? "state-node-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {handleSides.map((side) => (
        <Handle
          key={`target-${side.id}`}
          id={`target-${side.id}`}
          type="target"
          position={side.position}
          className="state-node-handle state-node-handle-target"
        />
      ))}
      <div className="state-node-title">
        <span className="state-node-icon" aria-hidden="true" />
        <strong>{node.key}</strong>
      </div>
      <div className="state-node-type">{node.type}</div>
      {metadata.length > 0 ? (
        <div className="state-node-meta">
          {metadata.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {handleSides.map((side) => (
        <Handle
          key={`source-${side.id}`}
          id={`source-${side.id}`}
          type="source"
          position={side.position}
          className="state-node-handle state-node-handle-source"
        />
      ))}
    </div>
  );
};

const nodeTypes = {
  stateNode: StateNode,
};

const edgeTypes = {
  transitionEdge: TransitionEdge,
};

const VisualEditorApp = () => {
  const vscodeApi = useMemo(() => getVscodeApi(), []);
  const initialPayload = useMemo(() => readInitialPayload(), []);
  const [panelPayload, setPanelPayload] = useState<PanelPayload>(initialPayload);
  const [draft, setDraft] = useState<DraftUpdatedPayload | undefined>();
  const [uiMode, setUiMode] = useState<UiMode>("editor");
  const graph = draft?.graph ?? panelPayload.machine.graph;
  const diagnostics = draft?.diagnostics ?? panelPayload.diagnostics;
  const hasDiagnostics = diagnostics.length > 0 || Boolean(draft?.error);
  const [selectedNodeId, setSelectedNodeId] = useState(
    graph.nodes.find((node) => node.path.length > 0)?.id ?? graph.nodes[0]?.id ?? "",
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState(graph.edges[0]?.id ?? "");
  const [nodePositions, setNodePositions] = useState<Record<string, XYPosition>>(
    () => ({ ...(initialPayload.layout?.positions ?? {}) }),
  );
  const [labelPositions, setLabelPositions] = useState<Record<string, XYPosition>>(
    () => ({ ...(initialPayload.layout?.labelPositions ?? {}) }),
  );

  const selectedNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const selectedEdge =
    graph.edges.find((edge) => edge.id === selectedEdgeId) ?? graph.edges[0];
  const [stateForm, setStateForm] = useState(() =>
    createInitialStateForm(selectedNode),
  );
  const [transitionForm, setTransitionForm] = useState(() =>
    createInitialTransitionForm(selectedEdge),
  );

  const postLayoutUpdated = (
    positions: Readonly<Record<string, XYPosition>>,
    nextLabelPositions: Readonly<Record<string, XYPosition>>,
  ) => {
    vscodeApi?.postMessage({
      type: "LAYOUT_UPDATED",
      positions,
      labelPositions: nextLabelPositions,
    });
  };

  const selectTransitionEdge = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    const modelEdge = graph.edges.find((edge) => edge.id === edgeId);
    const sourceNode = modelEdge
      ? graph.nodes.find(
          (graphNode) =>
            graphNode.id === getNodeId(graph.id, modelEdge.sourcePath),
        )
      : undefined;
    if (sourceNode) {
      setSelectedNodeId(sourceNode.id);
    }
  };

  const moveTransitionLabel = (edgeId: string, position: XYPosition) => {
    setLabelPositions((current) => ({
      ...current,
      [edgeId]: position,
    }));
  };

  const commitTransitionLabel = (edgeId: string, position: XYPosition) => {
    const nextLabelPositions = {
      ...labelPositions,
      [edgeId]: position,
    };
    setLabelPositions(nextLabelPositions);
    postLayoutUpdated(nodePositions, nextLabelPositions);
  };

  const canEdit = panelPayload.mode === "visualEditor" && uiMode === "editor";
  const defaultLabelPositions = useMemo(
    () => getDefaultTransitionLabelPositions(graph, nodePositions),
    [graph, nodePositions],
  );

  useEffect(() => {
    const getLabelPosition = (edgeId: string): XYPosition | undefined => {
      return labelPositions[edgeId] ?? defaultLabelPositions[edgeId];
    };
    const screenToFlowPosition = (clientX: number, clientY: number): XYPosition => {
      const pane = document.querySelector<HTMLElement>(".react-flow__pane");
      const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
      const paneRect = pane?.getBoundingClientRect();
      const transform = viewport
        ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform)
        : new DOMMatrixReadOnly();
      const scaleX = transform.a || 1;
      const scaleY = transform.d || 1;

      return {
        x: (clientX - (paneRect?.left ?? 0) - transform.m41) / scaleX,
        y: (clientY - (paneRect?.top ?? 0) - transform.m42) / scaleY,
      };
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".transition-edge-label")
          : undefined;
      const edgeId = target?.dataset.transitionEdgeId;
      if (event.button !== 0 || !edgeId) {
        return;
      }

      const currentPosition = getLabelPosition(edgeId);
      if (!currentPosition) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      selectTransitionEdge(edgeId);

      if (!canEdit) {
        return;
      }

      const start = screenToFlowPosition(event.clientX, event.clientY);
      const offset = {
        x: start.x - currentPosition.x,
        y: start.y - currentPosition.y,
      };
      let latestPosition = currentPosition;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        moveEvent.stopImmediatePropagation();
        const flowPosition = screenToFlowPosition(
          moveEvent.clientX,
          moveEvent.clientY,
        );
        latestPosition = {
          x: flowPosition.x - offset.x,
          y: flowPosition.y - offset.y,
        };
        moveTransitionLabel(edgeId, latestPosition);
      };
      const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        upEvent.stopImmediatePropagation();
        window.removeEventListener("mousemove", handleMouseMove, true);
        window.removeEventListener("mouseup", handleMouseUp, true);
        commitTransitionLabel(edgeId, latestPosition);
      };

      window.addEventListener("mousemove", handleMouseMove, true);
      window.addEventListener("mouseup", handleMouseUp, true);
    };

    window.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [
    canEdit,
    commitTransitionLabel,
    defaultLabelPositions,
    labelPositions,
    moveTransitionLabel,
    selectTransitionEdge,
  ]);

  const flowNodes = useMemo(
    () =>
      toFlowNodes(
        graph,
        selectedNode?.id ?? selectedNodeId,
        nodePositions,
      ),
    [
      graph,
      nodePositions,
      selectedNode?.id,
      selectedNodeId,
    ],
  );
  const flowEdges = useMemo(
    () =>
      toFlowEdges(
        graph,
        nodePositions,
        labelPositions,
        selectedEdge?.id ?? selectedEdgeId,
      ),
    [
      graph,
      labelPositions,
      nodePositions,
      selectedEdge?.id,
      selectedEdgeId,
    ],
  );

  useEffect(() => {
    const listener = (event: MessageEvent<PanelPayload | DraftUpdatedPayload>) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if ("type" in message && message.type === "DRAFT_UPDATED") {
        setDraft(message);
        return;
      }

      if ("machine" in message && "mode" in message) {
        setPanelPayload(message);
        if (message.layout?.positions) {
          setNodePositions({ ...message.layout.positions });
        }
        if (message.layout?.labelPositions) {
          setLabelPositions({ ...message.layout.labelPositions });
        }
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    const hasSelectedNode = graph.nodes.some((node) => node.id === selectedNodeId);
    if (!hasSelectedNode) {
      setSelectedNodeId(
        graph.nodes.find((node) => node.path.length > 0)?.id ??
          graph.nodes[0]?.id ??
          "",
      );
    }

    const hasSelectedEdge = graph.edges.some((edge) => edge.id === selectedEdgeId);
    if (!hasSelectedEdge) {
      setSelectedEdgeId(graph.edges[0]?.id ?? "");
    }
  }, [graph, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    setStateForm(createInitialStateForm(selectedNode));
  }, [selectedNode?.id]);

  useEffect(() => {
    setTransitionForm(createInitialTransitionForm(selectedEdge));
  }, [selectedEdge?.id]);

  const postDraftCommand = (command: string, params?: unknown) => {
    vscodeApi?.postMessage({
      type: "DRAFT_COMMAND",
      command,
      params,
    });
  };

  const updateStateForm = (patch: Partial<StateFormValue>) => {
    setStateForm((current) => ({ ...current, ...patch }));
  };

  const updateTransitionForm = (patch: Partial<TransitionFormValue>) => {
    setTransitionForm((current) => ({ ...current, ...patch }));
  };

  const onNodesChange = (changes: Array<NodeChange<Node<StateNodeData>>>) => {
    if (!canEdit) {
      return;
    }

    const nextNodes = applyNodeChanges(changes, flowNodes);
    setNodePositions((current) => {
      const next = { ...current };
      nextNodes.forEach((node) => {
        next[node.id] = node.position;
      });
      return next;
    });
  };

  return (
    <main
      className="shell"
      data-mobxstate-devtools-ui="vscode-webview"
      data-panel-mode={panelPayload.mode}
      data-ui-mode={uiMode}
    >
      <header className="topbar">
        <div className="machine-title">
          <h1>MobXstate Devtools</h1>
          <span>{panelPayload.machine.id}</span>
        </div>
        <div className="mode-tabs" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={uiMode === "editor"}
            onClick={() => setUiMode("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={uiMode === "simulation"}
            onClick={() => setUiMode("simulation")}
          >
            Simulation
          </button>
        </div>
      </header>

      <section className="graph-workspace">
        <section className="graph-pane" data-testid="state-graph">
          <div className="graph-topbar">
            <div>
              <strong>{graph.id}</strong>
              <span>{uiMode === "editor" ? "Editor" : "Simulation"}</span>
            </div>
            <div className="editor-toolbar" data-testid="editor-toolbar">
              <button
                type="button"
                data-editor-command="undo"
                disabled={!canEdit || !draft?.canUndo}
                onClick={() => postDraftCommand("undo")}
              >
                Undo
              </button>
              <button
                type="button"
                data-editor-command="redo"
                disabled={!canEdit || !draft?.canRedo}
                onClick={() => postDraftCommand("redo")}
              >
                Redo
              </button>
            </div>
          </div>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            minZoom={0.2}
            maxZoom={1.8}
            nodesDraggable={canEdit}
            nodesConnectable={false}
            elementsSelectable
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, node) => {
              if (!canEdit) {
                return;
              }

              const nextPositions = {
                ...nodePositions,
                [node.id]: node.position,
              };
              setNodePositions(nextPositions);
              postLayoutUpdated(nextPositions, labelPositions);
            }}
            panOnDrag={true}
            selectionOnDrag={false}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId("");
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              const sourceNode = graph.nodes.find((node) => {
                const modelEdge = graph.edges.find(
                  (graphEdge) => graphEdge.id === edge.id,
                );
                return modelEdge
                  ? node.id === getNodeId(graph.id, modelEdge.sourcePath)
                  : false;
              });
              if (sourceNode) {
                setSelectedNodeId(sourceNode.id);
              }
            }}
          >
            <Background color="var(--grid-line)" gap={18} size={1} />
            <MiniMap
              pannable
              zoomable
              nodeColor="var(--minimap-node)"
              maskColor="var(--minimap-mask)"
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </section>

        <aside className="inspector-pane">
          <div className="panel-status">
            {draft?.isDirty ? <span className="status-pill">Draft</span> : null}
            {hasDiagnostics ? <span className="status-pill warning">Issues</span> : null}
          </div>

          <form
            className="editor-form"
            data-testid="state-inspector-form"
            onSubmit={(event) => {
              event.preventDefault();
              postDraftCommand("addState", {
                parentPath: parsePath(stateForm.parentPath),
                key: stateForm.key.trim(),
              });
            }}
          >
            <h2>State</h2>
            <label>
              Parent path
              <input
                value={stateForm.parentPath}
                onChange={(event) =>
                  updateStateForm({ parentPath: event.target.value })
                }
                placeholder="checkout.payment"
                disabled={!canEdit}
              />
            </label>
            <label>
              State key
              <input
                value={stateForm.key}
                onChange={(event) => updateStateForm({ key: event.target.value })}
                placeholder="loading"
                disabled={!canEdit}
              />
            </label>
            <label>
              Rename selected to
              <input
                value={stateForm.renameKey}
                onChange={(event) =>
                  updateStateForm({ renameKey: event.target.value })
                }
                placeholder="pending"
                disabled={!canEdit || !selectedNode}
              />
            </label>
            <label>
              State type
              <select
                value={stateForm.stateType}
                onChange={(event) =>
                  updateStateForm({ stateType: event.target.value })
                }
                disabled={!canEdit || !selectedNode}
              >
                <option value="">auto</option>
                <option value="atomic">atomic</option>
                <option value="compound">compound</option>
                <option value="parallel">parallel</option>
                <option value="final">final</option>
                <option value="history">history</option>
              </select>
            </label>
            <div className="form-actions">
              <button
                type="submit"
                data-editor-command="addState"
                disabled={!canEdit}
              >
                Add state
              </button>
              <button
                type="button"
                data-editor-command="renameState"
                disabled={!canEdit || !selectedNode}
                onClick={() =>
                  selectedNode &&
                  postDraftCommand("renameState", {
                    path: selectedNode.path,
                    newKey: stateForm.renameKey.trim(),
                  })
                }
              >
                Rename
              </button>
              <button
                type="button"
                data-editor-command="removeState"
                disabled={!canEdit || !selectedNode || selectedNode.path.length === 0}
                onClick={() =>
                  selectedNode &&
                  postDraftCommand("removeState", { path: selectedNode.path })
                }
              >
                Remove
              </button>
              <button
                type="button"
                data-editor-command="setStateType"
                disabled={!canEdit || !selectedNode}
                onClick={() =>
                  selectedNode &&
                  postDraftCommand("setStateType", {
                    path: selectedNode.path,
                    type: stateForm.stateType,
                  })
                }
              >
                Set type
              </button>
            </div>
          </form>

          <form
            className="editor-form"
            data-testid="transition-inspector-form"
            onSubmit={(event) => {
              event.preventDefault();
              postDraftCommand("addTransition", {
                sourcePath: parsePath(transitionForm.sourcePath),
                trigger: {
                  kind: transitionForm.triggerKind,
                  key: transitionForm.triggerKey.trim(),
                },
                transition: {
                  target: transitionForm.target.trim(),
                  actions: transitionForm.actions.trim(),
                  cond: transitionForm.cond.trim(),
                },
              });
            }}
          >
            <h2>Transition</h2>
            <label>
              Source path
              <input
                value={transitionForm.sourcePath}
                onChange={(event) =>
                  updateTransitionForm({ sourcePath: event.target.value })
                }
                placeholder="idle"
                disabled={!canEdit}
              />
            </label>
            <div className="field-grid">
              <label>
                Trigger kind
                <select
                  value={transitionForm.triggerKind}
                  onChange={(event) =>
                    updateTransitionForm({
                      triggerKind: event.target.value as TransitionKind,
                    })
                  }
                  disabled={!canEdit}
                >
                  <option value="on">on</option>
                  <option value="after">after</option>
                  <option value="always">always</option>
                  <option value="onDone">onDone</option>
                  <option value="onError">onError</option>
                </select>
              </label>
              <label>
                Trigger key
                <input
                  value={transitionForm.triggerKey}
                  onChange={(event) =>
                    updateTransitionForm({ triggerKey: event.target.value })
                  }
                  placeholder="START"
                  disabled={!canEdit}
                />
              </label>
            </div>
            <label>
              Target
              <input
                value={transitionForm.target}
                onChange={(event) =>
                  updateTransitionForm({ target: event.target.value })
                }
                placeholder="loading"
                disabled={!canEdit}
              />
            </label>
            <div className="field-grid">
              <label>
                Actions
                <input
                  value={transitionForm.actions}
                  onChange={(event) =>
                    updateTransitionForm({ actions: event.target.value })
                  }
                  placeholder="recordStart"
                  disabled={!canEdit}
                />
              </label>
              <label>
                Guard
                <input
                  value={transitionForm.cond}
                  onChange={(event) =>
                    updateTransitionForm({ cond: event.target.value })
                  }
                  placeholder="canStart"
                  disabled={!canEdit}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                data-editor-command="addTransition"
                disabled={!canEdit}
              >
                Add transition
              </button>
              <button
                type="button"
                data-editor-command="updateTransition"
                disabled={!canEdit || !selectedEdge}
                onClick={() =>
                  selectedEdge &&
                  postDraftCommand("updateTransition", {
                    edgeId: selectedEdge.id,
                    patch: {
                      target: transitionForm.target.trim(),
                      actions: transitionForm.actions.trim(),
                      cond: transitionForm.cond.trim(),
                    },
                  })
                }
              >
                Update
              </button>
              <button
                type="button"
                data-editor-command="removeTransition"
                disabled={!canEdit || !selectedEdge}
                onClick={() =>
                  selectedEdge &&
                  postDraftCommand("removeTransition", { edgeId: selectedEdge.id })
                }
              >
                Remove
              </button>
            </div>
          </form>

          {draft?.error ? <div className="diagnostic-error">{draft.error}</div> : null}
        </aside>
      </section>
    </main>
  );
};

const rootElement = document.getElementById("mobxstate-webview-root");
if (!rootElement) {
  throw new Error("MobXstate webview root is missing.");
}

createRoot(rootElement).render(<VisualEditorApp />);
