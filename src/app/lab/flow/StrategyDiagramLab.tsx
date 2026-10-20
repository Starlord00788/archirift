"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, MarkerType, ReactFlow, applyNodeChanges, type Edge, type Node, type NodeChange } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import { SaveStatus } from "@/components/SaveStatus";
import type { SnapshotCodec } from "@/persistence/repository";
import { useExerciseState } from "@/persistence/useExerciseState";

const EXERCISE_ID = "lab-strategy-diagram";

/** Only what is needed to restore the task: node positions. No selection or viewport state. */
interface LabState {
  positions: Record<string, { x: number; y: number }>;
}
type LabAction = { type: "moved"; positions: LabState["positions"] };

const codec: SnapshotCodec<LabState> = {
  currentVersion: 1,
  migrate(state, fromVersion) {
    if (fromVersion !== 1) return null;
    const positions = (state as LabState | null)?.positions;
    if (!positions || typeof positions !== "object") return null;
    const valid = Object.values(positions).every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    return valid ? { positions } : null;
  },
};

const reducer = (state: LabState, action: LabAction): LabState => ({ positions: { ...state.positions, ...action.positions } });

const box = { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 8 };
const iface = { ...box, border: "2px solid var(--flow)" };

const initialNodes: Node[] = [
  { id: "checkout", position: { x: 40, y: 140 }, data: { label: "Checkout" }, style: box },
  { id: "pricing", position: { x: 300, y: 140 }, data: { label: "«interface» PricingStrategy" }, style: iface },
  { id: "student", position: { x: 560, y: 40 }, data: { label: "StudentPricing" }, style: box },
  { id: "happy", position: { x: 560, y: 140 }, data: { label: "HappyHourPricing" }, style: box },
  { id: "festival", position: { x: 560, y: 240 }, data: { label: "FestivalPricing" }, style: box },
];

const arrow = { type: MarkerType.ArrowClosed };
const edges: Edge[] = [
  { id: "uses", source: "checkout", target: "pricing", label: "uses", markerEnd: arrow },
  ...["student", "happy", "festival"].map((id) => ({
    id: `${id}-implements`,
    source: id,
    target: "pricing",
    style: { strokeDasharray: "6 4" },
    markerEnd: arrow,
  })),
];

export function StrategyDiagramLab() {
  const initial = useCallback((): LabState => ({ positions: {} }), []);
  const { state, dispatch, status, notice, restart } = useExerciseState({
    exerciseId: EXERCISE_ID,
    codec,
    initial,
    reducer,
    debounceMs: 800,
  });

  // Drags are drawn from local state for smoothness; only finished drags reach the saved state.
  const [nodes, setNodes] = useState<Node[] | null>(null);
  useEffect(() => {
    if (state && nodes === null) {
      setNodes(initialNodes.map((n) => (state.positions[n.id] ? { ...n, position: state.positions[n.id] } : n)));
    }
  }, [state, nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        if (!current) return current;
        const next = applyNodeChanges(changes, current);
        const finished = changes.some((c) => c.type === "position" && c.dragging === false);
        if (finished) dispatch({ type: "moved", positions: Object.fromEntries(next.map((n) => [n.id, n.position])) });
        return next;
      });
    },
    [dispatch],
  );

  const onRestart = useCallback(async () => {
    await restart();
    setNodes(initialNodes);
  }, [restart]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <SaveStatus status={status} />
        <button
          type="button"
          onClick={() => void onRestart()}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-flow focus-visible:border-flow"
        >
          Restart layout
        </button>
      </div>
      {notice && (
        <p role="alert" className="rounded-md border border-warn p-3 text-sm">
          {notice}
        </p>
      )}
      <div className="h-105 rounded-lg border border-line bg-surface">
        {nodes && (
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} fitView colorMode="system">
            <Background gap={32} />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </section>
  );
}
