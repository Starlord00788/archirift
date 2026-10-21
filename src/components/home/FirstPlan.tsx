"use client";

import Link from "next/link";
import { useCatalog } from "@/components/shell/Providers";
import { PlanPicker } from "./PlanPicker";

/** The first-visit plan section, right under the hero: two questions, then a short list of levels. */
export function FirstPlan() {
  const { worlds } = useCatalog();
  return (
    <section id="plan" aria-labelledby="plan-heading" className="scroll-mt-24 rounded-3xl border border-line bg-surface/60 p-6 sm:p-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-flow">Your plan</p>
      <h2 id="plan-heading" className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
        Two questions, and we&apos;ll pick your levels.
      </h2>
      <p className="mt-2 max-w-xl text-ink-quiet">Nobody needs all of them. A two-week plan is under 20 levels, the ones interviewers ask about most.</p>
      <div className="mt-6">
        <PlanPicker onDone={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      </div>
      <p className="mt-6 text-sm text-ink-quiet">
        Already know the basics? Prove it in a few questions and skip ahead:{" "}
        {worlds
          .filter((w) => w.id === "objects" || w.id === "laws" || w.id === "scaling")
          .map((w, i, list) => (
            <span key={w.id}>
              <Link href={`/check/${w.id}/`} className="font-semibold text-ink underline hover:text-flow">
                {w.name}
              </Link>
              {i < list.length - 1 ? ", " : "."}
            </span>
          ))}
      </p>
    </section>
  );
}
