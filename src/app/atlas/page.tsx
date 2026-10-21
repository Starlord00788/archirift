import type { Metadata } from "next";
import { Atlas, type AtlasData } from "@/components/atlas/Atlas";
import { loadValidContent } from "@/content/load";
import { KineticText } from "@/components/fx/KineticText";

export const metadata: Metadata = {
  title: "Atlas",
  description: "How every design concept connects: what each idea needs, enables, trades off against and is used in.",
};

export default function AtlasPage() {
  const { worlds = [], concepts, edges, levels } = loadValidContent();
  const levelsByConcept: AtlasData["levelsByConcept"] = {};
  for (const level of levels) {
    for (const concept of level.concepts) {
      (levelsByConcept[concept] ??= []).push({ id: level.id, title: level.title, codex: Boolean(level.rift) });
    }
  }
  const firstSeen = (id: string) => {
    const i = levels.findIndex((l) => l.concepts.includes(id));
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const data: AtlasData = {
    worlds: [...worlds].sort((a, b) => a.order - b.order).map((w) => ({ id: w.id, name: w.name, track: w.track, accent: w.accent })),
    // Course order: a concept sits where you first meet it (levels arrive sorted by world, then order).
    concepts: [...concepts].sort((a, b) => firstSeen(a.id) - firstSeen(b.id)).map((c) => ({ id: c.id, name: c.name, world: c.world, rule: c.rule, aliases: c.aliases, misconceptions: c.misconceptions })),
    edges: edges.map((e) => ({ from: e.from, to: e.to, type: e.type, explanation: e.explanation })),
    levelsByConcept,
  };
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-flow">Knowledge graph</p>
        <h1 className="font-display text-4xl font-bold tracking-tight"><KineticText segments={[{ text: "The Atlas" }]} /></h1>
        <p className="mt-2 max-w-2xl text-ink-quiet">
          Every concept, and how it connects to the others. Pick one to see what it builds on and what it leads to; that is how interviewers expect you to reason.
        </p>
      </header>
      <Atlas data={data} />
    </main>
  );
}
