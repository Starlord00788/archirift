"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KineticText } from "@/components/fx/KineticText";
import { SiteTower, type SiteCondition } from "@/components/fx/SiteTower";
import { TowerRise } from "@/components/fx/TowerRise";
import { SaveStatus } from "@/components/SaveStatus";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { Icon } from "@/components/ui/Icon";
import { getRepository } from "@/persistence/client";
import type { LearningEvent, ReviewRecord } from "@/persistence/types";
import { useExerciseState } from "@/persistence/useExerciseState";
import { BeatStepper } from "@/rift/ui/BeatStepper";
import { Feedback } from "@/rift/ui/Feedback";
import type { BespokeInfo } from "@/rift/ui/types";
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

const SITE: Record<Exclude<Beat, "reward">, { condition: SiteCondition; label: string }> = {
  pain: { condition: "tearing", label: "Its building is tearing apart" },
  play: { condition: "repairing", label: "Its building is under repair" },
  proof: { condition: "standing", label: "Its building is standing, not yet lit" },
  recall: { condition: "standing", label: "Its building is standing, not yet lit" },
};

/** How much of the refactor is done: the share of if-else heads cut off, or all of it once injected. */
function playProgress(state: HydraState): number {
  if (state.beat !== "play") return 0;
  if (state.design.injected) return 1;
  const chain = state.design.chain;
  return chain.length ? chain.filter((e) => e.extracted).length / chain.length : 0;
}

/** The hand-built Strategy level, in the same shell as every other level: header, stepper, coach. */
export function HydraLevel({ info }: { info: BespokeInfo }) {
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

  useEffect(() => {
    if (beat) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [beat]);

  if (!state) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rift-line w-full" />
        <SaveStatus status={status} />
      </div>
    );
  }

  const progress = playProgress(state);
  const accent = `var(--${info.world.accent})`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-end gap-4">
            {state.beat !== "reward" && (
              <SiteTower condition={SITE[state.beat].condition} floors={1 + Math.round(progress * 4)} jolt={state.painTries.length + state.missteps} />
            )}
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
                {info.world.name} · {info.concept}
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <KineticText segments={[{ text: "The If-Else Hydra" }]} />
              </h1>
              {state.beat !== "reward" && (
                <p className={`mt-1 font-mono text-[11px] uppercase tracking-[0.16em] ${state.beat === "pain" ? "text-fail" : "text-ink-quiet"}`}>{SITE[state.beat].label}</p>
              )}
            </div>
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
        {state.beat !== "reward" && <BeatStepper current={state.beat} playProgress={progress} />}
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label="Your move" className="flex flex-col gap-4">
              {state.beat === "pain" && <PainBeat state={state} dispatch={dispatch} />}
              {state.beat === "play" && <PlayBeat state={state} dispatch={dispatch} />}
              {state.beat === "proof" && <ProofBeat state={state} dispatch={dispatch} />}
              {state.beat === "recall" && <RecallBeat state={state} dispatch={dispatch} />}
            </section>

            {state.beat === "recall" && !state.recall.diff ? (
              <aside className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-quiet">
                The blueprint, the code and the tests are hidden while you rebuild from memory.
              </aside>
            ) : (
              <aside className="flex flex-col gap-4">
                <Lenses design={state.design} beat={state.beat} />
                <TestLights report={runHarness(state.design, state.requested)} />
              </aside>
            )}
          </div>

          {/* The coach's last line stays in view while you scroll, and can be dismissed if it's in the way. */}
          <div className="sticky bottom-20 z-30 md:bottom-4">
            <Feedback feedback={state.feedback} onDismiss={() => dispatch({ type: "dismissFeedback" })} />
          </div>
        </>
      )}
    </div>
  );
}

