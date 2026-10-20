"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CityScape } from "@/components/fx/CityScape";
import { KineticText } from "@/components/fx/KineticText";
import { useCatalog } from "@/components/shell/Providers";
import { Counter } from "@/components/ui/Counter";
import { Icon } from "@/components/ui/Icon";
import { Meter, ProgressRing } from "@/components/ui/Meter";
import { allAchievements } from "@/game/achievements";
import { RANKS, rankFor } from "@/game/ranks";
import { currentStreak } from "@/persistence/progress";
import { useLearning } from "@/persistence/useLearning";
import { useAuth } from "@/sync/AuthProvider";
import { Leaderboard } from "./Leaderboard";

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function longestStreak(days: string[]) {
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...days].sort()) {
    const t = Date.parse(`${d}T00:00:00Z`);
    run = prev !== null && t - prev === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export function Profile() {
  const catalog = useCatalog();
  const { progress, reviews } = useLearning();
  const { status, account } = useAuth();
  const xp = progress?.xp ?? 0;
  const { rank, next, progress: toNext, index: rankIndex } = rankFor(xp);
  const today = iso(Date.now());
  const days = useMemo(() => progress?.activeDays ?? [], [progress]);
  const streak = currentStreak(days, today);
  const done = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const [cityFocus, setCityFocus] = useState<string | null>(null);
  const router = useRouter();
  const earned = new Set(progress?.achievements ?? []);
  const achievements = allAchievements(catalog);
  const reviewsDone = reviews.reduce((s, r) => s + r.reviews, 0);

  // 18 weeks of activity, Monday-first columns.
  const weeks = useMemo(() => {
    const active = new Set(days);
    const end = Date.parse(`${today}T00:00:00Z`);
    const startDay = end - (18 * 7 - 1) * DAY;
    const offset = (new Date(startDay).getUTCDay() + 6) % 7;
    const start = startDay - offset * DAY;
    const cols: { date: string; on: boolean; future: boolean }[][] = [];
    for (let t = start; t <= end; t += DAY) {
      const i = Math.floor((t - start) / DAY / 7);
      (cols[i] ??= []).push({ date: iso(t), on: active.has(iso(t)), future: t > end });
    }
    return cols;
  }, [days, today]);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface/70 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-player/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-6">
          <ProgressRing value={toNext} size={104} stroke={7} tone="player">
            {account?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.photoURL} alt="" className="h-20 w-20 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-flow to-player font-display text-3xl font-bold text-bg">{(account?.name ?? "G")[0].toUpperCase()}</span>
            )}
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-widest text-player">
              Rank {rankIndex + 1} of {RANKS.length}
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight"><KineticText segments={[{ text: rank.name }]} /></h1>
            <p className="text-ink-quiet">
              {account ? account.name : "Guest architect"} · {rank.tagline}
            </p>
            <div className="mt-3 max-w-md">
              <Meter value={toNext} tone="player" label="Progress to the next rank" />
              <p className="mt-1 font-mono text-xs text-ink-quiet">{next ? `${(next.xp - xp).toLocaleString("en-IN")} XP to ${next.name}` : "You've reached the top rank."}</p>
            </div>
          </div>
          {status === "signed-out" && (
            <Link href="/account/" className="rounded-xl border border-flow px-4 py-2 text-sm font-semibold text-flow hover:bg-flow/10">
              Sign in to save progress to your account
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Stats">
        {[
          { label: "XP", value: xp, icon: "bolt" as const, tone: "text-flow" },
          { label: "Levels sealed", value: done.size, icon: "check" as const, tone: "text-good", suffix: `/${catalog.levels.length}` },
          { label: "Day streak", value: streak, icon: "flame" as const, tone: "text-warn" },
          { label: "Best streak", value: longestStreak(days), icon: "trophy" as const, tone: "text-pink" },
          { label: "Reviews", value: reviewsDone, icon: "brain" as const, tone: "text-player" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface/60 p-4">
            <Icon name={s.icon} className={s.tone} filled={s.icon === "bolt" || s.icon === "flame"} />
            <span className="font-display text-3xl font-bold">
              <Counter value={s.value} />
              {s.suffix && <span className="text-base text-ink-quiet">{s.suffix}</span>}
            </span>
            <span className="text-xs text-ink-quiet">{s.label}</span>
          </motion.div>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-line bg-surface/60" aria-labelledby="city-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-6">
          <h2 id="city-heading" className="font-display text-xl font-semibold">
            Your city
          </h2>
          <p className="text-sm text-ink-quiet">
            {done.size} of {catalog.levels.length} buildings lit. Every level you finish raises one.
          </p>
        </div>
        <div className="h-[150px] sm:h-[300px]">
          <CityScape worlds={catalog.worlds} levels={catalog.levels} done={done} track="all" focus={cityFocus} onFocus={setCityFocus} onPick={(id) => router.push(`/#world-${id}`)} haze={false} className="mask-[linear-gradient(to_bottom,transparent,black_18%,black_85%,transparent)]" />
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface/60 p-6" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 font-display text-xl font-semibold">
          Activity
        </h2>
        <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`Active on ${days.length} days; current streak ${streak} days`}>
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((d) => (
                <span key={d.date} title={d.date} className={`h-3.5 w-3.5 rounded-[4px] ${d.on ? "bg-good" : "bg-line/70"}`} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface/60 p-6" aria-labelledby="mastery-heading">
        <h2 id="mastery-heading" className="mb-4 font-display text-xl font-semibold">
          District mastery
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {catalog.worlds.map((w) => {
            const levels = catalog.levels.filter((l) => l.world === w.id);
            const finished = levels.filter((l) => done.has(l.id)).length;
            return (
              <li key={w.id} className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm">
                  <span>
                    {w.name} <span className="font-mono text-[10px] uppercase text-ink-quiet">{w.track}</span>
                  </span>
                  <span className="font-mono text-xs text-ink-quiet">
                    {finished}/{levels.length}
                  </span>
                </span>
                <Meter value={levels.length ? finished / levels.length : 0} tone={w.accent === "warn" ? "warn" : w.accent} label={`${w.name} mastery`} height={6} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-3xl border border-line bg-surface/60 p-6" aria-labelledby="achievements-heading">
        <h2 id="achievements-heading" className="mb-4 font-display text-xl font-semibold">
          Achievements <span className="font-mono text-sm text-ink-quiet">{achievements.filter((a) => earned.has(a.id)).length}/{achievements.length}</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => {
            const on = earned.has(a.id);
            return (
              <li key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${on ? "border-line-strong" : "border-dashed border-line"}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${on ? "text-bg" : "text-ink-quiet"}`} style={{ background: on ? `var(--${a.tone})` : "var(--surface-2)" }} aria-hidden="true">
                  {on ? a.glyph : <Icon name="lock" size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.name}</span>
                  <span className="block text-xs text-ink-quiet">{a.description}</span>
                  <span className="sr-only">{on ? "Earned" : "Locked"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Leaderboard />
    </div>
  );
}
