"use client";

import { Reorder } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { OrderStageSchema } from "@/content/rift";
import type { z } from "zod";
import type { StageState } from "../../state";
import { Rich } from "../Rich";
import type { Dispatch } from "../types";

type Stage = z.infer<typeof OrderStageSchema>;
type State = Extract<StageState, { kind: "order" }>;

/** Put the steps in order: drag them, or use the arrow buttons. */
export function OrderStage({ stage, state, dispatch }: { stage: Stage; state: State; dispatch: Dispatch }) {
  const byId = new Map(stage.items.map((i) => [i.id, i]));
  const move = (id: string, by: number) => {
    const from = state.order.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= state.order.length) return;
    dispatch({ type: "orderMove", item: id, to });
  };

  return (
    <div className="flex flex-col gap-4">
      <Reorder.Group axis="y" values={state.order} onReorder={(order) => !state.done && dispatch({ type: "orderSet", order })} className="flex flex-col gap-2" aria-label="Steps to put in order">
        {state.order.map((id, index) => {
          const item = byId.get(id)!;
          const right = stage.items[index]?.id === id;
          const tone = state.done ? "border-good/60 bg-good/5" : state.checked ? (right ? "border-good/60" : "border-fail/70") : "border-line";
          return (
            <Reorder.Item key={id} value={id} dragListener={!state.done} className={`flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 ${tone} ${state.done ? "" : "cursor-grab active:cursor-grabbing"}`} whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.5)" }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold">{index + 1}</span>
              <span className="min-w-0 flex-1 text-sm">
                <Rich text={item.text} inline />
                {state.done && item.why && (
                  <span className="mt-1 block text-xs text-ink-quiet">
                    <Rich text={item.why} inline />
                  </span>
                )}
                {state.checked && !state.done && <span className="sr-only">{right ? " (right place)" : " (wrong place)"}</span>}
              </span>
              {!state.done && (
                <span className="flex flex-col">
                  <button type="button" className="rounded p-0.5 text-ink-quiet hover:text-ink disabled:opacity-30" disabled={index === 0} onClick={() => move(id, -1)} aria-label={`Move up: ${item.text}`}>
                    <Icon name="arrowLeft" size={14} className="rotate-90" />
                  </button>
                  <button type="button" className="rounded p-0.5 text-ink-quiet hover:text-ink disabled:opacity-30" disabled={index === state.order.length - 1} onClick={() => move(id, 1)} aria-label={`Move down: ${item.text}`}>
                    <Icon name="arrowRight" size={14} className="rotate-90" />
                  </button>
                </span>
              )}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {!state.done && (
        <Button variant="primary" className="w-fit" onClick={() => dispatch({ type: "orderCheck" })}>
          Check the order
        </Button>
      )}
    </div>
  );
}
