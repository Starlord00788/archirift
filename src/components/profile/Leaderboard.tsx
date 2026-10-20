"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { currentStreak } from "@/persistence/progress";
import { useLearning } from "@/persistence/useLearning";
import { useAuth } from "@/sync/AuthProvider";

const optKey = (uid: string) => `archirift:leaderboard:${uid}`;

export function isOptedIn(uid: string) {
  try {
    return window.localStorage.getItem(optKey(uid)) === "1";
  } catch {
    return false;
  }
}

interface Row {
  uid: string;
  name: string;
  xp: number;
  levels: number;
  streak: number;
}

/** Keeps the learner's public leaderboard entry up to date while they're opted in. */
export function LeaderboardSync() {
  const { status, account, firestore } = useAuth();
  const { progress } = useLearning();
  useEffect(() => {
    if (status !== "signed-in" || !account || !firestore || !progress || !isOptedIn(account.uid)) return;
    const timer = setTimeout(() => {
      void import("@/sync/firestore").then(({ writeLeaderboardEntry }) =>
        writeLeaderboardEntry(firestore, account.uid, {
          name: account.name.slice(0, 40),
          xp: progress.xp,
          levels: progress.completedLessons.length,
          streak: currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10)),
        }).catch(() => {}),
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [status, account, firestore, progress]);
  return null;
}

/** Opt-in public leaderboard: top architects by XP. Perfect for a college batch. */
export function Leaderboard() {
  const { status, account, firestore } = useAuth();
  const { progress } = useLearning();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [opted, setOpted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (account) setOpted(isOptedIn(account.uid));
  }, [account]);

  useEffect(() => {
    if (!firestore) return;
    let cancelled = false;
    void (async () => {
      try {
        const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
        const snap = await getDocs(query(collection(firestore, "leaderboard"), orderBy("xp", "desc"), limit(60)));
        if (cancelled) return;
        setRows(
          snap.docs
            .map((d) => ({ uid: d.id, ...(d.data() as Omit<Row, "uid"> & { hidden?: boolean }) }))
            .filter((r) => !(r as { hidden?: boolean }).hidden)
            .slice(0, 25),
        );
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firestore, opted]);

  if (status === "unconfigured") return null;
  if (status !== "signed-in" || !account) {
    return (
      <section className="rounded-3xl border border-line bg-surface/60 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Icon name="trophy" className="text-warn" /> Leaderboard
        </h2>
        <p className="mt-2 text-sm text-ink-quiet">
          <Link href="/account/" className="text-flow underline">
            Sign in
          </Link>{" "}
          to race your batch to Chief Architect.
        </p>
      </section>
    );
  }

  const toggle = async () => {
    const next = !opted;
    try {
      window.localStorage.setItem(optKey(account.uid), next ? "1" : "0");
    } catch {}
    setOpted(next);
    if (firestore && progress) {
      const { writeLeaderboardEntry } = await import("@/sync/firestore");
      await writeLeaderboardEntry(
        firestore,
        account.uid,
        next ? { name: account.name.slice(0, 40), xp: progress.xp, levels: progress.completedLessons.length, streak: currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10)) } : null,
      ).catch(() => setError(true));
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/60 p-6" aria-labelledby="leaderboard-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="leaderboard-heading" className="flex items-center gap-2 font-display text-xl font-semibold">
          <Icon name="trophy" className="text-warn" /> Leaderboard
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={opted} onChange={() => void toggle()} className="h-4 w-4 accent-[var(--flow)]" />
          Show me on the leaderboard (name and XP only)
        </label>
      </div>
      {error && <p className="text-sm text-warn">The leaderboard couldn&apos;t load. Check your connection.</p>}
      {rows && rows.length === 0 && <p className="text-sm text-ink-quiet">No one is on the board yet. Be the first.</p>}
      {rows && rows.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <motion.li key={r.uid} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${r.uid === account.uid ? "border-flow bg-flow/10" : "border-line"}`}>
              <span className={`w-7 text-center font-mono text-sm font-bold ${i === 0 ? "text-warn" : i === 1 ? "text-ink" : i === 2 ? "text-pink" : "text-ink-quiet"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className="font-mono text-xs text-ink-quiet">{r.levels} levels</span>
              <span className="font-mono text-xs text-warn">{r.streak}🔥</span>
              <span className="w-20 text-right font-mono text-sm font-bold">{r.xp.toLocaleString("en-IN")} XP</span>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}
