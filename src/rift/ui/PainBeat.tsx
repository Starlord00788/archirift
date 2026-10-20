"use client";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Diagram } from "@/components/ui/Diagram";
import { Icon } from "@/components/ui/Icon";
import { Rich } from "./Rich";
import type { BeatProps } from "./types";

/** Pain: the story, the broken system, and a choice that shows how it breaks. */
export function PainBeat({ info, state, dispatch }: BeatProps) {
  const { pain, codex } = info.rift;
  const tried = state.painTried;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-fail/40 bg-fail/5 p-5">
          <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-fail">
            <span className="h-2 w-2 animate-pulse rounded-full bg-fail" aria-hidden="true" /> Rift detected
          </p>
          <div className="flex flex-col gap-3 leading-relaxed">
            <Rich text={pain.scene} />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/60 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-flow">Real-life analogy</p>
          <p className="mt-1 text-sm text-ink-quiet">
            <Rich text={codex.analogy} inline />
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">
            <Rich text={pain.prompt} inline />
          </legend>
          {pain.options.map((option, i) => {
            const on = tried.includes(i);
            return (
              <Button key={option.text} variant="choice" aria-pressed={on} onClick={() => dispatch({ type: "painTry", option: i })} className={on ? "border-fail/60" : ""}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${on ? "border-fail text-fail" : "border-line text-ink-quiet"}`}>
                  {on ? <Icon name="x" size={12} /> : String.fromCharCode(65 + i)}
                </span>
                <span>
                  <Rich text={option.text} inline />
                </span>
              </Button>
            );
          })}
        </fieldset>

        <AnimatePresence>
          {tried.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-2xl border border-warn/60 bg-warn/5 p-4">
              <p className="font-mono text-xs uppercase tracking-widest text-warn">The real problem</p>
              <p className="text-sm">
                <Rich text={pain.lesson} inline />
              </p>
              <Button variant="primary" className="w-fit" onClick={() => dispatch({ type: "toPlay" })}>
                Into the rift <Icon name="arrowRight" size={16} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        {pain.code && <CodeBlock source={pain.code.source} language={pain.code.language} highlight={pain.code.highlight} title="The code today" />}
        {pain.diagram && <Diagram nodes={pain.diagram.nodes} edges={pain.diagram.edges} label="the design today" />}
        {!pain.code && !pain.diagram && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-quiet">
            Choose what you&apos;d do. Every option teaches something.
          </div>
        )}
      </div>
    </div>
  );
}
