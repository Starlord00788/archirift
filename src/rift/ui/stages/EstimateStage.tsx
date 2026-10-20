"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { EstimateStageSchema } from "@/content/rift";
import type { z } from "zod";
import type { StageState } from "../../state";
import { Rich } from "../Rich";
import type { Dispatch } from "../types";

type Stage = z.infer<typeof EstimateStageSchema>;
type State = Extract<StageState, { kind: "estimate" }>;

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, g: 1e9, t: 1e12, lakh: 1e5, l: 1e5, cr: 1e7, crore: 1e7 };

/** Parses "12k", "3.5M", "2e6", "1,20,000" or "10 lakh". */
export function parseAmount(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  const match = /^(\d+(?:\.\d+)?(?:e\d+)?)([a-z]*)$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  const factor = match[2] ? SUFFIX[match[2]] : 1;
  if (!Number.isFinite(value) || factor === undefined) return null;
  return value * factor;
}

export function formatAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${+(n / 1e12).toPrecision(3)}T`;
  if (abs >= 1e9) return `${+(n / 1e9).toPrecision(3)}B`;
  if (abs >= 1e6) return `${+(n / 1e6).toPrecision(3)}M`;
  if (abs >= 1e3) return `${+(n / 1e3).toPrecision(3)}k`;
  return `${+n.toPrecision(3)}`;
}

/** Back-of-the-envelope maths: close enough wins, like on a real whiteboard. */
export function EstimateStage({ stage, state, dispatch }: { stage: Stage; state: State; dispatch: Dispatch }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-4">
      {stage.questions.map((q, i) => {
        const solved = state.solved.includes(q.id);
        const draft = drafts[q.id] ?? (state.answers[q.id] != null ? formatAmount(state.answers[q.id]!) : "");
        const parsed = parseAmount(draft);
        return (
          <motion.section key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`rounded-2xl border p-4 ${solved ? "border-good/60 bg-good/5" : "border-line bg-surface/60"}`} aria-labelledby={`q-${q.id}`}>
            <h3 id={`q-${q.id}`} className="font-semibold">
              <Rich text={q.prompt} inline />
            </h3>
            {q.givens.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {q.givens.map((g) => (
                  <li key={g} className="rounded-lg border border-line bg-bg/40 px-2 py-1 font-mono text-xs text-ink-quiet">
                    <Rich text={g} inline />
                  </li>
                ))}
              </ul>
            )}
            {solved ? (
              <p className="mt-3 flex items-start gap-2 text-sm">
                <Icon name="check" className="mt-0.5 text-good" />
                <span>
                  You said <strong>{formatAmount(state.answers[q.id] ?? q.answer)}</strong> {q.unit}; our estimate is <strong>{formatAmount(q.answer)}</strong>. <Rich text={q.working} inline />
                </span>
              </p>
            ) : (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (parsed === null) return;
                  dispatch({ type: "estimateAnswer", question: q.id, value: parsed });
                  dispatch({ type: "estimateCheck", question: q.id });
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-quiet">Your estimate ({q.unit})</span>
                  <input
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                    placeholder="e.g. 12k or 3.5M"
                    className="w-44 rounded-xl border border-line bg-bg/60 px-3 py-2 font-mono text-sm outline-none focus:border-flow"
                  />
                </label>
                <Button type="submit" variant="secondary" disabled={parsed === null}>
                  Check
                </Button>
                {draft && parsed !== null && <span className="pb-2.5 font-mono text-xs text-ink-quiet">= {parsed.toLocaleString("en-US")}</span>}
              </form>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}
