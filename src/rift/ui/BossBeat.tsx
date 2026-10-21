"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import { bossFight, choiceOrder } from "../state";
import { Rich } from "./Rich";
import { useChoiceKeys } from "./useChoiceKeys";
import type { BeatProps } from "./types";

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const BODIES = [
  "M 20 70 C 20 30, 100 30, 100 70 L 100 96 L 88 86 L 76 98 L 64 86 L 52 98 L 40 86 L 28 98 L 20 90 Z",
  "M 60 22 L 100 52 L 92 98 L 28 98 L 20 52 Z",
  "M 24 98 L 24 50 Q 24 26 60 26 Q 96 26 96 50 L 96 98 L 80 88 L 60 98 L 40 88 Z",
  "M 60 20 C 98 20, 104 60, 96 98 L 24 98 C 16 60, 22 20, 60 20 Z",
];
const HORNS = [
  "M 30 44 L 18 18 L 42 36 M 90 44 L 102 18 L 78 36",
  "M 40 30 Q 30 8 14 12 M 80 30 Q 90 8 106 12",
  "M 50 26 L 54 8 L 60 24 L 66 8 L 70 26",
  "M 28 50 L 8 40 M 92 50 L 112 40 M 32 40 L 20 22 M 88 40 L 100 22",
];
const MOUTHS = ["M 46 80 Q 60 72 74 80", "M 44 78 L 52 84 L 60 78 L 68 84 L 76 78", "M 48 80 L 72 80", "M 46 76 Q 60 90 74 76"];

/** A rift creature built from the boss's name, so each boss looks like itself, in the world's colour. */
function BossFigure({ name, accent, hurt, state }: { name: string; accent: string; hurt: number; state: "fighting" | "defeated" | "victorious" }) {
  const controls = useAnimationControls();
  const look = useMemo(() => {
    const h = hash(name);
    const eyes = 1 + ((h >>> 8) % 3);
    return { body: BODIES[h % BODIES.length], horns: HORNS[(h >>> 4) % HORNS.length], mouth: MOUTHS[(h >>> 12) % MOUTHS.length], eyes };
  }, [name]);
  useEffect(() => {
    if (hurt > 0) void controls.start({ x: [0, -10, 10, -6, 6, 0], filter: ["brightness(1)", "brightness(2.2)", "brightness(1)"], transition: { duration: 0.45 } });
  }, [hurt, controls]);
  const eyeXs = look.eyes === 1 ? [60] : look.eyes === 2 ? [45, 75] : [40, 60, 80];
  return (
    <motion.svg viewBox="0 0 120 120" className="h-28 w-28 sm:h-32 sm:w-32" aria-hidden="true" animate={controls}>
      <motion.g
        animate={state === "defeated" ? { rotate: 90, opacity: 0.35, y: 18 } : state === "victorious" ? { scale: [1, 1.12, 1.06], y: [0, -6, -2] } : { y: [0, -4, 0] }}
        transition={state === "fighting" ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.8 }}
        style={{ originX: "60px", originY: "60px" }}
      >
        <path d={look.body} fill="var(--surface-2)" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
        <path d={look.horns} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        {eyeXs.map((x) => (
          <g key={x}>
            <circle cx={x} cy="60" r={look.eyes === 3 ? 6 : 8} fill={accent} />
            <circle cx={x + 2} cy="59" r={look.eyes === 3 ? 2 : 3} fill="var(--bg)" />
          </g>
        ))}
        <path d={look.mouth} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 58 36 L 62 46 L 56 52 L 64 60" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" opacity={0.4 + hurt * 0.2} />
      </motion.g>
    </motion.svg>
  );
}

