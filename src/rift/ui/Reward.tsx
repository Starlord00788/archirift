"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodexCard } from "@/components/CodexCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { Counter } from "@/components/ui/Counter";
import { TowerRise } from "@/components/fx/TowerRise";
import { Icon } from "@/components/ui/Icon";
import { getRepository } from "@/persistence/client";
import type { LearningEvent, ReviewRecord } from "@/persistence/types";
import { riftOutcome, riftXp, type RiftState } from "../state";
import type { RiftLevelInfo } from "./types";

/**
 * Records the attempt once (ids are deterministic) and schedules the next review. Only a beaten boss
 * plus a passed recall seals the rift; anything less is a practice run that the review queue
 * brings back soon.
 */
export function Reward({ info, state, attempt, complete, restart }: { info: RiftLevelInfo; state: RiftState; attempt: number; complete: () => Promise<void>; restart: () => Promise<void> }) {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [xpNew, setXpNew] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const recorded = useRef(false);

  const { boss, recall, sealed, flawless } = riftOutcome(info.rift, state);
  const xp = riftXp(info.rift, state, info.difficulty);
  const minutes = Math.max(1, Math.round((Date.parse(state.finishedAt ?? new Date().toISOString()) - Date.parse(state.startedAt)) / 60000));

  const events = useMemo<LearningEvent[]>(() => {
    const at = state.finishedAt ?? new Date().toISOString();
    const key = `${info.id}#${attempt}`;
    const confidence = state.recall.confidence ?? "unsure";
    const list: LearningEvent[] = [
      { id: `attempt:${key}:boss`, type: "attemptSubmitted", attemptId: `${key}:boss`, itemId: `${info.concept.id}:boss`, correct: boss.won, score: Math.round((boss.right / boss.total) * 100), hintsUsed: 0, seconds: 0, at },
      { id: `attempt:${key}:recall`, type: "attemptSubmitted", attemptId: `${key}:recall`, itemId: `${info.concept.id}:blank-blueprint`, correct: recall.passed, score: Math.round(recall.score * 100), confidence, hintsUsed: state.hintsUsed, seconds: minutes * 60, at },
      { id: `review:${info.concept.id}:${key}`, type: "reviewGraded", conceptId: info.concept.id, outcome: { correct: sealed, usedHint: state.hintsUsed > 0, confidence, seconds: 60 }, at },
    ];
    if (sealed) {
      list.push({ id: `lessonCompleted:${info.id}`, type: "lessonCompleted", lessonId: info.id, at });
      list.push({ id: `xp:level:${info.id}`, type: "xpEarned", amount: xp.total, reason: `level:${info.id}`, at });
    } else {
      list.push({ id: `xp:practice:${info.id}`, type: "xpEarned", amount: xp.total, reason: `practice:${info.id}`, at });
    }
    if (flawless) list.push({ id: "achievement:flawless", type: "achievementEarned", achievementId: "flawless", at });
    return list;
    // Built once per attempt; deterministic ids make re-recording harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const repo = getRepository();
    (async () => {
      for (const event of events) {
        const { duplicate } = await repo.recordEvent(event);
        if (event.type === "xpEarned") setXpNew(!duplicate);
      }
      await complete();
      setReview((await repo.getReview(info.concept.id)) ?? null);
    })().catch(() => setFailed(true));
  }, [events, complete, info.concept.id]);

  const days = review ? Math.max(1, Math.round((new Date(review.due).getTime() - Date.now()) / 86_400_000)) : null;
  const checks = [
    { label: "Beat the boss", detail: `${boss.right}/${boss.total} · need ${boss.need}`, ok: boss.won },
    { label: "Rebuild it from memory", detail: `${Math.round(recall.score * 100)}% · need 80%`, ok: recall.passed },
  ];

  return (
    <section className="flex flex-col gap-8" aria-labelledby="reward-heading">
      {sealed && <Confetti />}
      <div className="flex flex-col items-center gap-3 text-center">
        <TowerRise size={88} built={sealed ? 5 : 2 + Number(boss.won) + Number(recall.passed)} />
        <motion.h2 id="reward-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="font-display text-4xl font-bold tracking-tight">
          {sealed ? "The rift is sealed." : "The rift is holding, not sealed."}
        </motion.h2>
        <p className="max-w-xl text-ink-quiet">
          {sealed ? (
            <>
              You beat the boss and rebuilt <strong className="text-ink">{info.concept.name}</strong> from memory. That&apos;s the part that makes it stick.
            </>
          ) : (
            <>
              You&apos;ve seen how <strong className="text-ink">{info.concept.name}</strong> works, but it didn&apos;t hold up under pressure yet. Its building stays under construction until
              you can do both.
            </>
          )}
        </p>
        <ul className="flex flex-wrap justify-center gap-2" aria-label="What sealing takes">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${c.ok ? "border-good/60 text-good" : "border-fail/60 text-fail"}`}>
              <Icon name={c.ok ? "check" : "x"} size={14} />
              <span className="text-ink">{c.label}</span>
              <span className="font-mono text-xs text-ink-quiet">{c.detail}</span>
            </li>
          ))}
        </ul>
        {sealed && (
          <ButtonLink href={`/#city-${info.world.id}`} variant="ghost" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-quiet">
            Watch it rise on your city map <Icon name="arrowRight" size={12} />
          </ButtonLink>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex flex-col gap-2 rounded-2xl border border-flow/50 bg-flow/5 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-flow">Experience</p>
          <p className="font-display text-4xl font-bold">
            +<Counter value={xpNew === false ? 0 : xp.total} /> <span className="text-lg text-ink-quiet">XP</span>
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-ink-quiet">
            {xp.parts.map((p) => (
              <li key={p.label} className="flex justify-between">
                <span>{p.label}</span>
                <span className="font-mono">+{p.xp}</span>
              </li>
            ))}
          </ul>
          {xpNew === false && <p className="text-xs text-warn">{sealed ? "You already earned XP for this level. Replays are for practice." : "Practice XP is earned once per level."}</p>}
          {!sealed && <p className="text-xs text-ink-quiet">Seal it for the full level reward.</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/60 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-player">Your run</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex justify-between">
              <span>Boss{state.boss.round > 0 ? ` (round ${state.boss.round + 1})` : ""}</span>
              <span className="font-mono">
                {boss.right}/{boss.total}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Recall</span>
              <span className="font-mono">{Math.round(recall.score * 100)}%</span>
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
          {flawless && <p className="w-fit rounded-full bg-lime px-2 py-0.5 font-mono text-[11px] font-bold text-bg">FLAWLESS</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex flex-col gap-2 rounded-2xl border border-pink/50 bg-pink/5 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-pink">Memory</p>
          <p role="status" className="text-sm">
            {failed
              ? "Your result couldn't be saved on this device."
              : days !== null
                ? sealed
                  ? `Your first review of ${info.concept.name} is due in ${days} ${days === 1 ? "day" : "days"}. Recalling it then is what makes it last.`
                  : `${info.concept.name} comes back in your review queue in ${days} ${days === 1 ? "day" : "days"}, sooner than if you'd sealed it.`
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
            {info.next ? (
              <ButtonLink href={`/levels/${info.next.id}/`} variant="primary">
                Next: {info.next.title} <Icon name="arrowRight" size={15} />
              </ButtonLink>
            ) : null}
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
            <ButtonLink href={`/codex/${info.id}/`}>Study the cheat sheet</ButtonLink>
            <ButtonLink href="/" variant="ghost">
              Back to the city
            </ButtonLink>
          </>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-display text-2xl font-bold">Your cheat sheet</h3>
        <CodexCard name={info.concept.name} codex={info.rift.codex} />
      </div>
    </section>
  );
}
