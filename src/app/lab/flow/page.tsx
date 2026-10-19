import type { Metadata } from "next";
import Link from "next/link";
import { StrategyDiagramLab } from "./StrategyDiagramLab";

export const metadata: Metadata = { title: "Diagram lab" };

export default function FlowLabPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Link href="/" className="font-mono text-sm text-ink-quiet hover:text-flow">
        ← Back to the city
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">Diagram lab</h1>
        <p className="text-ink-quiet">
          Milestone 0 spike: the Strategy pattern as an editable class diagram. Drag the boxes, then reload
          the page. Your layout is restored exactly.
        </p>
      </header>
      <StrategyDiagramLab />
    </main>
  );
}
