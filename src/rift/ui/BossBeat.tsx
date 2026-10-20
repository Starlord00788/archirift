"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import { bossScore } from "../state";
import { Rich } from "./Rich";
import type { BeatProps } from "./types";

/** A boss drawn from simple shapes: a rift creature in the world's colour. */
function BossFigure({ accent, hurt, defeated }: { accent: string; hurt: number; defeated: boolean }) {
  const controls = useAnimationControls();
  useEffect(() => {
    if (hurt > 0) void controls.start({ x: [0, -10, 10, -6, 6, 0], filter: ["brightness(1)", "brightness(2.2)", "brightness(1)"], transition: { duration: 0.45 } });
  }, [hurt, controls]);
  return (
    <motion.svg viewBox="0 0 120 120" className="h-28 w-28 sm:h-32 sm:w-32" aria-hidden="true" animate={controls}>
      <motion.g animate={defeated ? { rotate: 90, opacity: 0.35, y: 18 } : { y: [0, -4, 0] }} transition={defeated ? { duration: 0.8 } : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }} style={{ originX: "60px", originY: "60px" }}>
        <path d="M 20 70 C 20 30, 100 30, 100 70 L 100 96 L 88 86 L 76 98 L 64 86 L 52 98 L 40 86 L 28 98 L 20 90 Z" fill="var(--surface-2)" stroke={accent} strokeWidth="3" />
        <path d="M 30 44 L 18 18 L 42 36 M 90 44 L 102 18 L 78 36" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="62" r="8" fill={accent} />
        <circle cx="75" cy="62" r="8" fill={accent} />
        <circle cx="47" cy="61" r="3" fill="var(--bg)" />
        <circle cx="77" cy="61" r="3" fill="var(--bg)" />
        <path d="M 46 80 Q 60 72 74 80" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path d="M 58 36 L 62 46 L 56 52 L 64 60" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
    </motion.svg>
  );
}

/** Proof: the interview boss. Each right answer is a hit; wrong answers cost a shield. */
export function BossBeat({ info, state, dispatch }: BeatProps) {
  const { boss } = info.rift;
  const accent = `var(--${info.world.accent})`;
  const answered = state.boss.answers.filter((a) => a !== null).length;
  const current = state.boss.answers.findIndex((a) => a === null);
  const [reveal, setReveal] = useState<number | null>(null);
  const { right, total } = bossScore(info.rift, state);
  const wrong = answered - right;
  const finished = current === -1 && reveal === null;
  const showing = reveal ?? (current === -1 ? null : current);
  const question = showing === null ? null : boss.questions[showing];
  const hp = 1 - right / total;
  const defeated = finished && right / total >= 0.5;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface/60 p-5 text-center" aria-label="Boss">
        <BossFigure accent={accent} hurt={right} defeated={defeated} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: accent }}>
            Interview boss
          </p>
          <h2 className="font-display text-xl font-bold">{boss.name}</h2>
          <p className="mt-1 text-sm italic text-ink-quiet">&ldquo;{boss.taunt}&rdquo;</p>
        </div>
        <div className="w-full">
          <p className="mb-1 flex justify-between font-mono text-xs text-ink-quiet">
            <span>Boss HP</span>
            <span>{Math.round(hp * 100)}%</span>
          </p>
          <Meter value={hp} tone="fail" label="Boss health" height={10} />
        </div>
        <div className="flex gap-1.5" aria-label={`${Math.max(0, 3 - wrong)} shields left`}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ scale: i < 3 - wrong ? 1 : 0.7, opacity: i < 3 - wrong ? 1 : 0.25 }} className="text-pink">
              <Icon name="heart" size={20} filled />
            </motion.span>
          ))}
        </div>
      </aside>

      <div className="flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {question && showing !== null ? (
            <motion.fieldset key={showing} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-2">
              <legend className="mb-3 flex flex-col gap-1">
                <span className="font-mono text-xs text-ink-quiet">
                  Question {showing + 1} of {total}
                </span>
                <span className="text-lg font-semibold leading-snug">
                  <Rich text={question.prompt} inline />
                </span>
              </legend>
              {question.choices.map((choice, i) => {
                const chosen = state.boss.answers[showing] === i;
                const locked = state.boss.answers[showing] !== null;
                const tone = locked && (chosen || choice.correct) ? (choice.correct ? "border-good bg-good/10" : "border-fail bg-fail/10") : "";
                return (
                  <Button
                    key={i}
                    variant="choice"
                    disabled={locked}
                    aria-pressed={chosen}
                    onClick={() => {
                      dispatch({ type: "bossAnswer", question: showing, choice: i });
                      setReveal(showing);
                    }}
                    className={`${tone} disabled:opacity-100`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-line font-mono text-xs text-ink-quiet">{String.fromCharCode(65 + i)}</span>
                    <span>
                      <Rich text={choice.text} inline />
                      {locked && (chosen || choice.correct) && <span className="sr-only">{choice.correct ? " (correct)" : " (incorrect)"}</span>}
                    </span>
                  </Button>
                );
              })}
              {reveal !== null && (
                <Button variant="primary" className="mt-2 w-fit" onClick={() => setReveal(null)}>
                  {current === -1 ? "See the result" : "Next question"} <Icon name="arrowRight" size={15} />
                </Button>
              )}
            </motion.fieldset>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`flex flex-col gap-3 rounded-2xl border p-5 ${defeated ? "border-good/60 bg-good/5" : "border-warn/60 bg-warn/5"}`}>
              <p className="font-display text-2xl font-bold">{defeated ? `${boss.name} is defeated!` : `${boss.name} escaped… for now.`}</p>
              <p className="text-sm text-ink-quiet">
                {right} of {total} right. {defeated ? "That's an offer-worthy answer." : "It will come back in your spaced reviews; that's how you'll beat it."}
              </p>
              {finished && (
                <Button variant="primary" className="w-fit" onClick={() => dispatch({ type: "toRecall" })}>
                  On to Recall <Icon name="arrowRight" size={15} />
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
