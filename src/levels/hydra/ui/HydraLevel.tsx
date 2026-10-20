"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaveStatus } from "@/components/SaveStatus";
import { getRepository } from "@/persistence/client";
import type { LearningEvent, ReviewRecord } from "@/persistence/types";
import { useExerciseState } from "@/persistence/useExerciseState";
import { runHarness } from "../design";
import {
  ELABORATION_QUESTION,
  INTERVIEW_QUESTION,
  LEVEL_ID,
  hydraCodec,
  initialState,
  recallPassed,
  reduce,
  type Beat,
  type HydraState,
} from "../level";
import { PainBeat, PlayBeat, ProofBeat, RecallBeat } from "./Beats";
import { Lenses } from "./Lenses";
import { TestLights } from "./TestLights";

const BEATS: { id: Beat; label: string }[] = [
  { id: "pain", label: "Pain" },
  { id: "play", label: "Play" },
  { id: "proof", label: "Proof" },
  { id: "recall", label: "Recall" },
];

export function HydraLevel() {
  const initial = useCallback(() => initialState(new Date().toISOString()), []);
  const { state, dispatch, status, notice, restoredAt, attempt, complete, restart } = useExerciseState({
    exerciseId: LEVEL_ID,
    codec: hydraCodec,
    initial,
    reducer: reduce,
    // Every action here is a deliberate click, so save almost immediately.
    debounceMs: 100,
  });

  // Record where the learner is, once per beat per attempt, so the home screen can offer "Continue".
  const beat = state?.beat;
  useEffect(() => {
    if (!beat || beat === "reward") return;
    const at = new Date().toISOString();
    getRepository()
      .recordEvent({ id: `visit:${LEVEL_ID}:${attempt}:${beat}`, type: "activityVisited", lessonId: LEVEL_ID, activity: beat, at })
      .catch(() => {});
  }, [beat, attempt]);

  if (!state) {
    return <SaveStatus status={status} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">The If-Else Hydra</h1>
          <SaveStatus status={status} />
        </div>
        {state.beat !== "reward" && <BeatSteps current={state.beat} />}
        {notice && (
          <p role="alert" className="rounded-md border border-warn p-3 text-sm">
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
        <Reward state={state} attempt={attempt} complete={complete} restart={restart} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-label="Your move" className="flex flex-col gap-4">
            {state.beat === "pain" && <PainBeat state={state} dispatch={dispatch} />}
            {state.beat === "play" && <PlayBeat state={state} dispatch={dispatch} />}
            {state.beat === "proof" && <ProofBeat state={state} dispatch={dispatch} />}
            {state.beat === "recall" && <RecallBeat state={state} dispatch={dispatch} />}

            {state.feedback && (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-md border-l-4 bg-surface p-3 text-sm ${
                  state.feedback.tone === "good" ? "border-flow" : state.feedback.tone === "bad" ? "border-fail" : "border-line"
                }`}
              >
                {state.feedback.text}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-ink-quiet">
              <button type="button" className="underline hover:text-flow" onClick={() => dispatch({ type: "hint" })}>
                Hint
              </button>
              <span className="font-mono text-xs">
                Hints {state.hintsUsed} · Missteps {state.missteps}
              </span>
            </div>
          </section>

          {state.beat === "recall" && !state.recall.diff ? (
            <aside className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-quiet">
              The blueprint, the code and the tests are hidden while you rebuild from memory.
            </aside>
          ) : (
            <aside className="flex flex-col gap-4">
              <Lenses design={state.design} beat={state.beat} />
              <TestLights report={runHarness(state.design, state.requested)} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function BeatSteps({ current }: { current: Beat }) {
  const index = BEATS.findIndex((b) => b.id === current);
  return (
    <ol className="flex gap-2 text-xs" aria-label="Level progress">
      {BEATS.map((b, i) => (
        <li
          key={b.id}
          aria-current={b.id === current ? "step" : undefined}
          className={`rounded-full border px-3 py-1 font-mono ${
            i < index ? "border-flow/40 text-flow/70" : b.id === current ? "border-flow text-flow" : "border-line text-ink-quiet"
          }`}
        >
          {b.label}
        </li>
      ))}
    </ol>
  );
}

/** Records the attempt once (event ids are deterministic), schedules the first review, then celebrates. */
function Reward({
  state,
  attempt,
  complete,
  restart,
}: {
  state: HydraState;
  attempt: number;
  complete: () => Promise<void>;
  restart: () => Promise<void>;
}) {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const recorded = useRef(false);

  const diff = state.recall.diff!;
  const passed = recallPassed(diff);
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(state.startedAt)) / 60000));
  const interviewCorrect = INTERVIEW_QUESTION.choices.find((c) => c.id === state.proof.answer)?.correct ?? false;
  const elaborationCorrect = ELABORATION_QUESTION.choices.find((c) => c.id === state.elaboration)?.correct ?? false;

  const events = useMemo<LearningEvent[]>(() => {
    const at = new Date().toISOString();
    const key = `${LEVEL_ID}#${attempt}`;
    const confidence = state.recall.confidence ?? "unsure";
    return [
      { id: `attempt:${key}:interview`, type: "attemptSubmitted", attemptId: `${key}:interview`, itemId: "strategy:when-not", correct: interviewCorrect, hintsUsed: 0, seconds: 0, at },
      { id: `attempt:${key}:blueprint`, type: "attemptSubmitted", attemptId: `${key}:blueprint`, itemId: "strategy:blank-blueprint", correct: passed, score: Math.round(diff.scores.relationships * 100), confidence, hintsUsed: state.hintsUsed, seconds: minutes * 60, at },
      { id: `attempt:${key}:elaboration`, type: "attemptSubmitted", attemptId: `${key}:elaboration`, itemId: "strategy:why-open-closed", correct: elaborationCorrect, hintsUsed: 0, seconds: 0, at },
      { id: `review:strategy:${key}`, type: "reviewGraded", conceptId: "strategy", outcome: { correct: passed, usedHint: state.hintsUsed > 0, confidence, seconds: 60 }, at },
      { id: `lessonCompleted:${LEVEL_ID}`, type: "lessonCompleted", lessonId: LEVEL_ID, at },
      { id: "achievement:hydra-slayer", type: "achievementEarned", achievementId: "hydra-slayer", at },
      // Same XP id scheme as generic levels: earned once per level.
      { id: `xp:level:${LEVEL_ID}`, type: "xpEarned", amount: 260, reason: `level:${LEVEL_ID}`, at },
    ];
    // Built once for this attempt; ids make re-recording harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const repo = getRepository();
    (async () => {
      for (const event of events) await repo.recordEvent(event);
      await complete();
      setReview((await repo.getReview("strategy")) ?? null);
    })().catch(() => setFailed(true));
  }, [events, complete]);

  const days = review ? Math.max(1, Math.round((review.due.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="reward-heading">
      <h2 id="reward-heading" className="font-display text-2xl font-semibold">
        The rift is sealed.
      </h2>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-2 rounded-xl border-2 border-warn bg-surface p-4" aria-label="Pattern Card: Strategy, bronze">
          <span className="font-mono text-xs text-warn">PATTERN CARD · BRONZE</span>
          <span className="font-display text-2xl font-semibold">Strategy</span>
          <span className="text-sm">Put each interchangeable rule behind one interface and plug in the ones you need.</span>
          <span className="mt-2 text-xs text-ink-quiet">Interview tell: &ldquo;rules change often&rdquo;, &ldquo;choose behaviour at runtime&rdquo;.</span>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <strong>Achievement:</strong> Hydra Slayer
          </li>
          <li>
            <strong>Blank Blueprint:</strong> {Math.round(diff.scores.concepts * 100)}% of classes, {Math.round(diff.scores.relationships * 100)}% of arrows
          </li>
          <li>
            <strong>Missteps:</strong> {state.missteps} · <strong>Hints:</strong> {state.hintsUsed} · about {minutes} min
          </li>
          <li role="status">
            {failed
              ? "Your result couldn't be saved on this device."
              : days !== null
                ? `Your first review of Strategy is due in ${days} ${days === 1 ? "day" : "days"}. Retrieval then is what makes it last.`
                : "Saving your result…"}
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-md border border-flow px-4 py-2 text-sm font-semibold text-flow">
          Back to the city
        </Link>
        <button type="button" className="rounded-md border border-line px-4 py-2 text-sm" onClick={() => void restart()}>
          Play again
        </button>
      </div>
    </section>
  );
}
