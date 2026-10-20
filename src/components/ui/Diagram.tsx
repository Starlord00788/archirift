"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { layoutDiagram, type DEdge, type DNode, type DiagramKind, type DiagramTone } from "./diagramLayout";

export type { DEdge, DNode, DiagramKind, DiagramTone };

const kindColour: Partial<Record<DiagramKind, string>> = {
  interface: "var(--flow)",
  abstract: "var(--player)",
  enum: "var(--lime)",
  database: "var(--warn)",
  cache: "var(--lime)",
  queue: "var(--pink)",
  lb: "var(--flow)",
  gateway: "var(--flow)",
  cdn: "var(--good)",
  service: "var(--player)",
  worker: "var(--pink)",
  storage: "var(--warn)",
  user: "var(--ink-quiet)",
  client: "var(--ink-quiet)",
};

const toneColour: Record<DiagramTone, string | null> = {
  normal: null,
  good: "var(--good)",
  bad: "var(--fail)",
  missing: "var(--warn)",
  extra: "var(--player)",
};

const stereotype: Partial<Record<DiagramKind, string>> = {
  interface: "«interface»",
  abstract: "«abstract»",
  enum: "«enum»",
  database: "database",
  cache: "cache",
  queue: "queue",
  lb: "load balancer",
  gateway: "gateway",
  cdn: "CDN",
  service: "service",
  worker: "worker",
  storage: "object storage",
  user: "users",
  client: "client",
};

const DASHED_EDGES = new Set(["implements", "realizes", "creates", "depends", "publishes", "subscribes", "async"]);
const HOLLOW_TRIANGLE = new Set(["implements", "extends", "inherits", "is-a", "realizes"]);

/**
 * An animated SVG diagram (class or architecture). Nodes glide to new positions when the design
 * changes; new arrows draw themselves in. A text outline sits underneath for screen readers.
 */
export function Diagram({ nodes, edges, label, maxHeight = 380 }: { nodes: DNode[]; edges: DEdge[]; label: string; maxHeight?: number }) {
  const layout = useMemo(() => layoutDiagram(nodes, edges), [nodes, edges]);
  const pad = 18;
  const vw = layout.width + pad * 2;
  const vh = layout.height + pad * 2 + 10;

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line bg-surface/60 p-1">
        <svg viewBox={`${-pad} ${-pad} ${vw} ${vh}`} className="mx-auto block h-auto w-full" style={{ maxHeight }} role="img" aria-label={label}>
          <defs>
            {(["ink", "good", "bad", "missing", "extra"] as const).map((tone) => {
              const colour = tone === "ink" ? "var(--ink-quiet)" : toneColour[tone]!;
              return (
                <g key={tone}>
                  <marker id={`arrow-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke={colour} strokeWidth="1.6" />
                  </marker>
                  <marker id={`triangle-${tone}`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="var(--surface)" stroke={colour} strokeWidth="1.4" />
                  </marker>
                  <marker id={`diamond-${tone}`} viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto-start-reverse">
                    <path d="M 0 5 L 7 0 L 14 5 L 7 10 z" fill={colour} stroke={colour} strokeWidth="1" />
                  </marker>
                  <marker id={`hollow-diamond-${tone}`} viewBox="0 0 14 10" refX="1" refY="5" markerWidth="12" markerHeight="10" orient="auto-start-reverse">
                    <path d="M 0 5 L 7 0 L 14 5 L 7 10 z" fill="var(--surface)" stroke={colour} strokeWidth="1.2" />
                  </marker>
                </g>
              );
            })}
          </defs>

          <AnimatePresence>
            {layout.edges.map((e) => {
              const toneKey = e.tone && e.tone !== "normal" ? (e.tone as "good" | "bad" | "missing" | "extra") : "ink";
              const colour = toneKey === "ink" ? "var(--ink-quiet)" : toneColour[toneKey]!;
              const head = HOLLOW_TRIANGLE.has(e.type) ? `url(#triangle-${toneKey})` : `url(#arrow-${toneKey})`;
              const tail =
                e.type === "composes" || e.type === "owns"
                  ? `url(#diamond-${toneKey})`
                  : e.type === "has" || e.type === "aggregates"
                    ? `url(#hollow-diamond-${toneKey})`
                    : undefined;
              return (
                <motion.g key={`${e.from}->${e.to}:${e.type}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.path
                    d={e.path}
                    fill="none"
                    stroke={colour}
                    strokeWidth={1.6}
                    strokeDasharray={DASHED_EDGES.has(e.type) || e.tone === "missing" ? "6 4" : undefined}
                    markerEnd={tail ? undefined : head}
                    markerStart={tail}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1, d: e.path }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                  {tail && <path d={e.path} fill="none" stroke="transparent" markerEnd={`url(#arrow-${toneKey})`} />}
                  <motion.text
                    x={e.labelX}
                    y={e.labelY}
                    initial={false}
                    animate={{ x: e.labelX, y: e.labelY }}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-mono"
                    fontSize={10}
                    fill="var(--ink-quiet)"
                    stroke="var(--surface)"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {e.type}
                  </motion.text>
                </motion.g>
              );
            })}
          </AnimatePresence>

          <AnimatePresence>
            {layout.nodes.map((n) => {
              const kind = n.kind ?? "class";
              const colour = toneColour[n.tone ?? "normal"] ?? kindColour[kind] ?? "var(--line-strong)";
              const dashed = kind === "abstract" || kind === "ghost" || n.tone === "missing";
              const stereo = stereotype[kind];
              const round = ["database", "cache", "queue", "storage"].includes(kind) ? 14 : kind === "user" || kind === "client" ? 18 : 10;
              return (
                <motion.g
                  key={n.id}
                  initial={{ opacity: 0, x: n.x, y: n.y + 12, scale: 0.9 }}
                  animate={{ opacity: kind === "ghost" ? 0.6 : 1, x: n.x, y: n.y, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                >
                  <rect
                    width={n.w}
                    height={n.h}
                    rx={round}
                    fill="var(--surface)"
                    stroke={colour}
                    strokeWidth={kind === "interface" || n.tone === "good" || n.tone === "bad" ? 2 : 1.4}
                    strokeDasharray={dashed ? "5 4" : undefined}
                  />
                  <rect width={n.w} height={4} rx={2} fill={colour} opacity={0.85} />
                  {stereo && (
                    <text x={n.w / 2} y={18} textAnchor="middle" fontSize={9.5} fill={colour} className="font-mono">
                      {stereo}
                    </text>
                  )}
                  <text x={n.w / 2} y={stereo ? 34 : 22} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)" className="font-display">
                    {n.id}
                  </text>
                  {n.lines?.map((line, i) => (
                    <text key={line + i} x={10} y={(stereo ? 52 : 40) + i * 16} fontSize={10.5} fill="var(--ink-quiet)" className="font-mono">
                      {line}
                    </text>
                  ))}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
      </div>
      <figcaption>
        <details className="text-xs text-ink-quiet">
          <summary className="cursor-pointer select-none hover:text-ink">Text outline of {label}</summary>
          <ul className="mt-2 list-disc pl-5">
            {nodes.map((n) => (
              <li key={n.id}>
                {stereotype[n.kind ?? "class"] ? `${stereotype[n.kind ?? "class"]} ` : ""}
                {n.id}
                {n.lines?.length ? `: ${n.lines.join("; ")}` : ""}
              </li>
            ))}
            {edges.map((e) => (
              <li key={`${e.from}-${e.to}-${e.type}`}>
                {e.from} {e.type} {e.to}
              </li>
            ))}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}
