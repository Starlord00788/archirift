"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Diagram } from "@/components/ui/Diagram";
import { Icon } from "@/components/ui/Icon";
import type { StepsStageSchema } from "@/content/rift";
import type { z } from "zod";
import { choiceOrder, type StageState } from "../../state";
import { Rich } from "../Rich";
import type { Dispatch } from "../types";
import { useChoiceKeys } from "../useChoiceKeys";

type Stage = z.infer<typeof StepsStageSchema>;
type State = Extract<StageState, { kind: "steps" }>;

/** The workbench as it looks after the steps completed so far. */
export function workbench(stage: Stage, state: State) {
  const completed = state.done ? stage.steps.length : state.step;
  let code = stage.start.code;
  let diagram = stage.start.diagram;
  let note = stage.start.note;
  for (const step of stage.steps.slice(0, completed)) {
    code = step.after.code ?? code;
    diagram = step.after.diagram ?? diagram;
    note = step.after.note ?? note;
  }
  return { code, diagram, note };
}

export function StepsStage({ stage, state, dispatch, seed }: { stage: Stage; state: State; dispatch: Dispatch; seed: string }) {
  const [shake, setShake] = useState<{ option: number; n: number } | null>(null);
  const step = stage.steps[state.step];
  const bench = workbench(stage, state);
  const order = useMemo(() => choiceOrder(step.options.length, `${seed}:${state.step}`), [step.options.length, seed, state.step]);
  const choose = (i: number) => {
    if (state.done || state.wrong.includes(i)) return;
    if (!step.options[i].correct) setShake({ option: i, n: (shake?.n ?? 0) + 1 });
    dispatch({ type: "stepChoose", option: i });
  };
  useChoiceKeys(state.done ? 0 : order.length, (position) => choose(order[position]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-4">
        <ol className="flex gap-1.5" aria-label={`Move ${Math.min(state.step + 1, stage.steps.length)} of ${stage.steps.length}`}>
          {stage.steps.map((_, i) => {
            const done = state.done || i < state.step;
            return (
              <li key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span className="block h-full bg-flow" initial={false} animate={{ width: done ? "100%" : i === state.step ? "35%" : "0%" }} transition={{ duration: 0.5 }} />
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait">
          {!state.done ? (
            <motion.fieldset key={state.step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }} className="flex flex-col gap-2">
              <legend className="mb-3 flex flex-col gap-1">
                <span className="font-mono text-xs text-ink-quiet">
                  Move {state.step + 1} of {stage.steps.length}
                </span>
                <span className="text-lg font-semibold leading-snug">
                  <Rich text={step.prompt} inline />
                </span>
              </legend>
              {order.map((i, position) => {
                const option = step.options[i];
                const wrong = state.wrong.includes(i);
                return (
                  <Button
                    key={`${state.step}-${i}-${shake?.option === i ? shake.n : 0}`}
                    variant="choice"
                    disabled={wrong}
                    aria-label={wrong ? `${option.text} (ruled out)` : undefined}
                    onClick={() => choose(i)}
                    className={`${wrong ? "border-fail/50 line-through decoration-fail/60" : ""} ${shake?.option === i ? "animate-shake" : ""}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${wrong ? "border-fail text-fail" : "border-line text-ink-quiet"}`}>
                      {wrong ? <Icon name="x" size={12} /> : String.fromCharCode(65 + position)}
                    </span>
                    <span>
                      <Rich text={option.text} inline />
                    </span>
                  </Button>
                );
              })}
            </motion.fieldset>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-2 rounded-2xl border border-good/50 bg-good/5 p-5">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-good">
                <Icon name="check" /> Refactor complete
              </p>
              <p className="text-sm text-ink-quiet">Look at the workbench: that&apos;s the design you built, move by move.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4" aria-label="Workbench">
        {bench.note && (
          <motion.p key={bench.note} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-ink-quiet">
            <Rich text={bench.note} inline />
          </motion.p>
        )}
        {bench.diagram && <Diagram nodes={bench.diagram.nodes} edges={bench.diagram.edges} label="the current design" />}
        {bench.code && <CodeBlock source={bench.code.source} language={bench.code.language} highlight={bench.code.highlight} title="Your code" />}
      </div>
    </div>
  );
}
