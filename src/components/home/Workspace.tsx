"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useCatalog } from "@/components/shell/Providers";
import { buttonStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Meter } from "@/components/ui/Meter";
import { HORIZON_LABEL, TRACK_LABEL, formatMinutes, planStatus } from "@/game/paths";
import { rankFor } from "@/game/ranks";
import { currentStreak } from "@/persistence/progress";
import type { Progress } from "@/persistence/types";
import { useLearning } from "@/persistence/useLearning";
import { useAuth } from "@/sync/AuthProvider";
import { PlanPicker } from "./PlanPicker";

const RETURNING_KEY = "archirift:returning";

/** Plain words for where someone stopped inside a level. */
const BEAT_WORDS: Record<string, string> = {
  pain: "watching it break",
  play: "fixing it",
  proof: "the interview questions",
  recall: "rebuilding it from memory",
};

/** Anyone who has done something, or made a plan, gets the workspace instead of the brochure. */
export function isReturning(progress: Progress | null): boolean {
  return Boolean(progress && (progress.goal || progress.current || progress.completedLessons.length || progress.activeDays.length || progress.testedOut?.length));
}

/**
 * Switches the home page between first visit (hero, plan picker) and the workspace. A flag in
 * localStorage, read before first paint by the layout's inline script, keeps returning learners
 * from seeing the hero flash first; this keeps the flag and the page in step.
 */
export function useHomeMode() {
  const { progress, failed } = useLearning();
  useEffect(() => {
    if (!progress || failed) return;
    const returning = isReturning(progress);
    try {
      if (returning) window.localStorage.setItem(RETURNING_KEY, "1");
      else window.localStorage.removeItem(RETURNING_KEY);
    } catch {
      /* private mode: the page still switches below */
    }
    if (returning) document.documentElement.setAttribute("data-returning", "");
    else document.documentElement.removeAttribute("data-returning");
  }, [progress, failed]);
}

