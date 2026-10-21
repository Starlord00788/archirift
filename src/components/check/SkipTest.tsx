"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import { useCatalog } from "@/components/shell/Providers";
import { passMark, scoreDiagnostic, type Diagnostic } from "@/game/diagnostic";
import { getRepository } from "@/persistence/client";
import type { LearningEvent } from "@/persistence/types";
import { useLearning } from "@/persistence/useLearning";
import { choiceOrder } from "@/rift/state";
import { Rich } from "@/rift/ui/Rich";
import { useChoiceKeys } from "@/rift/ui/useChoiceKeys";

/**
 * A district's skip test. Answers are not marked one by one (so the check can't be learned by
 * retrying); at the end, a pass takes the district's levels off the learner's path and schedules
 * the concepts they got right for a review a few days later, which is the real proof.
 */
export function SkipTest({ diagnostic }: { diagnostic: Diagnostic }) {
  const { levels } = useCatalog();
  const { progress } = useLearning();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const recorded = useRef(false);

  const total = diagnostic.questions.length;
  const need = passMark(total);
  const index = answers.length;
  const finished = startedAt !== null && index >= total;
  const result = finished ? scoreDiagnostic(diagnostic, answers) : null;
  const titleOf = (id: string) => levels.find((l) => l.id === id)?.title ?? id;

  const question = !finished && startedAt ? diagnostic.questions[index] : null;
  const order = useMemo(() => (question && startedAt ? choiceOrder(question.choices.length, `${startedAt}:check:${index}`) : []), [question, startedAt, index]);
  const pick = (position: number) => {
    if (!question) return;
    setAnswers((a) => [...a, order[position]]);
  };
  useChoiceKeys(question ? order.length : 0, pick);

  // Record the attempt once it's finished.
  useEffect(() => {
    if (!result || !startedAt || recorded.current) return;
    recorded.current = true;
    const at = new Date().toISOString();
    const key = `check:${diagnostic.worldId}:${startedAt}`;
    const events: LearningEvent[] = diagnostic.questions.map((q, i) => ({
      id: `attempt:${key}:${i}`,
      type: "attemptSubmitted",
      attemptId: `${key}:${i}`,
      itemId: `${q.conceptId}:check`,
      correct: q.choices[answers[i]]?.correct === true,
      hintsUsed: 0,
      seconds: 0,
      at,
    }));
    if (result.passed) {
      const sealed = new Set(progress?.completedLessons ?? []);
      for (const [i, q] of diagnostic.questions.entries()) {
        if (q.choices[answers[i]]?.correct) {
          events.push({ id: `review:${q.conceptId}:${key}`, type: "reviewGraded", conceptId: q.conceptId, outcome: { correct: true, usedHint: false, confidence: "sure", seconds: 30 }, at });
        }
      }
      events.push({
        id: `testout:${key}`,
        type: "levelsTestedOut",
        worldId: diagnostic.worldId,
        levelIds: diagnostic.levelIds.filter((id) => !sealed.has(id)),
        correct: result.correct,
        total: result.total,
        at,
      });
    }
    setSaved("saving");
    const repo = getRepository();
    (async () => {
      for (const event of events) await repo.recordEvent(event);
    })()
      .then(() => setSaved("saved"))
      .catch(() => setSaved("failed"));
  }, [result, startedAt, answers, diagnostic, progress]);

  const restart = () => {
    recorded.current = false;
    setAnswers([]);
    setSaved("idle");
    setStartedAt(new Date().toISOString());
  };

  if (!startedAt) {
    return (
      <section className="flex flex-col gap-5" aria-labelledby="check-heading">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-flow">Skip test</p>
        <h1 id="check-heading" className="font-display text-4xl font-bold tracking-tight">
          Already know {diagnostic.worldName}?
        </h1>
        <p className="max-w-xl text-ink-quiet">
          Answer {total} interview questions from across the district. Get {need} right and its {diagnostic.levelIds.length} levels come off your path, so you can spend your time on what you
          don&apos;t know yet.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-ink-quiet">
          <li className="flex gap-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-good" /> About {Math.max(2, Math.round(total * 0.6))} minutes. No timer.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-good" /> Skipped levels stay playable. They just stop being next on your list.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-good" /> What you get right comes back in your reviews in a few days, to check it really stuck.
          </li>
        </ul>
        <Button variant="primary" className="w-fit" onClick={restart}>
          Start the check <Icon name="arrowRight" size={15} />
        </Button>
      </section>
    );
  }

  if (result) {
    return (
      <section className="flex flex-col gap-5" aria-labelledby="check-result">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-flow">Skip test · {diagnostic.worldName}</p>
        <h1 id="check-result" className="font-display text-4xl font-bold tracking-tight">
          {result.passed ? `You know ${diagnostic.worldName}.` : "Not quite yet, and that's useful to know."}
        </h1>
        <p className="font-mono text-sm text-ink-quiet">
          {result.correct} of {result.total} right · needed {need}
        </p>
        {result.passed ? (
          <p className="max-w-xl text-ink-quiet">
            Its levels are off your path. The {result.correct} {result.correct === 1 ? "idea" : "ideas"} you got right will come back in your reviews in a few days; recalling them
            then is the real proof.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="max-w-xl text-ink-quiet">These are the gaps worth your time. Start with the first one; each level takes about ten minutes.</p>
            <ul className="flex flex-col gap-2">
              {result.missed.map((id) => (
                <li key={id}>
                  <ButtonLink href={`/levels/${id}/`} variant="ghost" className="w-full justify-between border border-line px-4 py-3">
                    {titleOf(id)} <Icon name="arrowRight" size={15} />
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p role="status" className="text-xs text-ink-quiet">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved." : saved === "failed" ? "Your result couldn't be saved on this device." : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          {result.passed ? (
            <ButtonLink href="/" variant="primary">
              Back to my plan <Icon name="arrowRight" size={15} />
            </ButtonLink>
          ) : (
            <ButtonLink href={`/levels/${result.missed[0]}/`} variant="primary">
              Start with {titleOf(result.missed[0])} <Icon name="arrowRight" size={15} />
            </ButtonLink>
          )}
          {!result.passed && (
            <Button variant="ghost" onClick={restart}>
              Try the check again
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={`Skip test: ${diagnostic.worldName}`}>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs text-ink-quiet">
          Question {index + 1} of {total} · from &ldquo;{question!.levelTitle}&rdquo;
        </p>
        <Meter value={index / total} label="Skip test progress" height={6} />
      </div>
      <AnimatePresence mode="wait">
        <motion.fieldset key={index} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">
            <Rich text={question!.prompt} inline />
          </legend>
          {order.map((c, position) => (
            <Button key={c} variant="choice" onClick={() => pick(position)}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-line font-mono text-xs text-ink-quiet">{String.fromCharCode(65 + position)}</span>
              <span>
                <Rich text={question!.choices[c].text} inline />
              </span>
            </Button>
          ))}
        </motion.fieldset>
      </AnimatePresence>
      <p className="text-xs text-ink-quiet">Answers aren&apos;t marked until the end. You can answer with the letter or number keys.</p>
    </section>
  );
}
