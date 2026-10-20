"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import type { DeckEntry, DeckQuestion } from "@/game/deck";
import { REVIEW_XP } from "@/game/ranks";
import { getRepository } from "@/persistence/client";
import type { ReviewRecord } from "@/persistence/types";
import { useLearning } from "@/persistence/useLearning";
import { Rich } from "@/rift/ui/Rich";
import { seededShuffle } from "@/rift/state";

type Confidence = "sure" | "unsure" | "guessing";

interface Card {
  entry: DeckEntry;
  question: DeckQuestion;
  review: ReviewRecord | null;
}

/** Picks a different question each time a concept comes back, so you recall the idea, not the wording. */
function cardFor(entry: DeckEntry, review: ReviewRecord | null): Card {
  const n = review?.reviews ?? 0;
  return { entry, question: entry.questions[n % entry.questions.length], review };
}

const days = (d: Date | string) => Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);

/** The spaced-repetition queue: due concepts first, then optional practice on weak spots. */
export function ReviewSession({ deck }: { deck: DeckEntry[] }) {
  const { due, reviews, progress } = useLearning();
  const byConcept = useMemo(() => new Map(deck.map((e) => [e.conceptId, e])), [deck]);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [mode, setMode] = useState<"due" | "practice">("due");
  const [results, setResults] = useState<{ concept: string; correct: boolean; xp: number }[]>([]);

  const weak = useMemo(
    () =>
      reviews
        .filter((r) => byConcept.has(r.conceptId))
        .sort((a, b) => b.lapses - a.lapses || Number(a.lastOutcome.correct) - Number(b.lastOutcome.correct) || a.card.stability - b.card.stability)
        .slice(0, 8),
    [reviews, byConcept],
  );

  const start = (which: "due" | "practice") => {
    const source = which === "due" ? due : weak;
    const cards = source.map((r) => byConcept.get(r.conceptId) && cardFor(byConcept.get(r.conceptId)!, r)).filter((c): c is Card => Boolean(c));
    setMode(which);
    setResults([]);
    setQueue(cards);
  };

  if (queue) {
    return <Session cards={queue} mode={mode} results={results} setResults={setResults} onExit={() => setQueue(null)} />;
  }

  const completed = new Set(progress?.completedLessons ?? []);
  const scheduled = reviews.filter((r) => byConcept.has(r.conceptId)).sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4 rounded-3xl border border-pink/50 bg-linear-to-br from-pink/10 to-player/10 p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-pink">Due now</p>
          <p className="font-display text-5xl font-bold">
            <Counter value={due.length} /> <span className="text-xl font-medium text-ink-quiet">{due.length === 1 ? "concept" : "concepts"}</span>
          </p>
          <p className="text-sm text-ink-quiet">
            Each card is a fresh question about a concept you learned. Answer, say how sure you were, and the scheduler (FSRS) decides when you see it next: soon if you struggled, weeks
            later if it was easy.
          </p>
          <Button variant="primary" className="w-fit" disabled={due.length === 0} onClick={() => start("due")}>
            <Icon name="brain" size={16} /> {due.length > 0 ? `Start review (${due.length})` : "Nothing due right now"}
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface/60 p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-warn">Weak spots</p>
          {weak.length === 0 ? (
            <p className="text-sm text-ink-quiet">Finish a level to start building your memory map. Concepts you struggle with will show up here.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5 text-sm">
                {weak.slice(0, 5).map((r) => (
                  <li key={r.conceptId} className="flex items-center justify-between gap-2">
                    <span>{byConcept.get(r.conceptId)?.conceptName}</span>
                    <span className={`font-mono text-xs ${r.lapses > 0 ? "text-warn" : "text-ink-quiet"}`}>
                      {r.lapses} {r.lapses === 1 ? "lapse" : "lapses"}
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="w-fit" onClick={() => start("practice")}>
                Practise weak spots
              </Button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="schedule-heading">
        <h2 id="schedule-heading" className="mb-3 font-display text-2xl font-bold">
          Your memory schedule
        </h2>
        {scheduled.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-ink-quiet">
            Nothing scheduled yet. Every level you finish adds its concept here.{" "}
            <Link href="/" className="text-flow underline">
              Pick a level
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scheduled.map((r) => {
              const entry = byConcept.get(r.conceptId)!;
              const d = days(r.due);
              const strength = Math.min(1, r.card.stability / 60);
              return (
                <li key={r.conceptId} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/codex/${entry.levelId}/`} className="font-semibold hover:text-flow">
                      {entry.conceptName}
                    </Link>
                    <span className={`shrink-0 font-mono text-xs ${d <= 0 ? "text-pink" : "text-ink-quiet"}`}>{d <= 0 ? "due" : `in ${d}d`}</span>
                  </div>
                  <Meter value={strength} tone={strength > 0.5 ? "good" : strength > 0.15 ? "flow" : "warn"} label={`Memory strength for ${entry.conceptName}`} height={5} />
                  <p className="font-mono text-[10.5px] text-ink-quiet">
                    {r.reviews} reviews · {r.lapses} lapses {completed.has(entry.levelId) ? "" : "· level unfinished"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Session({
  cards,
  mode,
  results,
  setResults,
  onExit,
}: {
  cards: Card[];
  mode: "due" | "practice";
  results: { concept: string; correct: boolean; xp: number }[];
  setResults: (r: { concept: string; correct: boolean; xp: number }[]) => void;
  onExit: () => void;
}) {
  const index = results.length;
  const card = cards[index];
  const [chosen, setChosen] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState<{ concept: string; correct: boolean; xp: number } | null>(null);
  const shownAt = useRef(Date.now());

  if (!card) {
    const right = results.filter((r) => r.correct).length;
    const xp = results.reduce((s, r) => s + r.xp, 0);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-good/50 bg-good/5 p-8 text-center">
        <Icon name="check" size={40} className="text-good" />
        <h2 className="font-display text-3xl font-bold">Session complete</h2>
        <p className="text-ink-quiet">
          {right} of {results.length} recalled{xp > 0 ? ` · +${xp} XP` : ""}. Each answer has been scheduled for its next review.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={onExit}>
            Done
          </Button>
          <ButtonLink href="/">Back to the city</ButtonLink>
        </div>
      </motion.div>
    );
  }

  const order = seededShuffle(card.question.choices.map((_, i) => i), `${card.entry.conceptId}:${card.review?.reviews ?? 0}`);

  const submit = async (confidence: Confidence) => {
    if (chosen === null) return;
    setLocked(true);
    const correct = card.question.choices[chosen].correct;
    const seconds = Math.round((Date.now() - shownAt.current) / 1000);
    const n = (card.review?.reviews ?? 0) + 1;
    const at = new Date().toISOString();
    const xp = mode === "due" ? (correct ? REVIEW_XP.correct : REVIEW_XP.wrong) : 0;
    const repo = getRepository();
    try {
      // Practice on weak spots doesn't move the schedule; only due reviews do.
      if (mode === "due") {
        await repo.recordEvent({ id: `review:${card.entry.conceptId}:r${n}`, type: "reviewGraded", conceptId: card.entry.conceptId, outcome: { correct, usedHint: false, confidence, seconds }, at });
        await repo.recordEvent({ id: `xp:review:${card.entry.conceptId}:r${n}`, type: "xpEarned", amount: xp, reason: `review:${card.entry.conceptId}`, at });
      }
      await repo.recordEvent({
        id: `attempt:review:${card.entry.conceptId}:${at}`,
        type: "attemptSubmitted",
        attemptId: `review:${card.entry.conceptId}:${at}`,
        itemId: `${card.entry.conceptId}:review`,
        correct,
        confidence,
        hintsUsed: 0,
        seconds,
        at,
      });
    } catch {
      // The answer still counts for this session even if it couldn't be stored.
    }
    setPending({ concept: card.entry.conceptId, correct, xp });
  };

  const next = () => {
    if (pending) setResults([...results, pending]);
    setPending(null);
    setChosen(null);
    setLocked(false);
    shownAt.current = Date.now();
  };
  const answered = pending !== null;
  const lastResult = pending;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onExit}>
          <Icon name="arrowLeft" size={15} /> Exit
        </Button>
        <div className="flex-1">
          <Meter value={index / cards.length} tone="pink" label="Session progress" />
        </div>
        <span className="font-mono text-xs text-ink-quiet">
          {index + 1}/{cards.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 40, rotate: 1 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -40, rotate: -1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/80 p-6 shadow-card">
          <p className="font-mono text-xs uppercase tracking-widest text-pink">{card.entry.conceptName}</p>
          <h2 className="text-xl font-semibold leading-snug">
            <Rich text={card.question.prompt} inline />
          </h2>
          <fieldset className="flex flex-col gap-2" disabled={answered}>
            <legend className="sr-only">Choose an answer</legend>
            {order.map((i) => {
              const choice = card.question.choices[i];
              const reveal = answered && (chosen === i || choice.correct);
              return (
                <Button
                  key={i}
                  variant="choice"
                  aria-pressed={chosen === i}
                  onClick={() => setChosen(i)}
                  className={`${chosen === i && !answered ? "border-player bg-player/10" : ""} ${reveal ? (choice.correct ? "border-good bg-good/10" : "border-fail bg-fail/10") : ""} disabled:opacity-100`}
                >
                  <span>
                    <Rich text={choice.text} inline />
                    {reveal && <span className="sr-only">{choice.correct ? " (correct)" : " (incorrect)"}</span>}
                  </span>
                </Button>
              );
            })}
          </fieldset>

          {!answered ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-quiet">Lock it in. How sure are you?</span>
              {(["sure", "unsure", "guessing"] as Confidence[]).map((c) => (
                <Button key={c} disabled={chosen === null || locked} onClick={() => void submit(c)} className="capitalize">
                  {c}
                </Button>
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col gap-3 rounded-2xl border p-4 ${lastResult?.correct ? "border-good/60 bg-good/5" : "border-fail/60 bg-fail/5"}`} role="status">
              <p className="font-semibold">{lastResult?.correct ? `Recalled!${lastResult.xp ? ` +${lastResult.xp} XP` : ""}` : "Not this time. It'll come back sooner."}</p>
              <p className="text-sm text-ink-quiet">
                <Rich text={card.question.choices.find((c) => c.correct)!.why} inline />
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={next}>
                  {index === cards.length - 1 ? "Finish" : "Next card"} <Icon name="arrowRight" size={15} />
                </Button>
                <ButtonLink href={`/codex/${card.entry.levelId}/`} variant="ghost">
                  Open the cheat sheet
                </ButtonLink>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
