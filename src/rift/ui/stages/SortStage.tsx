"use client";

import { LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { SortStageSchema } from "@/content/rift";
import type { z } from "zod";
import { own, seededShuffle, type StageState } from "../../state";
import { Rich } from "../Rich";
import type { Dispatch } from "../types";

type Stage = z.infer<typeof SortStageSchema>;
type State = Extract<StageState, { kind: "sort" }>;

/** Sort the cards into the right buckets. Click a card then a bucket, or drag it there. */
export function SortStage({ stage, state, dispatch, seed }: { stage: Stage; state: State; dispatch: Dispatch; seed: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const items = seededShuffle(stage.items, seed);
  const pool = items.filter((i) => !own(state.placed, i.id));

  const place = (item: string, bucket: string | null) => {
    dispatch({ type: "sortPlace", item, bucket });
    setSelected(null);
  };

  const chip = (item: Stage["items"][number]) => {
    const where = own(state.placed, item.id);
    const wrong = state.checked && where && where !== item.bucket;
    const right = state.done;
    return (
      <motion.li key={item.id} layoutId={`sort-${item.id}`} layout transition={{ type: "spring", stiffness: 500, damping: 38 }} className="flex items-start gap-1">
        <button
          type="button"
          draggable={!state.done}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", item.id);
            setSelected(item.id);
          }}
          aria-pressed={selected === item.id}
          disabled={state.done}
          onClick={() => setSelected(selected === item.id ? null : item.id)}
          className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
            selected === item.id
              ? "border-player bg-player/10 shadow-[0_0_0_1px_var(--player)]"
              : wrong
                ? "animate-shake border-fail bg-fail/10"
                : right
                  ? "border-good/60 bg-good/5"
                  : "border-line bg-surface hover:border-flow"
          } ${state.done ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
        >
          <Rich text={item.text} inline />
          {wrong && <span className="sr-only"> (in the wrong bucket)</span>}
          {state.done && (
            <span className="mt-1 block text-xs text-ink-quiet">
              <Rich text={item.why} inline />
            </span>
          )}
        </button>
        {where && !state.done && (
          <button type="button" onClick={() => place(item.id, null)} className="mt-1.5 rounded p-1 text-ink-quiet hover:text-ink" aria-label={`Take back: ${item.text}`}>
            <Icon name="x" size={14} />
          </button>
        )}
      </motion.li>
    );
  };

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-5">
        {pool.length > 0 && (
          <div className="rounded-2xl border border-dashed border-line-strong p-4">
            <p className="mb-3 font-mono text-xs text-ink-quiet">
              {selected ? "Now choose a bucket below." : `${pool.length} to sort. Pick one, then pick its bucket (or drag it).`}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">{pool.map(chip)}</ul>
          </div>
        )}

        <div className={`grid gap-3 ${stage.buckets.length === 2 ? "sm:grid-cols-2" : stage.buckets.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
          {stage.buckets.map((bucket) => {
            const inside = items.filter((i) => own(state.placed, i.id) === bucket.id);
            return (
              <section
                key={bucket.id}
                aria-label={bucket.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(bucket.id);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) place(id, bucket.id);
                }}
                className={`flex min-h-36 flex-col gap-2 rounded-2xl border p-3 transition-colors ${over === bucket.id ? "border-player bg-player/10" : "border-line bg-surface/50"}`}
              >
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold">{bucket.label}</h3>
                    {bucket.hint && <p className="text-xs text-ink-quiet">{bucket.hint}</p>}
                  </div>
                  <span className="font-mono text-xs text-ink-quiet">{inside.length}</span>
                </header>
                {selected && !state.done && (
                  <Button variant="secondary" className="border-dashed py-1.5 text-xs" onClick={() => place(selected, bucket.id)}>
                    Place here
                  </Button>
                )}
                <ul className="flex flex-col gap-2">{inside.map(chip)}</ul>
              </section>
            );
          })}
        </div>

        {!state.done && (
          <Button variant="primary" className="w-fit" disabled={pool.length > 0} onClick={() => dispatch({ type: "sortCheck" })}>
            Check my sort
          </Button>
        )}
      </div>
    </LayoutGroup>
  );
}
