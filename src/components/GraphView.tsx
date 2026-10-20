"use client";

import "@xyflow/react/dist/style.css";
import { MarkerType, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

export type NodeKind = "client" | "interface" | "class" | "ghost";
export type NodeTone = "normal" | "good" | "bad" | "missing" | "extra" | "warn";

export interface ViewNode {
  id: string;
  kind: NodeKind;
  lines?: string[];
  tone?: NodeTone;
}

export interface ViewEdge {
  from: string;
  to: string;
  type: string;
  tone?: NodeTone;
}

const toneColour: Record<NodeTone, string> = {
  normal: "var(--line)",
  good: "var(--flow)",
  bad: "var(--fail)",
  missing: "var(--warn)",
  extra: "var(--player)",
  warn: "var(--warn)",
};

/**
 * Layered class diagram: classes that use an interface on the left, interfaces in the middle,
 * implementers on the right. Shared by the Blueprint lens and rebuild-from-memory results.
 */
export function GraphView({ nodes, edges, label, height = 340 }: { nodes: ViewNode[]; edges: ViewEdge[]; label: string; height?: number }) {
  const { rfNodes, rfEdges } = useMemo(() => layout(nodes, edges), [nodes, edges]);

  return (
    <figure className="flex flex-col gap-2">
      <div style={{ height }} className="rounded-lg border border-line bg-surface" aria-hidden="true">
        <ReactFlow
          key={nodes.map((n) => n.id).join("|")}
          nodes={rfNodes}
          edges={rfEdges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          zoomOnScroll={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          colorMode="system"
          style={{ background: "transparent" }}
        />
      </div>
      {/* Outline mode: the same model as text, for screen readers and keyboard users. */}
      <figcaption>
        <details className="text-sm text-ink-quiet">
          <summary className="cursor-pointer">Outline of {label}</summary>
          <ul className="mt-2 list-disc pl-5">
            {nodes.map((n) => (
              <li key={n.id}>
                {n.kind === "interface" ? "Interface " : "Class "}
                {n.id}
                {n.lines?.length ? `: ${n.lines.join(" ")}` : ""}
              </li>
            ))}
            {edges.map((e) => (
              <li key={`${e.from}-${e.to}`}>
                {e.from} {e.type} {e.to}
              </li>
            ))}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}

function layout(nodes: ViewNode[], edges: ViewEdge[]) {
  const targets = new Set(edges.map((e) => e.to));
  const column = (n: ViewNode) => {
    if (n.kind === "interface" || targets.has(n.id)) return 1;
    if (edges.some((e) => e.from === n.id && e.type === "uses")) return 0;
    if (edges.some((e) => e.from === n.id)) return 2;
    return n.kind === "client" ? 0 : 2;
  };
  const columns: ViewNode[][] = [[], [], []];
  for (const n of nodes) columns[column(n)].push(n);

  const rfNodes: Node[] = columns.flatMap((col, c) =>
    col.map((n, i) => {
      const colour = toneColour[n.tone ?? "normal"];
      const isInterface = n.kind === "interface";
      return {
        id: n.id,
        position: { x: c * 240, y: (i - (col.length - 1) / 2) * 84 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div style={{ textAlign: "left", fontSize: 13, lineHeight: 1.35 }}>
              {isInterface && <div style={{ opacity: 0.7, fontSize: 10 }}>«interface»</div>}
              <div style={{ fontWeight: 600 }}>{n.id}</div>
              {n.lines?.map((line) => (
                <div key={line} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, opacity: 0.85 }}>
                  {line}
                </div>
              ))}
            </div>
          ),
        },
        style: {
          width: 180,
          background: "var(--surface)",
          color: "var(--ink)",
          border: `${isInterface || n.tone === "good" ? 2 : 1}px ${n.kind === "ghost" || n.tone === "missing" ? "dashed" : "solid"} ${isInterface && !n.tone ? "var(--flow)" : colour}`,
          borderRadius: 8,
          opacity: n.kind === "ghost" ? 0.6 : 1,
        },
      };
    }),
  );

  const columnOf = new Map(columns.flatMap((col, c) => col.map((n) => [n.id, c] as const)));
  const rfEdges: Edge[] = edges.map((e) => {
    const colour = toneColour[e.tone ?? "normal"] === "var(--line)" ? "var(--ink-quiet)" : toneColour[e.tone ?? "normal"];
    const marker = { type: e.type === "implements" ? MarkerType.Arrow : MarkerType.ArrowClosed, color: colour };
    // Connectors always run left to right; when the arrow points leftwards (an implementer to its
    // interface), draw it from the target side and put the arrowhead at the start instead.
    const backwards = (columnOf.get(e.from) ?? 0) > (columnOf.get(e.to) ?? 0);
    return {
      id: `${e.from}->${e.to}`,
      source: backwards ? e.to : e.from,
      target: backwards ? e.from : e.to,
      ...(backwards ? { markerStart: marker } : { markerEnd: marker }),
      label: e.type,
      style: { stroke: colour, strokeDasharray: e.type === "implements" || e.tone === "missing" ? "6 4" : undefined },
      labelStyle: { fill: "var(--ink-quiet)", fontSize: 11 },
      labelBgStyle: { fill: "var(--surface)" },
    };
  });

  return { rfNodes, rfEdges };
}
