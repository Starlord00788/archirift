import type { Metadata } from "next";
import { CodexIndex } from "@/components/codex/CodexIndex";
import { buildCatalog } from "@/content/catalog";
import { loadValidContent } from "@/content/load";
import { KineticText } from "@/components/fx/KineticText";

export const metadata: Metadata = { title: "Codex", description: "One-page cheat sheets for every low-level and high-level design concept." };

export default function CodexPage() {
  const { levels } = loadValidContent();
  const oneLiners = Object.fromEntries(levels.map((l) => [l.id, l.rift?.codex.oneLiner ?? l.summary]));
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-flow">Interview prep</p>
        <h1 className="font-display text-4xl font-bold tracking-tight"><KineticText segments={[{ text: "The Codex" }]} /></h1>
        <p className="mt-2 max-w-2xl text-ink-quiet">A one-page cheat sheet for every concept: the idea in one line, a real-life analogy, when to use it, when not to, and what interviewers listen for.</p>
      </header>
      <CodexIndex catalog={buildCatalog()} oneLiners={oneLiners} />
    </main>
  );
}