/** Records the attempt once (event ids are deterministic), schedules the first review, then celebrates. */
function Reward({
  info,
  state,
  attempt,
  complete,
  restart,
}: {
  info: BespokeInfo;
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
  // Same rule as every other level: the rift is sealed only when you defend it and rebuild it.
  const sealed = passed && interviewCorrect;

  const events = useMemo<LearningEvent[]>(() => {
    const at = new Date().toISOString();
    const key = `${LEVEL_ID}#${attempt}`;
    const confidence = state.recall.confidence ?? "unsure";
    return [
      { id: `attempt:${key}:interview`, type: "attemptSubmitted", attemptId: `${key}:interview`, itemId: "strategy:when-not", correct: interviewCorrect, hintsUsed: 0, seconds: 0, at },
      { id: `attempt:${key}:blueprint`, type: "attemptSubmitted", attemptId: `${key}:blueprint`, itemId: "strategy:blank-blueprint", correct: passed, score: Math.round(diff.scores.relationships * 100), confidence, hintsUsed: state.hintsUsed, seconds: minutes * 60, at },
      { id: `attempt:${key}:elaboration`, type: "attemptSubmitted", attemptId: `${key}:elaboration`, itemId: "strategy:why-open-closed", correct: elaborationCorrect, hintsUsed: 0, seconds: 0, at },
      { id: `review:strategy:${key}`, type: "reviewGraded", conceptId: "strategy", outcome: { correct: sealed, usedHint: state.hintsUsed > 0, confidence, seconds: 60 }, at },
      ...(sealed
        ? ([
            { id: `lessonCompleted:${LEVEL_ID}`, type: "lessonCompleted", lessonId: LEVEL_ID, at },
            { id: "achievement:hydra-slayer", type: "achievementEarned", achievementId: "hydra-slayer", at },
            // Same XP id scheme as generic levels: earned once per level.
            { id: `xp:level:${LEVEL_ID}`, type: "xpEarned", amount: 260, reason: `level:${LEVEL_ID}`, at },
          ] satisfies LearningEvent[])
        : ([{ id: `xp:practice:${LEVEL_ID}`, type: "xpEarned", amount: 15, reason: `practice:${LEVEL_ID}`, at }] satisfies LearningEvent[])),
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
  const checks = [
    { label: "Answer the interviewer", ok: interviewCorrect },
    { label: "Rebuild the blueprint from memory", detail: `${Math.round(diff.scores.relationships * 100)}% of arrows`, ok: passed },
  ];

  return (
    <section className="flex flex-col gap-8" aria-labelledby="reward-heading">
      {sealed && <Confetti />}
      <div className="flex flex-col items-center gap-3 text-center">
        <TowerRise size={88} built={sealed ? 5 : 2 + Number(interviewCorrect) + Number(passed)} />
        <motion.h2 id="reward-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="font-display text-4xl font-bold tracking-tight">
          {sealed ? "The rift is sealed." : "The rift is holding, not sealed."}
        </motion.h2>
        <p className="max-w-xl text-ink-quiet">
          {sealed ? (
            <>
              You slew the Hydra and rebuilt <strong className="text-ink">Strategy</strong> from memory. That&apos;s the part that makes it stick.
            </>
          ) : (
            <>
              You&apos;ve seen how <strong className="text-ink">Strategy</strong> works, but it didn&apos;t hold up under pressure yet. Its building stays under construction until you can
              do both.
            </>
          )}
        </p>
        <ul className="flex flex-wrap justify-center gap-2" aria-label="What sealing takes">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${c.ok ? "border-good/60 text-good" : "border-fail/60 text-fail"}`}>
              <Icon name={c.ok ? "check" : "x"} size={14} />
              <span className="text-ink">{c.label}</span>
              {c.detail && <span className="font-mono text-xs text-ink-quiet">{c.detail}</span>}
            </li>
          ))}
        </ul>
        {sealed && (
          <ButtonLink href={`/#world-${info.world.id}`} variant="ghost" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-quiet">
            Watch it rise on your city map <Icon name="arrowRight" size={12} />
          </ButtonLink>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col gap-2 rounded-2xl border border-warn/60 bg-warn/5 p-5"
          aria-label="Pattern Card: Strategy, bronze"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-warn">Pattern card · bronze</p>
          <p className="font-display text-2xl font-bold">Strategy</p>
          <p className="text-sm">Put each interchangeable rule behind one interface and plug in the ones you need.</p>
          <p className="mt-1 text-xs text-ink-quiet">Interview tell: &ldquo;rules change often&rdquo;, &ldquo;choose behaviour at runtime&rdquo;.</p>
          {sealed && <p className="w-fit rounded-full bg-lime px-2 py-0.5 font-mono text-[11px] font-bold text-bg">HYDRA SLAYER</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-player">Your run</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex justify-between">
              <span>Classes recalled</span>
              <span className="font-mono">{Math.round(diff.scores.concepts * 100)}%</span>
            </li>
            <li className="flex justify-between">
              <span>Arrows recalled</span>
              <span className="font-mono">{Math.round(diff.scores.relationships * 100)}%</span>
            </li>
            <li className="flex justify-between">
              <span>Missteps · hints</span>
              <span className="font-mono">
                {state.missteps} · {state.hintsUsed}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Time</span>
              <span className="font-mono">~{minutes} min</span>
            </li>
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex flex-col gap-2 rounded-2xl border border-pink/50 bg-pink/5 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-pink">Memory</p>
          <p role="status" className="text-sm">
            {failed
              ? "Your result couldn't be saved on this device."
              : days !== null
                ? sealed
                  ? `Your first review of Strategy is due in ${days} ${days === 1 ? "day" : "days"}. Recalling it then is what makes it last.`
                  : `Strategy comes back in your review queue in ${days} ${days === 1 ? "day" : "days"}, sooner than if you'd sealed it.`
                : "Saving your result…"}
          </p>
          <ButtonLink href="/review/" variant="ghost" className="w-fit px-0 text-pink">
            Open your review queue <Icon name="arrowRight" size={14} />
          </ButtonLink>
        </motion.div>
      </div>

      <div className="flex flex-wrap gap-3">
        {sealed ? (
          <>
            {info.next && (
              <ButtonLink href={`/levels/${info.next.id}/`} variant="primary">
                Next: {info.next.title} <Icon name="arrowRight" size={15} />
              </ButtonLink>
            )}
            <ButtonLink href="/">Back to the city</ButtonLink>
            <Button variant="ghost" onClick={() => void restart()}>
              Play again
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={() => void restart()}>
              Try again <Icon name="arrowRight" size={15} />
            </Button>
            <ButtonLink href="/" variant="ghost">
              Back to the city
            </ButtonLink>
          </>
        )}
      </div>
    </section>
  );
}