/** The returning learner's home: one next action, their plan, their reviews. */
export function Workspace() {
  useHomeMode();
  const catalog = useCatalog();
  const { progress, due, failed } = useLearning();
  const { status } = useAuth();
  const [editing, setEditing] = useState(false);

  if (failed) {
    return (
      <p role="status" className="rounded-2xl border border-warn p-4 text-sm">
        Progress can&apos;t be saved on this device (storage may be blocked, for example in private browsing).
      </p>
    );
  }
  if (!progress) return <div className="h-64 rounded-3xl border border-line bg-surface/40" aria-hidden="true" />;

  const plan = planStatus(progress, catalog);
  const current = progress.current;
  const unfinished = current && !progress.completedLessons.includes(current.lessonId) ? catalog.levels.find((l) => l.id === current.lessonId) : undefined;
  const firstOpen = catalog.levels.find((l) => l.playable && !progress.completedLessons.includes(l.id) && !progress.testedOut?.includes(l.id));
  const next = plan?.next ?? firstOpen ?? null;
  const streak = currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10));
  const { rank } = rankFor(progress.xp);
  const guest = status === "signed-out";

  // Districts on the plan with work left, where a skip test could save time.
  const testable = plan
    ? [...new Map(plan.remaining.map((l) => [l.world, l])).keys()]
        .map((id) => catalog.worlds.find((w) => w.id === id)!)
        .filter((w) => plan.remaining.filter((l) => l.world === w.id).length >= 2)
        .slice(0, 3)
    : [];

  const card = "flex flex-col gap-3 rounded-3xl border border-line bg-surface/70 p-6";
  return (
    <section aria-labelledby="workspace-heading" className="flex flex-col gap-4 pt-8">
      <h1 id="workspace-heading" className="sr-only">
        Your workspace
      </h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* One clear next action. */}
        <div className={`${card} border-flow/60 bg-linear-to-br from-flow/10 to-lamp/5`}>
          {unfinished ? (
            <>
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-flow">
                <Icon name="play" size={13} filled /> Pick up where you left off
              </p>
              <Link href={`/levels/${unfinished.id}/`} className="group flex flex-col gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-flow">
                <span className="font-display text-3xl font-bold tracking-tight group-hover:text-flow">
                  <span className="sr-only">Continue </span>
                  {unfinished.title}
                </span>
                <span className="text-sm text-ink-quiet">
                  You were {BEAT_WORDS[current!.activity] ?? "in the middle of it"}. About {unfinished.minutes} minutes for the whole level.
                </span>
                <span className={`${buttonStyles.primary} mt-3 inline-flex w-fit items-center gap-2 rounded-xl text-sm font-semibold`} aria-hidden="true">
                  Continue <Icon name="arrowRight" size={15} />
                </span>
              </Link>
            </>
          ) : next ? (
            <>
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-flow">
                <Icon name="sparkles" size={13} /> {plan ? "Next on your plan" : "Up next"}
              </p>
              <Link href={`/levels/${next.id}/`} className="group flex flex-col gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-flow">
                <span className="font-display text-3xl font-bold tracking-tight group-hover:text-flow">{next.title}</span>
                <span className="text-sm text-ink-quiet">
                  {next.conceptName} · about {next.minutes} minutes
                </span>
                <span className={`${buttonStyles.primary} mt-3 inline-flex w-fit items-center gap-2 rounded-xl text-sm font-semibold`} aria-hidden="true">
                  Start it <Icon name="arrowRight" size={15} />
                </span>
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-good">Everything on your plan is done</p>
              <p className="font-display text-3xl font-bold tracking-tight">Now keep it fresh.</p>
              <p className="text-sm text-ink-quiet">Your reviews and the Arena are the best use of your time from here.</p>
            </>
          )}
        </div>

        {/* Reviews and the little numbers. */}
        <div className="grid grid-cols-1 gap-4">
          <Link href="/review/" className={`${card} hover:border-pink`}>
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-pink">
              <Icon name="brain" size={13} /> Reviews
            </p>
            <p className="font-display text-2xl font-bold">
              {due.length > 0 ? `${due.length} due now` : "Nothing due"}
              {due.length > 0 && <span className="ml-2 text-sm font-medium text-ink-quiet">about {Math.max(1, Math.round(due.length * 0.75))} min</span>}
            </p>
            <p className="text-xs text-ink-quiet">{due.length > 0 ? "A quick recall now is what makes the levels stick." : "Each level you finish adds its idea here, spaced out over weeks."}</p>
          </Link>
          <Link href="/profile/" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/50 px-5 py-3 text-sm hover:border-line-strong">
            <span className={`flex items-center gap-1.5 ${streak > 0 ? "text-warn" : "text-ink-quiet"}`}>
              <Icon name="flame" size={15} filled={streak > 0} /> {streak} day{streak === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1.5 text-ink-quiet">
              <Icon name="bolt" size={14} className="text-flow" filled /> {progress.xp.toLocaleString("en-IN")} XP · {rank.name}
            </span>
          </Link>
        </div>
      </div>

      {/* The plan. */}
      <div className={card} id="your-plan">
        <AnimatePresence mode="wait" initial={false}>
          {plan && !editing ? (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-flow">Your plan</p>
                  <h2 className="font-display text-2xl font-bold">
                    {TRACK_LABEL[plan.goal.track]}, {HORIZON_LABEL[plan.goal.horizon]}
                  </h2>
                </div>
                <button type="button" onClick={() => setEditing(true)} className="rounded-lg px-2 py-1 text-sm text-ink-quiet underline hover:text-flow">
                  Change plan
                </button>
              </div>
              <Meter value={(plan.done.length + plan.skipped.length) / Math.max(1, plan.levels.length)} label="Plan progress" height={8} />
              <p className="text-sm text-ink-quiet">
                <strong className="text-ink">
                  {plan.done.length + plan.skipped.length} of {plan.levels.length}
                </strong>{" "}
                done{plan.skipped.length ? ` (${plan.skipped.length} by skip test)` : ""}
                {plan.remaining.length > 0 && <> · about {formatMinutes(plan.minutesLeft)} left</>}
                {plan.perDay && plan.daysLeft ? (
                  <>
                    {" "}
                    · {plan.perDay} a day gets you there in {plan.daysLeft} day{plan.daysLeft === 1 ? "" : "s"}
                  </>
                ) : plan.daysLeft === 0 && plan.remaining.length > 0 ? (
                  <> · your date has passed; keep going at your own pace</>
                ) : null}
              </p>
              {plan.remaining.length > 0 && (
                <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Coming up on your plan">
                  {plan.remaining.slice(0, 3).map((l, i) => (
                    <li key={l.id}>
                      <Link href={`/levels/${l.id}/`} className="flex h-full flex-col gap-0.5 rounded-xl border border-line bg-bg/40 px-4 py-3 hover:border-flow">
                        <span className="font-mono text-[11px] text-ink-quiet">
                          {i === 0 ? "Next" : `Then`} · {l.minutes} min
                        </span>
                        <span className="font-semibold">{l.title}</span>
                        <span className="text-xs text-ink-quiet">{l.conceptName}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {testable.length > 0 && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-quiet">
                  Know some of this already? Take a skip test:
                  {testable.map((w) => (
                    <Link key={w.id} href={`/check/${w.id}/`} className="rounded-full border border-line px-3 py-1 text-ink hover:border-flow hover:text-flow">
                      {w.name}
                    </Link>
                  ))}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-flow">{plan ? "Change your plan" : "Make a plan"}</p>
                <h2 className="font-display text-2xl font-bold">{plan ? "What changed?" : "You don't need all 97 levels. Let's pick yours."}</h2>
              </div>
              <PlanPicker initial={plan?.goal} onDone={() => setEditing(false)} compact />
              {plan && (
                <button type="button" onClick={() => setEditing(false)} className="w-fit text-sm text-ink-quiet underline hover:text-flow">
                  Keep my current plan
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {guest && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-line px-5 py-3 text-sm text-ink-quiet">
          <Icon name="cloudOff" size={15} /> Your progress is saved in this browser only.
          <Link href="/account/" className="font-semibold text-ink underline hover:text-flow">
            Sign in to keep it on your phone too
          </Link>
        </p>
      )}
    </section>
  );
}
