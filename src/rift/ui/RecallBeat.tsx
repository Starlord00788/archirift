"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Diagram, type DEdge, type DNode } from "@/components/ui/Diagram";
import { Icon } from "@/components/ui/Icon";
import { clozeParts, type Recall } from "@/content/rift";
import { bossFight, clozeSkeleton, recallResult, type Confidence } from "../state";
import { Rich } from "./Rich";
import type { BeatProps } from "./types";

const select = "rounded-lg border border-line bg-bg/70 px-2 py-1.5 text-sm outline-none focus:border-flow";

function Confidence({ value, onChange }: { value: Confidence | null; onChange: (c: Confidence) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">How sure are you?</legend>
      <div className="flex gap-2">
        {(["sure", "unsure", "guessing"] as Confidence[]).map((c) => (
          <button key={c} type="button" aria-pressed={value === c} onClick={() => onChange(c)} className={`rounded-xl border px-3 py-1.5 text-sm capitalize ${value === c ? "border-flow bg-flow/10 text-flow" : "border-line text-ink-quiet hover:border-flow"}`}>
            {c}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Recall: no diagram, no code, no answers on screen. Rebuild it from memory, then compare. */
export function RecallBeat(props: BeatProps) {
  const { info, state, dispatch } = props;
  const recall = info.rift.recall;
  const result = state.recall.submitted ? recallResult(info.rift, state) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-player/40 bg-player/5 p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-player">Blank Blueprint</p>
        <p className="mt-1">
          <Rich text={recall.prompt} inline />
        </p>
        {!result && <p className="mt-1 text-xs text-ink-quiet">The lesson is hidden. Struggling a little here is what makes it stick.</p>}
      </div>
      {recall.kind === "blueprint" ? <Blueprint {...props} recall={recall} /> : <Cloze {...props} recall={recall} />}

      {!result ? (
        <>
          <Confidence value={state.recall.confidence} onChange={(confidence) => dispatch({ type: "recallConfidence", confidence })} />
          <Button
            variant="primary"
            className="w-fit"
            disabled={state.recall.confidence === null || (recall.kind === "blueprint" ? state.recall.graph.nodes.length === 0 : state.recall.cloze.every((w) => !w?.trim()))}
            onClick={() => dispatch({ type: "recallSubmit" })}
          >
            Compare with the reference
          </Button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${result.passed ? "border-good/60 bg-good/5" : "border-warn/60 bg-warn/5"}`}>
          <p className="font-display text-lg font-semibold">{result.passed ? "Rebuilt from memory!" : "Not quite. The gaps are marked, and this concept will come back sooner in review."}</p>
          <Button variant="primary" onClick={() => dispatch({ type: "finish", at: new Date().toISOString() })}>
            {result.passed && bossFight(info.rift, state).won ? (
              <>
                Seal the rift <Icon name="sparkles" size={15} />
              </>
            ) : (
              <>
                See where you stand <Icon name="arrowRight" size={15} />
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function Blueprint({ state, dispatch, recall, info }: BeatProps & { recall: Extract<Recall, { kind: "blueprint" }> }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [relation, setRelation] = useState(recall.relations[0]);
  const { graph, submitted } = state.recall;
  const kind = (id: string) => recall.kinds[id] ?? "class";

  if (submitted) {
    const result = recallResult(info.rift, state);
    if (result.kind !== "blueprint") return null;
    const { diff } = result;
    const nodes: DNode[] = [
      ...diff.nodes.correct.map((id) => ({ id, kind: kind(id), tone: "good" as const })),
      ...diff.nodes.missing.map((id) => ({ id, kind: "ghost" as const, tone: "missing" as const })),
      ...diff.nodes.validExtra.map((id) => ({ id, kind: kind(id), tone: "extra" as const })),
      ...diff.nodes.invalidExtra.map((id) => ({ id, kind: kind(id), tone: "bad" as const })),
    ];
    const edges: DEdge[] = [
      ...diff.edges.correct.map((e) => ({ ...e, tone: "good" as const })),
      ...diff.edges.wrongType.map((w) => ({ ...w.answer, tone: "bad" as const })),
      ...diff.edges.missing.map((e) => ({ ...e, tone: "missing" as const })),
      ...diff.edges.validExtra.map((e) => ({ ...e, tone: "extra" as const })),
      ...diff.edges.invalidExtra.map((e) => ({ ...e, tone: "bad" as const })),
    ];
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Pieces recalled", diff.scores.concepts],
              ["Connections", diff.scores.relationships],
              ["Arrow types", diff.scores.types],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-line p-2">
                <dt className="text-xs text-ink-quiet">{label as string}</dt>
                <dd className="font-display text-2xl font-bold">{pct(value as number)}</dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col gap-1 text-sm">
            {diff.nodes.missing.map((n) => (
              <li key={n} className="text-warn">
                Forgotten: {n}
              </li>
            ))}
            {diff.edges.wrongType.map((w) => (
              <li key={`${w.answer.from}-${w.answer.to}`} className="text-fail">
                {w.answer.from} {w.answer.type} {w.answer.to}: should be &ldquo;{w.expected.type}&rdquo;
              </li>
            ))}
            {diff.edges.missing.map((e) => (
              <li key={`${e.from}-${e.to}`} className="text-warn">
                Missing arrow: {e.from} {e.type} {e.to}
              </li>
            ))}
            {diff.nodes.invalidExtra.map((n) => (
              <li key={n} className="text-fail">
                Not part of this design: {n}
              </li>
            ))}
            {diff.edges.invalidExtra.map((e) => (
              <li key={`${e.from}-${e.to}-x`} className="text-fail">
                Unexpected arrow: {e.from} {e.type} {e.to}
              </li>
            ))}
            {diff.nodes.validExtra.map((n) => (
              <li key={n} className="text-player">
                Valid, and not in our version: {n}
              </li>
            ))}
          </ul>
        </div>
        <Diagram nodes={nodes} edges={edges} label="your rebuild compared with the reference" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">1. Which pieces belong? (some don&apos;t)</legend>
          <div className="flex flex-wrap gap-2">
            {recall.palette.map((name) => {
              const on = graph.nodes.includes(name);
              return (
                <motion.button
                  key={name}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  aria-pressed={on}
                  onClick={() => dispatch({ type: "recallToggleNode", name })}
                  className={`rounded-full border px-3 py-1.5 font-mono text-xs ${on ? "border-player bg-player/15 text-player" : "border-line text-ink-quiet hover:border-player"}`}
                >
                  {on ? "✓ " : ""}
                  {name}
                </motion.button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">2. Draw the arrows</legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-quiet">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={select}>
                <option value="">Choose…</option>
                {graph.nodes.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-quiet">Relationship</span>
              <select value={relation} onChange={(e) => setRelation(e.target.value)} className={select}>
                {recall.relations.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-quiet">To</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={select}>
                <option value="">Choose…</option>
                {graph.nodes.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <Button disabled={!from || !to || from === to} onClick={() => dispatch({ type: "recallAddEdge", from, to, relation })}>
              Add arrow
            </Button>
          </div>
          {graph.edges.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {graph.edges.map((e, i) => (
                <li key={`${e.from}-${e.to}`} className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {e.from} <span className="text-ink-quiet">{e.type}</span> {e.to}
                  </span>
                  <button type="button" className="text-xs text-ink-quiet underline hover:text-fail" onClick={() => dispatch({ type: "recallRemoveEdge", index: i })}>
                    Remove<span className="sr-only"> arrow {e.from} {e.type} {e.to}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
      {graph.nodes.length > 0 ? (
        <Diagram nodes={graph.nodes.map((id) => ({ id, kind: kind(id) }))} edges={graph.edges} label="your rebuild" />
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-line p-6 text-sm text-ink-quiet">Your diagram appears here as you build it.</div>
      )}
    </div>
  );
}

function Cloze({ state, dispatch, recall, info }: BeatProps & { recall: Extract<Recall, { kind: "cloze" }> }) {
  const parts = clozeParts(recall.text);
  const result = state.recall.submitted ? recallResult(info.rift, state) : null;
  const correct = result?.kind === "cloze" ? result.correct : null;
  const { scaffold } = state.recall;
  let blank = -1;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface/60 p-5 text-[15px] leading-[2.6]">
        {parts.map((part, i) => {
          if (part.kind === "text") return <Rich key={i} text={part.value} inline />;
          blank += 1;
          const index = blank;
          const typed = state.recall.cloze[index];
          if (correct) {
            const ok = correct[index];
            return (
              <span key={i} className={`mx-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-sm ${ok ? "border-good text-good" : "border-fail text-fail"}`}>
                {typed?.trim() || "—"}
                {!ok && <span className="text-ink">→ {part.answers[0]}</span>}
                <span className="sr-only">{ok ? "(correct)" : "(incorrect)"}</span>
              </span>
            );
          }
          const width = Math.max(6, Math.min(24, part.answers[0].length + 2));
          return (
            <input
              key={i}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`Blank ${index + 1}`}
              placeholder={scaffold >= 1 ? clozeSkeleton(part.answers[0]) : "type it"}
              value={typed ?? ""}
              onChange={(e) => dispatch({ type: "recallCloze", blank: index, word: e.target.value || null })}
              style={{ width: `${width}ch` }}
              className={`mx-1 rounded-lg border border-dashed bg-bg/70 px-2 py-1 font-mono text-sm outline-none placeholder:text-ink-quiet/60 focus:border-solid focus:border-flow ${typed?.trim() ? "border-player text-player" : "border-line"}`}
            />
          );
        })}
      </div>
      {!correct && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-quiet">
            <span>Stuck? Each step costs a hint.</span>
            {scaffold < 2 && (
              <button type="button" onClick={() => dispatch({ type: "recallScaffold" })} className="rounded-full border border-line px-3 py-1 hover:border-flow hover:text-flow">
                {scaffold === 0 ? "Show first letters" : "Show the word bank"}
              </button>
            )}
          </div>
          {scaffold >= 2 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Word bank">
              {[...recall.bank].sort((a, b) => a.localeCompare(b)).map((w) => (
                <li key={w} className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-ink-quiet">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
