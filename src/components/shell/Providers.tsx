"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef } from "react";
import { newlyEarned } from "@/game/achievements";
import type { Catalog } from "@/game/catalog";
import { getRepository } from "@/persistence/client";
import { useLearning } from "@/persistence/useLearning";
import { AuthProvider } from "@/sync/AuthProvider";
import { LeaderboardSync } from "@/components/profile/Leaderboard";
import { ToastProvider, useToast } from "./Toasts";

const CatalogContext = createContext<Catalog>({ worlds: [], levels: [] });

export function useCatalog() {
  return useContext(CatalogContext);
}

export function Providers({ catalog, children }: { catalog: Catalog; children: React.ReactNode }) {
  // With reduced motion, every transition (fades included) completes instantly.
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user" transition={reduce ? { duration: 0 } : undefined}>
      <CatalogContext.Provider value={catalog}>
        <AuthProvider>
          <ToastProvider>
            <AchievementWatcher />
            <LeaderboardSync />
            {children}
          </ToastProvider>
        </AuthProvider>
      </CatalogContext.Provider>
    </MotionConfig>
  );
}

/** Records achievements as soon as their rule is met, and celebrates them. */
function AchievementWatcher() {
  const { progress, reviews } = useLearning();
  const catalog = useCatalog();
  const toast = useToast();
  const recording = useRef(new Set<string>());

  useEffect(() => {
    if (!progress) return;
    const earned = newlyEarned({
      progress,
      catalog,
      reviewsDone: reviews.reduce((sum, r) => sum + r.reviews, 0),
      today: new Date().toISOString().slice(0, 10),
    }).filter((a) => !recording.current.has(a.id));
    if (earned.length === 0) return;
    const repo = getRepository();
    for (const a of earned) {
      recording.current.add(a.id);
      repo
        .recordEvent({ id: `achievement:${a.id}`, type: "achievementEarned", achievementId: a.id, at: new Date().toISOString() })
        .then(({ duplicate }) => {
          if (!duplicate) toast({ title: `Achievement unlocked: ${a.name}`, body: a.description, tone: a.tone, glyph: a.glyph });
        })
        .catch(() => recording.current.delete(a.id));
    }
  }, [progress, reviews, catalog, toast]);

  return null;
}
