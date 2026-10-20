"use client";

import { motion, useReducedMotion } from "motion/react";
import { OFFERS } from "../domain";
import type { HarnessReport } from "../design";

/**
 * The client's acceptance tests, run for real against the player's design. Tests for an offer the
 * design does not implement yet show as waiting, not failing: nothing is broken, it just isn't built.
 */
export function TestLights({ report }: { report: HarnessReport }) {
  const reduced = useReducedMotion();
  const waiting = report.results.filter((r) => report.missing.includes(r.needs));
  const running = report.results.filter((r) => !report.missing.includes(r.needs));
  const passed = running.filter((r) => r.pass).length;
  const allGreen = passed === running.length;

  return (
    <section aria-labelledby="tests-heading" className="flex flex-col gap-2">
      <h3 id="tests-heading" className="flex items-baseline justify-between font-display text-sm font-semibold">
        <span>Client tests</span>
        <span className={`font-mono text-xs ${allGreen ? "text-flow" : "text-fail"}`}>
          {passed}/{running.length} passing
          {waiting.length > 0 && <span className="text-ink-quiet"> · {waiting.length} waiting</span>}
          {report.openClosedViolations.length > 0 && " · Open/Closed broken"}
        </span>
      </h3>
      <ul className="flex flex-col gap-1">
        {report.results.map((r) => {
          const isWaiting = report.missing.includes(r.needs);
          const colour = isWaiting ? "var(--line)" : r.pass ? "var(--flow)" : "var(--fail)";
          return (
            <li key={r.id} className={`flex items-start gap-2 text-xs ${isWaiting ? "text-ink-quiet" : ""}`}>
              <motion.span
                aria-hidden="true"
                className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full"
                animate={{ backgroundColor: colour, scale: reduced ? 1 : [1.4, 1] }}
                transition={{ duration: reduced ? 0 : 0.35 }}
              />
              <span>
                <span className="sr-only">{isWaiting ? "Waiting: " : r.pass ? "Passing: " : "Failing: "}</span>
                {r.label}
                {isWaiting ? (
                  <span className="block font-mono">waiting for the {OFFERS[r.needs].label.toLowerCase()} offer</span>
                ) : (
                  !r.pass && (
                    <span className="block font-mono text-fail">
                      expected ₹{r.expected}, got ₹{r.actual}
                    </span>
                  )
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
