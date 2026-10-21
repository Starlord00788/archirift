"use client";

import { useEffect, useMemo, useState } from "react";
import { choiceOrder } from "@/rift/state";
import { GraphView, type ViewEdge, type ViewNode } from "@/components/GraphView";
import { OFFERS, PROOF_OFFERS } from "../domain";
import type { Move } from "../design";
import {
  ELABORATION_QUESTION,
  INTERVIEW_QUESTION,
  RECALL_PALETTE,
  RELATIONS,
  recallPassed,
  type Action,
  type Choice,
  type Confidence,
  type HydraState,
} from "../level";

type Dispatch = (action: Action) => void;

const button =
  "rounded-md border border-line bg-surface px-3 py-2 text-left text-sm hover:border-flow focus-visible:border-flow focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "rounded-md border border-flow bg-flow/10 px-4 py-2 text-sm font-semibold text-flow hover:bg-flow/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flow disabled:cursor-not-allowed disabled:opacity-50";

// ---------------- Pain ----------------

export function PainBeat({ state, dispatch }: { state: HydraState; dispatch: Dispatch }) {
  const chainLabels = ["student", "loyalty", "happy hour"];
  const positions = [0, 1, 2, 3].map((p) => ({
    position: p,
    text: p === 0 ? "At the top, before every other offer" : p === 3 ? "At the bottom, after happy hour" : `After the ${chainLabels[p - 1]} branch`,
  }));
  return (
    <div className="flex flex-col gap-4">
      <p>
        Brew & Bytes bills with one long <code className="font-mono text-flow">if / else if</code> chain. Meera wants a festival offer.
        Where should the new <code className="font-mono">else if</code> go?
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {positions.map(({ position, text }) => (
          <button
            key={position}
            type="button"
            className={button}
            aria-pressed={state.painTries.at(-1) === position}
            onClick={() => dispatch({ type: "painInsert", position })}
          >
            {text}
          </button>
        ))}
      </div>
      {state.painTries.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <p className="text-sm text-ink-quiet">
            Tried {state.painTries.length} {state.painTries.length === 1 ? "position" : "positions"}. The chain applies the
            <strong> first</strong> matching offer, but Meera wants the <strong>best</strong> one. No position can be right for every customer.
          </p>
          <button type="button" className={primary} onClick={() => dispatch({ type: "toPlay" })}>
            There has to be a better way
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- Play ----------------

export function PlayBeat({ state, dispatch }: { state: HydraState; dispatch: Dispatch }) {
  const d = state.design;
  if (d.injected) {
    return (
      <div className="flex flex-col gap-4">
        <p>
          The Hydra is down. Now add Meera&apos;s festival offer: <em>{OFFERS.festival.rule}</em>. How?
        </p>
        <div className="grid gap-2">
          <button type="button" className={button} onClick={() => dispatch({ type: "addFestival", how: "class" })}>
            Add a new <code className="font-mono">FestivalPricing</code> class that implements PricingStrategy
          </button>
          <button type="button" className={button} onClick={() => dispatch({ type: "addFestival", how: "edit" })}>
            Add the festival rule inside <code className="font-mono">Checkout.total()</code>
          </button>
        </div>
      </div>
    );
  }

  const move = (label: string, m: Move) => ({ label, action: { type: "move", move: m } as Action });
  const moves: { label: string; action: Action }[] = [
    ...(d.interfaceExtracted ? [] : [move("Extract a PricingStrategy interface", { type: "extractInterface" })]),
    ...d.chain
      .filter((e) => !e.extracted)
      .map((e) =>
        move(`Move the ${OFFERS[e.offer].label.toLowerCase()} branch into ${OFFERS[e.offer].className}`, { type: "moveToClass", offer: e.offer }),
      ),
    move("Give Checkout a list of strategies and apply the best discount", { type: "injectStrategies" }),
    {
      label: "Add one more else-if for the festival",
      action: { type: "distractor", text: "That grows another head. The Hydra feeds on new branches." },
    },
    {
      label: "Copy total() into a new FestivalCheckout class",
      action: { type: "distractor", text: "Now the same billing logic lives in two places: the Clone Army smell. Every future fix must be made twice." },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p>
        Refactor Rush. Cut the heads one move at a time. Every move must keep the client tests green.
      </p>
      <ul className="grid gap-2">
        {moves.map((m) => (
          <li key={m.label}>
            <button type="button" className={`${button} w-full`} onClick={() => dispatch(m.action)}>
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Proof ----------------

export function ProofBeat({ state, dispatch }: { state: HydraState; dispatch: Dispatch }) {
  const { arrived, startedAt, seconds, answer } = state.proof;
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(startedAt) && arrived < PROOF_OFFERS.length;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  if (!startedAt) {
    return (
      <div className="flex flex-col gap-4">
        <p>Rush hour. Meera is about to announce three new offers back to back. Can your design keep up?</p>
        <button type="button" className={primary} onClick={() => dispatch({ type: "startProof", at: new Date().toISOString() })}>
          Bring them on
        </button>
      </div>
    );
  }

  if (arrived < PROOF_OFFERS.length) {
    const offer = OFFERS[PROOF_OFFERS[arrived]];
    const elapsed = Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
    return (
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-ink-quiet" aria-live="off">
          Offer {arrived + 1} of {PROOF_OFFERS.length} · {elapsed}s
        </p>
        <p className="text-lg">
          New offer: <strong>{offer.label}</strong>, {offer.rule}.
        </p>
        <div className="grid gap-2">
          <button type="button" className={button} onClick={() => dispatch({ type: "proofAdd", how: "class", at: new Date().toISOString() })}>
            Add <code className="font-mono">{offer.className}</code>
          </button>
          <button type="button" className={button} onClick={() => dispatch({ type: "proofAdd", how: "edit", at: new Date().toISOString() })}>
            Squeeze it into <code className="font-mono">Checkout</code>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-quiet">
        Three offers in {seconds ?? "?"} seconds, zero edits to existing classes, every test green.
      </p>
      <Question question={INTERVIEW_QUESTION} answer={answer} onAnswer={(id) => dispatch({ type: "answerInterview", choiceId: id })} />
      {answer && (
        <button type="button" className={primary} onClick={() => dispatch({ type: "toRecall" })}>
          Continue to the Blank Blueprint
        </button>
      )}
    </div>
  );
}

function Question({ question, answer, onAnswer }: { question: { prompt: string; choices: Choice[] }; answer: string | null; onAnswer: (id: string) => void }) {
  // Shown in a shuffled order so the right answer isn't always first.
  const order = useMemo(() => choiceOrder(question.choices.length, question.prompt), [question]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{question.prompt}</legend>
      {order.map((i) => question.choices[i]).map((c) => {
        const chosen = answer === c.id;
        const reveal = answer !== null && (chosen || c.correct);
        return (
          <button
            key={c.id}
            type="button"
            disabled={answer !== null}
            aria-pressed={chosen}
            onClick={() => onAnswer(c.id)}
            className={`${button} ${reveal ? (c.correct ? "border-flow" : "border-fail") : ""}`}
          >
            {c.text}
            {reveal && <span className="sr-only">{c.correct ? " (correct)" : " (incorrect)"}</span>}
          </button>
        );
      })}
    </fieldset>
  );
}

// ---------------- Recall ----------------

export function RecallBeat({ state, dispatch }: { state: HydraState; dispatch: Dispatch }) {
  const { graph, confidence, diff } = state.recall;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [relation, setRelation] = useState<string>("implements");

  const yourView: { nodes: ViewNode[]; edges: ViewEdge[] } = {
    nodes: graph.nodes.map((id) => ({ id, kind: id === "PricingStrategy" ? "interface" : "class" })),
    edges: graph.edges,
  };

  if (diff) {
    const missingEdges = diff.edges.missing;
    const resultView: { nodes: ViewNode[]; edges: ViewEdge[] } = {
      nodes: [
        ...diff.nodes.correct.map((id) => ({ id, kind: (id === "PricingStrategy" ? "interface" : "class") as ViewNode["kind"], tone: "good" as const })),
        ...diff.nodes.missing.map((id) => ({ id, kind: "ghost" as const, tone: "missing" as const })),
        ...diff.nodes.validExtra.map((id) => ({ id, kind: "class" as const, tone: "extra" as const })),
        ...diff.nodes.invalidExtra.map((id) => ({ id, kind: "class" as const, tone: "bad" as const })),
      ],
      edges: [
        ...diff.edges.correct.map((e) => ({ ...e, tone: "good" as const })),
        ...diff.edges.wrongType.map((w) => ({ ...w.answer, tone: "bad" as const })),
        ...missingEdges.map((e) => ({ ...e, tone: "missing" as const })),
        ...diff.edges.validExtra.map((e) => ({ ...e, tone: "extra" as const })),
        ...diff.edges.invalidExtra.map((e) => ({ ...e, tone: "bad" as const })),
      ],
    };
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-display text-lg font-semibold">{recallPassed(diff) ? "Rebuilt from memory" : "Compared with the reference"}</h3>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          {[
            ["Concepts recalled", diff.scores.concepts],
            ["Relationships", diff.scores.relationships],
            ["Arrow types", diff.scores.types],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-line p-2">
              <dt className="text-xs text-ink-quiet">{label as string}</dt>
              <dd className="font-display text-xl">{pct(value as number)}</dd>
            </div>
          ))}
        </dl>
        <GraphView nodes={resultView.nodes} edges={resultView.edges} label="your rebuild compared with the reference" height={300} />
        <ul className="flex flex-col gap-1 text-sm">
          {diff.nodes.missing.map((n) => (
            <li key={n} className="text-warn">Forgotten: {n}</li>
          ))}
          {diff.edges.wrongType.map((w) => (
            <li key={`${w.answer.from}-${w.answer.to}`} className="text-fail">
              {w.answer.from} {w.answer.type} {w.answer.to}: should be &ldquo;{w.expected.type}&rdquo;
              {w.expected.type === "implements" ? " (it fulfils an interface, it does not inherit a class)" : ""}
            </li>
          ))}
          {diff.nodes.invalidExtra.map((n) => (
            <li key={n} className="text-fail">Not part of this design: {n}</li>
          ))}
          {diff.nodes.validExtra.map((n) => (
            <li key={n} className="text-player">Valid, and not in our version: {n}</li>
          ))}
          {missingEdges.map((e) => (
            <li key={`${e.from}-${e.to}`} className="text-warn">
              Missing arrow: {e.from} {e.type} {e.to}
            </li>
          ))}
        </ul>
        <Question question={ELABORATION_QUESTION} answer={state.elaboration} onAnswer={(id) => dispatch({ type: "elaborate", choiceId: id })} />
        {state.elaboration && (
          <button type="button" className={primary} onClick={() => dispatch({ type: "finish" })}>
            Finish the level
          </button>
        )}
      </div>
    );
  }

  const canSubmit = graph.nodes.length > 0 && confidence !== null;
  return (
    <div className="flex flex-col gap-4">
      <p>
        Blank Blueprint. The diagram is gone. Rebuild the design you just made from memory: pick the classes, then draw the arrows.
      </p>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">1. Which classes belong? (some don&apos;t)</legend>
        <div className="flex flex-wrap gap-2">
          {RECALL_PALETTE.map((name) => {
            const on = graph.nodes.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: on ? "recallRemoveNode" : "recallAddNode", name })}
                className={`rounded-full border px-3 py-1 font-mono text-xs ${on ? "border-player text-player" : "border-line text-ink-quiet"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">2. Draw the arrows</legend>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-quiet">From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-line bg-surface px-2 py-1">
              <option value="">Choose…</option>
              {graph.nodes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-quiet">Relationship</span>
            <select value={relation} onChange={(e) => setRelation(e.target.value)} className="rounded border border-line bg-surface px-2 py-1">
              {RELATIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-quiet">To</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-line bg-surface px-2 py-1">
              <option value="">Choose…</option>
              {graph.nodes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={button}
            disabled={!from || !to || from === to}
            onClick={() => dispatch({ type: "recallAddEdge", from, to, relation })}
          >
            Add arrow
          </button>
        </div>
        {graph.edges.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {graph.edges.map((e, i) => (
              <li key={`${e.from}-${e.to}`} className="flex items-center gap-2">
                <span className="font-mono text-xs">
                  {e.from} <span className="text-ink-quiet">{e.type}</span> {e.to}
                </span>
                <button type="button" className="text-xs text-ink-quiet underline" onClick={() => dispatch({ type: "recallRemoveEdge", index: i })}>
                  Remove<span className="sr-only"> arrow {e.from} {e.type} {e.to}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {graph.nodes.length > 0 && <GraphView nodes={yourView.nodes} edges={yourView.edges} label="your rebuild" height={260} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">3. How sure are you?</legend>
        <div className="flex gap-2">
          {(["sure", "unsure", "guessing"] as Confidence[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={confidence === c}
              onClick={() => dispatch({ type: "recallConfidence", confidence: c })}
              className={`rounded-md border px-3 py-1 text-sm capitalize ${confidence === c ? "border-flow text-flow" : "border-line text-ink-quiet"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className={primary} disabled={!canSubmit} onClick={() => dispatch({ type: "recallSubmit" })}>
        Compare with the reference
      </button>
    </div>
  );
}
