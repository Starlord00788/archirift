"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { Counter } from "@/components/ui/Counter";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import type { DeckEntry, DeckQuestion } from "@/game/deck";
import { getLocalStore, getRepository } from "@/persistence/client";
import { useLearning } from "@/persistence/useLearning";
import { Rich } from "@/rift/ui/Rich";

const ROUNDS = 10;
const SECONDS = 25;

interface Round {
  entry: DeckEntry;
  question: DeckQuestion;
  order: number[];
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildRun(deck: DeckEntry[], track: string[] | null): Round[] {
  const pool = deck.flatMap((entry) => (track && !track.includes(entry.levelId) ? [] : entry.questions.map((question) => ({ entry, question }))));
  // At most one question per concept, so a run covers ten different ideas.
  const seen = new Set<string>();
  const picked: Round[] = [];
  for (const item of shuffle(pool)) {
    if (seen.has(item.entry.conceptId)) continue;
    seen.add(item.entry.conceptId);
    picked.push({ ...item, order: shuffle(item.question.choices.map((_, i) => i)) });
    if (picked.length === ROUNDS) break;
  }
  return picked;
}

/** Boss Rush: ten rapid interview questions from across the city. Speed and streaks multiply your score. */
export function BossRush({ deck }: { deck: DeckEntry[] }) {
  const { progress } = useLearning();
  const [run, setRun] = useState<Round[] | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const completed = progress?.completedLessons ?? [];

  useEffect(() => {
    getLocalStore()
      .recentAttempts(500)
      .then((attempts) => {
        const scores = attempts.filter((a) => a.itemId === "arena:run").map((a) => a.score ?? 0);
        setBest(scores.length ? Math.max(...scores) : null);
      })
      .catch(() => {});
  }, [run]);

  if (run) return <Run rounds={run} onExit={() => setRun(null)} />;

  const canFocus = completed.length >= 3;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div whileHover={{ y: -3 }} className="flex flex-col gap-4 rounded-3xl border border-pink/50 bg-linear-to-br from-pink/10 to-warn/5 p-6">
        <Icon name="swords" size={34} className="text-pink" />
        <h2 className="font-display text-2xl font-bold">Open Boss Rush</h2>
        <p className="text-sm text-ink-quiet">Ten questions from anywhere in the city, LLD and HLD. {SECONDS} seconds each. Answer fast and keep a streak going to multiply your score.</p>
        <Button variant="primary" className="w-fit" onClick={() => setRun(buildRun(deck, null))}>
          Enter the arena
        </Button>
      </motion.div>
      <motion.div whileHover={{ y: canFocus ? -3 : 0 }} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/60 p-6">
        <Icon name="target" size={34} className="text-flow" />
        <h2 className="font-display text-2xl font-bold">Focused Rush</h2>
        <p className="text-sm text-ink-quiet">Only concepts from levels you&apos;ve finished: the perfect warm-up before an interview. {canFocus ? "" : "Finish three levels to unlock it."}</p>
        <Button className="w-fit" disabled={!canFocus} onClick={() => setRun(buildRun(deck, completed))}>
          {canFocus ? "Start focused run" : "Locked"}
        </Button>
      </motion.div>
      <p className="font-mono text-sm text-ink-quiet md:col-span-2">Your best: {best === null ? "no runs yet" : `${best.toLocaleString("en-IN")} points`}</p>
    </div>
  );
}

