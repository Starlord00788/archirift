"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useLearning } from "@/persistence/useLearning";

type Accent = "flow" | "player" | "warn" | "good" | "pink" | "lime";

export interface AtlasData {
  worlds: { id: string; name: string; track: "lld" | "hld"; accent: Accent }[];
  concepts: { id: string; name: string; world: string; rule: string; aliases: string[]; misconceptions: { claim: string; correction: string }[] }[];
  edges: { from: string; to: string; type: string; explanation: string }[];
  levelsByConcept: Record<string, { id: string; title: string; codex: boolean }[]>;
}

/** How each relationship reads, from the arrow's tail ("A enables B") and from its head ("B is enabled by A"). */
const VERB: Record<string, { out: string; in: string }> = {
  requires: { out: "requires", in: "is required by" },
  enables: { out: "enables", in: "is enabled by" },
  "realised-by": { out: "is realised by", in: "realises" },
  "used-in": { out: "is used in", in: "uses" },
  causes: { out: "causes", in: "is caused by" },
  "mitigated-by": { out: "is mitigated by", in: "mitigates" },
  "trades-off-against": { out: "trades off against", in: "trades off against" },
  "is-a-kind-of": { out: "is a kind of", in: "has a kind" },
  "contrasts-with": { out: "contrasts with", in: "contrasts with" },
  "part-of": { out: "is part of", in: "includes" },
};

const ROW = 68;

type Mastery = "done" | "weak" | "new";

