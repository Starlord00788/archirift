"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { SPRING } from "@/components/fx/KineticText";
import { ParticleMorph } from "@/components/fx/ParticleMorph";
import { rankFor } from "@/game/ranks";
import { useLearning } from "@/persistence/useLearning";
import { ShapePicker } from "./Hero";

/**
 * The living particle city for returning learners: a shorter version of the hero, so the city
 * still greets you, with your workspace right underneath instead of the pitch.
 */
export function CityBanner() {
  const [shape, setShape] = useState(0);
  const { progress } = useLearning();
  const { rank } = rankFor(progress?.xp ?? 0);
  return (
    <section aria-label="Welcome back" className="relative isolate -mx-4 overflow-hidden px-4 pt-10 pb-4 sm:-mx-6 sm:px-6">
      <div className="absolute inset-y-0 right-0 -z-10 w-full sm:w-[62%]" aria-hidden="true">
        <ParticleMorph shape={shape} onAutoAdvance={setShape} className="opacity-50 sm:opacity-90" />
      </div>
      {/* Keeps the words readable over the particles. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_0%_50%,var(--bg)_40%,transparent_80%)]" />
      <div className="grid min-h-48 items-end gap-6 sm:min-h-56 lg:grid-cols-[2fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-flow">Build it · Break it · Scale it</p>
          <p className="mt-3 font-display text-[clamp(2rem,4.6vw,3.4rem)] font-bold leading-[1] tracking-[-0.04em]">
            Welcome back, <span className="text-gradient">{rank.name}.</span>
          </p>
          <p className="mt-3 max-w-md text-ink-quiet">The city is still standing. Here&apos;s what to do next.</p>
        </motion.div>
        <div className="hidden sm:block">
          <ShapePicker shape={shape} onPick={setShape} pillId="banner-shape" />
        </div>
      </div>
    </section>
  );
}
