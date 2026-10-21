"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo } from "react";
import { SaveStatus } from "@/components/SaveStatus";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getRepository } from "@/persistence/client";
import { useExerciseState } from "@/persistence/useExerciseState";
import { createRiftCodec, createRiftReducer, initialRiftState, type RiftAction, type RiftState } from "../state";
import { BeatStepper } from "./BeatStepper";
import { BossBeat } from "./BossBeat";
import { Feedback } from "./Feedback";
import { PainBeat } from "./PainBeat";
import { RecallBeat } from "./RecallBeat";
import { Reward } from "./Reward";
import { Rich } from "./Rich";
import { CodeStage } from "./stages/CodeStage";
import { EstimateStage } from "./stages/EstimateStage";
import { LabStage } from "./stages/LabStage";
import { OrderStage } from "./stages/OrderStage";
import { SimStage } from "./stages/SimStage";
import { SortStage } from "./stages/SortStage";
import { StepsStage } from "./stages/StepsStage";
import type { Dispatch, RiftLevelInfo } from "./types";
import { KineticText } from "@/components/fx/KineticText";

const BEAT_TITLE: Record<RiftState["beat"], string> = {
  pain: "Pain: watch it break",
  play: "Play: fix it yourself",
  proof: "Proof: the interview boss",
  recall: "Recall: rebuild from memory",
  reward: "Sealed",
};

/** A whole data-driven level: Pain → Play → Proof → Recall → Reward, saved after every move. */
export function RiftLevel({ info }: { info: RiftLevelInfo }) {
  const reducer = useMemo(() => createRiftReducer(info.id, info.rift), [info.id, info.rift]);
  const codec = useMemo(() => createRiftCodec(info.rift), [info.rift]);
  const initial = useCallback(() => initialRiftState(info.id, info.rift, new Date().toISOString()), [info.id, info.rift]);
  const { state, dispatch, status, notice, restoredAt, attempt, complete, restart } = useExerciseState<RiftState, RiftAction>({
    exerciseId: info.id,
    codec,
    initial,
    reducer,
    debounceMs: 250,
  });

  const beat = state?.beat;
  useEffect(() => {
    if (!beat || beat === "reward") return;
    getRepository()
      .recordEvent({ id: `visit:${info.id}:${attempt}:${beat}`, type: "activityVisited", lessonId: info.id, activity: beat, at: new Date().toISOString() })
      .catch(() => {});
  }, [beat, attempt, info.id]);

  // Scroll to the top of the level when the beat or stage changes, so the new content is in view.
  const stageIndex = state?.stage;
  useEffect(() => {
    if (beat) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [beat, stageIndex]);

  if (!state) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rift-line w-full" />
        <SaveStatus status={status} />
      </div>
    );
  }

  const playProgress = state.beat === "play" ? (state.stage + (state.stages[state.stage]?.done ? 1 : 0)) / info.rift.play.length : 0;
  const accent = `var(--${info.world.accent})`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
              {info.world.name} · {info.concept.name}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl"><KineticText segments={[{ text: info.title }]} /></h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SaveStatus status={status} />
            {state.beat !== "reward" && (
              <span className="flex items-center gap-3 font-mono text-xs text-ink-quiet">
                <span>Hints {state.hintsUsed}</span>
                <span>Missteps {state.missteps}</span>
                <Button variant="ghost" className="border border-line px-2.5 py-1 text-xs" onClick={() => dispatch({ type: "hint" })}>
                  <Icon name="sparkles" size={13} /> Hint
                </Button>
              </span>
            )}
          </div>
        </div>
        {state.beat !== "reward" && <BeatStepper current={state.beat} playProgress={playProgress} />}
        {notice && (
          <p role="alert" className="rounded-xl border border-warn p-3 text-sm">
            {notice}
          </p>
        )}
        {restoredAt && state.beat !== "reward" && (
          <p className="text-sm text-ink-quiet">
            Welcome back. You&apos;re continuing where you left off.{" "}
            <button type="button" className="underline hover:text-flow" onClick={() => void restart()}>
              Start a fresh attempt
            </button>
          </p>
        )}
      </header>

      {state.beat === "reward" ? (
        <Reward info={info} state={state} attempt={attempt} complete={complete} restart={restart} />
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.section
              key={`${state.beat}-${state.stage}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              aria-label={BEAT_TITLE[state.beat]}
              className="flex flex-col gap-5"
            >
              <h2 className="sr-only">{BEAT_TITLE[state.beat]}</h2>
              {state.beat === "pain" && <PainBeat info={info} state={state} dispatch={dispatch} />}
              {state.beat === "play" && <PlayBeat info={info} state={state} dispatch={dispatch} />}
              {state.beat === "proof" && <BossBeat info={info} state={state} dispatch={dispatch} />}
              {state.beat === "recall" && <RecallBeat info={info} state={state} dispatch={dispatch} />}
            </motion.section>
          </AnimatePresence>

          {/* The coach's last line stays in view while you scroll, and can be dismissed if it's in the way. */}
          <div className="sticky bottom-20 z-30 md:bottom-4">
            <Feedback feedback={state.feedback} onDismiss={() => dispatch({ type: "dismissFeedback" })} />
          </div>
        </>
      )}
    </div>
  );
}

function PlayBeat({ info, state, dispatch }: { info: RiftLevelInfo; state: RiftState; dispatch: Dispatch }) {
  const stage = info.rift.play[state.stage];
  const current = state.stages[state.stage];
  const last = state.stage === info.rift.play.length - 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-ink-quiet">
          Stage {state.stage + 1} of {info.rift.play.length}
        </p>
        <h3 className="font-display text-2xl font-bold">{stage.title}</h3>
        <div className="max-w-3xl text-ink-quiet">
          <Rich text={stage.intro} inline />
        </div>
      </div>

      {stage.kind === "steps" && current.kind === "steps" && <StepsStage stage={stage} state={current} dispatch={dispatch} seed={`${state.startedAt}#${state.stage}`} />}
      {stage.kind === "sort" && current.kind === "sort" && <SortStage stage={stage} state={current} dispatch={dispatch} seed={`${info.id}#${state.stage}`} />}
      {stage.kind === "order" && current.kind === "order" && <OrderStage stage={stage} state={current} dispatch={dispatch} />}
      {stage.kind === "estimate" && current.kind === "estimate" && <EstimateStage stage={stage} state={current} dispatch={dispatch} />}
      {stage.kind === "sim" && current.kind === "sim" && <SimStage stage={stage} state={current} dispatch={dispatch} />}
      {stage.kind === "lab" && current.kind === "lab" && <LabStage widget={stage.widget} state={current} dispatch={dispatch} />}
      {stage.kind === "code" && current.kind === "code" && <CodeStage stage={stage} state={current} dispatch={dispatch} />}

      <AnimatePresence>
        {current.done && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="primary" onClick={() => dispatch({ type: "nextStage" })}>
              {last ? "Face the interview boss" : "Next stage"} <Icon name="arrowRight" size={15} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