export function Atlas({ data }: { data: AtlasData }) {
  const { progress, reviews } = useLearning();
  const [selected, setSelected] = useState(data.concepts[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<"all" | "lld" | "hld">("all");

  // Deep links: /atlas/?c=consistent-hashing
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("c");
    if (fromUrl && data.concepts.some((c) => c.id === fromUrl)) setSelected(fromUrl);
  }, [data.concepts]);

  const select = (id: string) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set("c", id);
    window.history.replaceState(null, "", url);
  };

  const byId = useMemo(() => new Map(data.concepts.map((c) => [c.id, c])), [data.concepts]);
  const worldOf = useMemo(() => new Map(data.worlds.map((w) => [w.id, w])), [data.worlds]);

  const mastery = useMemo(() => {
    const done = new Set(progress?.completedLessons ?? []);
    const weak = new Set(reviews.filter((r) => r.lapses > 0 && !r.lastOutcome.correct).map((r) => r.conceptId));
    return (id: string): Mastery => {
      if (weak.has(id)) return "weak";
      return (data.levelsByConcept[id] ?? []).some((l) => done.has(l.id)) ? "done" : "new";
    };
  }, [progress, reviews, data.levelsByConcept]);

  const concept = byId.get(selected);
  const outgoing = data.edges.filter((e) => e.from === selected && byId.has(e.to));
  const incoming = data.edges.filter((e) => e.to === selected && byId.has(e.from));

  const q = query.trim().toLowerCase();
  const groups = data.worlds
    .filter((w) => track === "all" || w.track === track)
    .map((w) => ({
      world: w,
      concepts: data.concepts.filter(
        (c) => c.world === w.id && (!q || c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)) || c.rule.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.concepts.length > 0);

  const mastered = data.concepts.filter((c) => mastery(c.id) === "done").length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]" aria-label="Concepts">
        <div className="rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-sm text-ink-quiet">
            <strong className="text-ink">{mastered}</strong> of {data.concepts.length} concepts sealed · {data.edges.length} connections
          </p>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg/60 px-3 py-2 focus-within:border-flow">
            <Icon name="search" className="text-ink-quiet" />
            <span className="sr-only">Search concepts</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: kafka, solid, quorum…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div role="radiogroup" aria-label="Track" className="mt-3 flex gap-1 rounded-xl border border-line bg-bg/40 p-1 text-xs">
            {(["all", "lld", "hld"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={track === t}
                onClick={() => setTrack(t)}
                className={`flex-1 rounded-lg px-2 py-1.5 font-semibold uppercase tracking-wide transition-colors ${track === t ? "bg-surface-2 text-ink" : "text-ink-quiet hover:text-ink"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <nav className="flex flex-col gap-4 overflow-y-auto pr-1 lg:min-h-0" aria-label="Concept list">
          {groups.map(({ world, concepts }) => (
            <section key={world.id} aria-labelledby={`world-${world.id}`}>
              <h2 id={`world-${world.id}`} className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: `var(--${world.accent})` }}>
                {world.name}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {concepts.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => select(c.id)}
                      aria-current={c.id === selected ? "true" : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${c.id === selected ? "bg-surface-2 text-ink" : "text-ink-quiet hover:bg-surface/70 hover:text-ink"}`}
                    >
                      <MasteryDot mastery={mastery(c.id)} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="text-sm text-ink-quiet">No concept matches “{query}”.</p>}
        </nav>
      </aside>

      {concept && (
        <section aria-labelledby="atlas-concept" className="flex min-w-0 flex-col gap-6">
          <EgoGraph
            key={concept.id}
            centre={concept}
            accent={worldOf.get(concept.world)?.accent ?? "flow"}
            incoming={incoming.map((e) => ({ edge: e, other: byId.get(e.from)! }))}
            outgoing={outgoing.map((e) => ({ edge: e, other: byId.get(e.to)! }))}
            mastery={mastery}
            onSelect={select}
          />

          <AnimatePresence mode="wait">
            <motion.div key={concept.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface/60 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: `var(--${worldOf.get(concept.world)?.accent ?? "flow"})` }}>
                  {worldOf.get(concept.world)?.name}
                </p>
                <h2 id="atlas-concept" className="mt-1 font-display text-2xl font-bold">
                  {concept.name}
                </h2>
                <p className="mt-2 text-ink">{concept.rule}</p>
                {concept.aliases.length > 0 && <p className="mt-3 text-xs text-ink-quiet">Also called: {concept.aliases.join(", ")}</p>}
                {concept.misconceptions.map((m) => (
                  <p key={m.claim} className="mt-3 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm">
                    <span className="font-semibold">Myth:</span> {m.claim} <span className="font-semibold">Reality:</span> {m.correction}
                  </p>
                ))}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(data.levelsByConcept[concept.id] ?? []).map((l) => (
                    <span key={l.id} className="flex flex-wrap gap-2">
                      <Link href={`/levels/${l.id}/`} className="inline-flex items-center gap-1.5 rounded-xl bg-flow px-3 py-1.5 text-sm font-semibold text-bg">
                        <Icon name="play" /> {l.title}
                      </Link>
                      {l.codex && (
                        <Link href={`/codex/${l.id}/`} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3 py-1.5 text-sm hover:border-flow hover:text-flow">
                          <Icon name="book" /> Cheat sheet
                        </Link>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface/60 p-5">
                <h3 className="font-semibold">Connections</h3>
                {incoming.length + outgoing.length === 0 && <p className="mt-2 text-sm text-ink-quiet">No connections recorded yet.</p>}
                <ul className="mt-2 flex flex-col gap-3 text-sm">
                  {outgoing.map((e) => (
                    <Connection key={`o-${e.to}-${e.type}`} text={`${concept.name} ${VERB[e.type]?.out ?? e.type}`} other={byId.get(e.to)!} explanation={e.explanation} onSelect={select} />
                  ))}
                  {incoming.map((e) => (
                    <Connection key={`i-${e.from}-${e.type}`} text={`${concept.name} ${VERB[e.type]?.in ?? e.type}`} other={byId.get(e.from)!} explanation={e.explanation} onSelect={select} />
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

function Connection({ text, other, explanation, onSelect }: { text: string; other: { id: string; name: string }; explanation: string; onSelect: (id: string) => void }) {
  return (
    <li className="border-l-2 border-line pl-3">
      <span className="text-ink-quiet">{text} </span>
      <button onClick={() => onSelect(other.id)} className="font-semibold text-flow underline-offset-2 hover:underline">
        {other.name}
      </button>
      <span className="block text-ink-quiet">{explanation}</span>
    </li>
  );
}

function MasteryDot({ mastery }: { mastery: Mastery }) {
  const label = mastery === "done" ? "sealed" : mastery === "weak" ? "needs review" : "not started";
  const cls = mastery === "done" ? "bg-good" : mastery === "weak" ? "bg-warn" : "border border-line-strong";
  return (
    <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} role="img" aria-label={label} />
  );
}

type Neighbour = { edge: AtlasData["edges"][number]; other: AtlasData["concepts"][number] };

/** The selected concept in the middle, what it builds on to the left and what it leads to on the right. */
function EgoGraph({
  centre,
  accent,
  incoming,
  outgoing,
  mastery,
  onSelect,
}: {
  centre: AtlasData["concepts"][number];
  accent: Accent;
  incoming: Neighbour[];
  outgoing: Neighbour[];
  mastery: (id: string) => Mastery;
  onSelect: (id: string) => void;
}) {
  const rows = Math.max(incoming.length, outgoing.length, 1);
  const height = rows * ROW;
  const y = (i: number, n: number) => height / 2 + (i - (n - 1) / 2) * ROW;
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

  return (
    <div className="rounded-2xl border border-line bg-surface/40 p-4" aria-hidden="true">
      <div className="relative hidden sm:block" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {incoming.map((l, i) => (
            <motion.path
              key={`i-${l.other.id}-${l.edge.type}`}
              d={curve(31, y(i, incoming.length), 37, height / 2)}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
            />
          ))}
          {outgoing.map((l, i) => (
            <motion.path
              key={`o-${l.other.id}-${l.edge.type}`}
              d={curve(63, height / 2, 69, y(i, outgoing.length))}
              fill="none"
              stroke={`var(--${accent})`}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
            />
          ))}
        </svg>
        {incoming.map((l, i) => (
          <Node key={`i-${l.other.id}-${l.edge.type}`} link={l} verb={VERB[l.edge.type]?.out ?? l.edge.type} side="left" top={y(i, incoming.length)} mastery={mastery(l.other.id)} onSelect={onSelect} delay={i * 0.04} />
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-[37%] w-[26%] -translate-y-1/2 rounded-2xl border-2 bg-surface px-3 py-3 text-center shadow-card"
          style={{ top: height / 2, borderColor: `var(--${accent})` }}
        >
          <span className="font-display text-sm font-bold leading-tight">{centre.name}</span>
        </motion.div>
        {outgoing.map((l, i) => (
          <Node key={`o-${l.other.id}-${l.edge.type}`} link={l} verb={VERB[l.edge.type]?.out ?? l.edge.type} side="right" top={y(i, outgoing.length)} mastery={mastery(l.other.id)} onSelect={onSelect} delay={i * 0.04} />
        ))}
        {incoming.length === 0 && <p className="absolute left-0 w-[31%] -translate-y-1/2 text-center text-xs text-ink-quiet" style={{ top: height / 2 }}>A starting point</p>}
        {outgoing.length === 0 && <p className="absolute right-0 w-[31%] -translate-y-1/2 text-center text-xs text-ink-quiet" style={{ top: height / 2 }}>Where this path ends, for now</p>}
      </div>
      <p className="text-center text-xs text-ink-quiet sm:mt-3">
        <span className="sm:hidden">Pick a concept to explore its connections below.</span>
        <span className="hidden sm:inline">Builds on ← · → Leads to. Click any concept to travel.</span>
      </p>
    </div>
  );
}

function Node({ link, verb, side, top, mastery, onSelect, delay }: { link: Neighbour; verb: string; side: "left" | "right"; top: number; mastery: Mastery; onSelect: (id: string) => void; delay: number }) {
  const ring = mastery === "done" ? "border-good/70" : mastery === "weak" ? "border-warn/70" : "border-line";
  return (
    <motion.button
      tabIndex={-1}
      onClick={() => onSelect(link.other.id)}
      initial={{ opacity: 0, x: side === "left" ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`absolute w-[31%] -translate-y-1/2 rounded-xl border bg-surface/90 px-3 py-1.5 text-left transition-colors hover:border-flow ${ring} ${side === "left" ? "left-0" : "right-0"}`}
      style={{ top }}
    >
      <span className="block truncate text-sm font-semibold">{link.other.name}</span>
      <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-ink-quiet">{side === "left" ? `${verb} →` : `→ ${verb}`}</span>
    </motion.button>
  );
}