/** Proof: the interview boss. Each right answer is a hit; each wrong answer breaks a shield. */
export function BossBeat({ info, state, dispatch }: BeatProps) {
  const { boss } = info.rift;
  const accent = `var(--${info.world.accent})`;
  const fight = bossFight(info.rift, state);
  const current = state.boss.answers.findIndex((a) => a === null);
  const [reveal, setReveal] = useState<number | null>(null);
  const finished = fight.over && reveal === null;
  const showing = finished ? null : (reveal ?? (current === -1 ? null : current));
  const question = showing === null ? null : boss.questions[showing];
  const order = useMemo(
    () => (question && showing !== null ? choiceOrder(question.choices.length, `${state.startedAt}:boss:${state.boss.round}:${showing}`) : []),
    [question, showing, state.startedAt, state.boss.round],
  );
  const locked = showing !== null && state.boss.answers[showing] !== null;
  const hp = 1 - fight.right / fight.total;

  const answer = (choice: number) => {
    if (showing === null || locked) return;
    dispatch({ type: "bossAnswer", question: showing, choice });
    setReveal(showing);
  };
  useChoiceKeys(showing !== null && !locked ? order.length : 0, (i) => answer(order[i]));

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface/60 p-5 text-center" aria-label="Boss">
        <BossFigure name={boss.name} accent={accent} hurt={fight.right} state={finished ? (fight.won ? "defeated" : "victorious") : "fighting"} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: accent }}>
            Interview boss{state.boss.round > 0 ? ` · rematch ${state.boss.round}` : ""}
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
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1.5" aria-label={`${fight.shieldsLeft} of ${fight.shields} shields left`}>
            {Array.from({ length: fight.shields }, (_, i) => (
              <motion.span key={i} animate={{ scale: i < fight.shieldsLeft ? 1 : 0.7, opacity: i < fight.shieldsLeft ? 1 : 0.2, rotate: i < fight.shieldsLeft ? 0 : -20 }} className="text-pink">
                <Icon name="heart" size={20} filled />
              </motion.span>
            ))}
          </div>
          <p className="font-mono text-[11px] text-ink-quiet">
            Land {fight.need} of {fight.total} · lose every shield and it wins
          </p>
        </div>
      </aside>

      <div className="flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {question && showing !== null ? (
            <motion.fieldset key={`${state.boss.round}-${showing}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-2">
              <legend className="mb-3 flex flex-col gap-1">
                <span className="font-mono text-xs text-ink-quiet">
                  Question {showing + 1} of {fight.total}
                </span>
                <span className="text-lg font-semibold leading-snug">
                  <Rich text={question.prompt} inline />
                </span>
              </legend>
              {order.map((i, position) => {
                const choice = question.choices[i];
                const chosen = state.boss.answers[showing] === i;
                const tone = locked && (chosen || choice.correct) ? (choice.correct ? "border-good bg-good/10" : "border-fail bg-fail/10") : "";
                return (
                  <Button key={i} variant="choice" disabled={locked} aria-pressed={chosen} onClick={() => answer(i)} className={`${tone} disabled:opacity-100`}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-line font-mono text-xs text-ink-quiet">{String.fromCharCode(65 + position)}</span>
                    <span>
                      <Rich text={choice.text} inline />
                      {locked && (chosen || choice.correct) && <span className="sr-only">{choice.correct ? " (correct)" : " (incorrect)"}</span>}
                    </span>
                  </Button>
                );
              })}
              {!locked && <p className="hidden font-mono text-[11px] text-ink-quiet md:block">Keys A–{String.fromCharCode(64 + order.length)} or 1–{order.length} answer.</p>}
              {reveal !== null && (
                <Button variant="primary" className="mt-2 w-fit" onClick={() => setReveal(null)} autoFocus>
                  {fight.over ? "See the result" : "Next question"} <Icon name="arrowRight" size={15} />
                </Button>
              )}
            </motion.fieldset>
          ) : (
            <motion.div key={`result-${state.boss.round}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`flex flex-col gap-3 rounded-2xl border p-5 ${fight.won ? "border-good/60 bg-good/5" : "border-fail/60 bg-fail/5"}`}>
              <p className="font-display text-2xl font-bold">{fight.won ? `${boss.name} is defeated!` : `${boss.name} wins this round.`}</p>
              <p className="text-sm text-ink-quiet">
                {fight.right} of {fight.total} right.{" "}
                {fight.won
                  ? "That's an offer-worthy answer."
                  : `You needed ${fight.need}. Read the explanations again, then take the rematch: the choices will be reshuffled. You can't seal this rift until the boss falls.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {fight.won ? (
                  <Button variant="primary" className="w-fit" onClick={() => dispatch({ type: "toRecall" })} autoFocus>
                    On to Recall <Icon name="arrowRight" size={15} />
                  </Button>
                ) : (
                  <>
                    <Button variant="primary" className="w-fit" onClick={() => dispatch({ type: "bossRematch" })} autoFocus>
                      Rematch <Icon name="arrowRight" size={15} />
                    </Button>
                    <Button variant="ghost" className="w-fit" onClick={() => dispatch({ type: "toRecall" })}>
                      Practise the recall anyway
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
