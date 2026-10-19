"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRepository } from "@/persistence/client";
import { StaleWriteError, type SnapshotCodec } from "@/persistence/repository";
import { withRetry } from "@/persistence/retry";

const EXERCISE_ID = "lab-strategy-diagram";
const SCHEMA_VERSION = 1;
const SAVE_DELAY_MS = 800;

/** Only what is needed to restore the task: node ids and positions. No selection or viewport state. */
interface LabState {
  positions: Record<string, { x: number; y: number }>;
}

const codec: SnapshotCodec<LabState> = {
  currentVersion: SCHEMA_VERSION,
  migrate(state, fromVersion) {
    if (fromVersion !== 1) return null;
    const positions = (state as LabState | null)?.positions;
    if (!positions || typeof positions !== "object") return null;
    const valid = Object.values(positions).every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    return valid ? { positions } : null;
  },
};

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

type SaveStatus = "idle" | "saving" | "saved" | "failed";
const statusText: Record<SaveStatus, string> = { idle: "", saving: "Saving…", saved: "Saved", failed: "Not saved: retrying failed" };

function withPositions(nodes: Node[], positions: LabState["positions"]): Node[] {
  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n));
}

export function StrategyDiagramLab() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef(1);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getRepository()
      .loadSnapshot(EXERCISE_ID, codec)
      .then((result) => {
        if (result.kind === "restored") {
          attempt.current = result.snapshot.attempt;
          revision.current = result.snapshot.revision;
          setNodes(withPositions(initialNodes, result.snapshot.state.positions));
          setStatus("saved");
        } else if (result.kind === "unrecoverable") {
          setNotice("Your saved layout couldn't be restored, so this is a fresh start. The old copy was kept.");
          return getRepository().restartExercise(EXERCISE_ID).then((next) => (attempt.current = next));
        }
      })
      .catch(() => setStatus("failed"));
  }, []);

  const save = useCallback((current: Node[]) => {
    const positions = Object.fromEntries(current.map((n) => [n.id, n.position]));
    setStatus("saving");
    withRetry(() =>
      getRepository().saveSnapshot(
        {
          id: `${EXERCISE_ID}#${attempt.current}`,
          exerciseId: EXERCISE_ID,
          attempt: attempt.current,
          status: "unfinished",
          schemaVersion: SCHEMA_VERSION,
          state: { positions } satisfies LabState,
        },
        revision.current,
      ),
    )
      .then((saved) => {
        revision.current = saved.revision;
        setStatus("saved");
      })
      .catch((error) => {
        if (error instanceof StaleWriteError) {
          setNotice("This diagram was changed in another tab. Reload to see the newest version.");
        }
        setStatus("failed");
      });
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        // Save only when a drag ends; positions mid-drag are transient.
        if (changes.some((c) => c.type === "position" && c.dragging === false)) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(next), SAVE_DELAY_MS);
        }
        return next;
      });
    },
    [save],
  );

  const restart = useCallback(async () => {
    attempt.current = await getRepository().restartExercise(EXERCISE_ID);
    revision.current = 0;
    setNodes(initialNodes);
    setStatus("idle");
    setNotice(null);
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p role="status" aria-live="polite" className="min-h-5 font-mono text-xs text-ink-quiet">
          {statusText[status]}
        </p>
        <button
          type="button"
          onClick={restart}
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
      <div className="h-[420px] rounded-lg border border-line bg-surface">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} fitView colorMode="system">
          <Background gap={32} />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}