function Run({ rounds, onExit }: { rounds: Round[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [right, setRight] = useState(0);
  const [answer, setAnswer] = useState<number | "timeout" | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [gain, setGain] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const runId = useRef(`${Date.now()}`);
  const round = rounds[index];
  const finished = index >= rounds.length;

  const choose = useCallback(
    (pick: number | "timeout") => {
      if (answer !== null || !round) return;
      setAnswer(pick);
      const correct = pick !== "timeout" && round.question.choices[pick].correct;
      if (correct) {
        const multiplier = Math.min(2, 1 + streak * 0.25);
        const points = Math.round((100 + left * 8) * multiplier);
        setScore((s) => s + points);
        setGain(points);
        setStreak((s) => s + 1);
        setRight((r) => r + 1);
      } else {
        setGain(null);
        setStreak(0);
      }
    },
    [answer, round, streak, left],
  );

  useEffect(() => {
    if (finished || answer !== null) return;
    startedAt.current = Date.now();
    setLeft(SECONDS);
    const timer = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [index, finished, answer]);

  useEffect(() => {
    if (left === 0 && answer === null && !finished) choose("timeout");
  }, [left, answer, finished, choose]);

  const recorded = useRef(false);
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    const repo = getRepository();
    const at = new Date().toISOString();
    void (async () => {
      await repo.recordEvent({ id: `attempt:arena:${runId.current}`, type: "attemptSubmitted", attemptId: `arena:${runId.current}`, itemId: "arena:run", correct: right >= 8, score, hintsUsed: 0, seconds: 0, at });
      await repo.recordEvent({ id: `xp:arena:${runId.current}`, type: "xpEarned", amount: right * 5, reason: "arena", at });
      if (right >= 8) await repo.recordEvent({ id: "achievement:arena-champion", type: "achievementEarned", achievementId: "arena-champion", at });
    })().catch(() => {});
  }, [finished, right, score]);

  const grade = useMemo(() => (right >= 9 ? "Offer letter" : right >= 7 ? "Strong hire" : right >= 5 ? "Lean hire" : "Keep training"), [right]);

  if (finished) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-pink/50 bg-pink/5 p-8 text-center">
        {right >= 8 && <Confetti />}
        <p className="font-mono text-xs uppercase tracking-widest text-pink">Verdict</p>
        <h2 className="font-display text-4xl font-bold">{grade}</h2>
        <p className="font-display text-5xl font-bold text-gradient">
          <Counter value={score} />
        </p>
        <p className="text-ink-quiet">
          {right}/{rounds.length} correct · +{right * 5} XP
        </p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={onExit}>
            Play again
          </Button>
          <ButtonLink href="/review/">Review weak spots</ButtonLink>
        </div>
      </motion.div>
    );
  }

  const correct = answer !== null && answer !== "timeout" && round.question.choices[answer].correct;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onExit}>
          <Icon name="x" size={15} /> Leave
        </Button>
        <span className="font-mono text-sm">
          Round {index + 1}/{rounds.length}
        </span>
        <span className="flex items-center gap-3 font-mono text-sm">
          {streak > 1 && <motion.span key={streak} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full bg-warn px-2 font-bold text-bg">×{Math.min(2, 1 + streak * 0.25).toFixed(2)}</motion.span>}
          <span className="font-bold">{score.toLocaleString("en-IN")}</span>
        </span>
      </div>
      <Meter value={left / SECONDS} tone={left > 8 ? "flow" : "fail"} label="Time left" height={6} />

      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className={`relative flex flex-col gap-4 rounded-3xl border bg-surface/80 p-6 shadow-card ${answer !== null && !correct ? "animate-shake border-fail/60" : "border-line"}`}>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-quiet">{round.entry.conceptName}</p>
          <h2 className="text-xl font-semibold leading-snug">
            <Rich text={round.question.prompt} inline />
          </h2>
          <div className="flex flex-col gap-2">
            {round.order.map((i) => {
              const choice = round.question.choices[i];
              const reveal = answer !== null && (answer === i || choice.correct);
              return (
                <Button key={i} variant="choice" disabled={answer !== null} onClick={() => choose(i)} className={`${reveal ? (choice.correct ? "border-good bg-good/10" : "border-fail bg-fail/10") : ""} disabled:opacity-100`}>
                  <span>
                    <Rich text={choice.text} inline />
                    {reveal && <span className="sr-only">{choice.correct ? " (correct)" : " (incorrect)"}</span>}
                  </span>
                </Button>
              );
            })}
          </div>
          <AnimatePresence>
            {gain !== null && answer !== null && (
              <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }} transition={{ duration: 1.2 }} className="pointer-events-none absolute right-6 top-6 font-display text-2xl font-bold text-good">
                +{gain}
              </motion.span>
            )}
          </AnimatePresence>
          {answer !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3" role="status">
              <p className="text-sm">
                <strong>{answer === "timeout" ? "Time's up. " : correct ? "Correct. " : "Not quite. "}</strong>
                <Rich text={round.question.choices.find((c) => c.correct)!.why} inline />
              </p>
              <Button
                variant="primary"
                className="w-fit"
                onClick={() => {
                  setAnswer(null);
                  setGain(null);
                  setIndex((i) => i + 1);
                }}
              >
                {index === rounds.length - 1 ? "See the verdict" : "Next round"} <Icon name="arrowRight" size={15} />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
