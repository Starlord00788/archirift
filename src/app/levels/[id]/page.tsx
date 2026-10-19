import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadValidContent } from "@/content/load";
import { RecordVisit } from "@/components/RecordVisit";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadValidContent().levels.map((level) => ({ id: level.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const level = loadValidContent().levels.find((l) => l.id === id);
  return level ? { title: level.title, description: level.summary } : {};
}

export default async function LevelPage({ params }: Props) {
  const { id } = await params;
  const { levels, concepts } = loadValidContent();
  const level = levels.find((l) => l.id === id);
  if (!level) notFound();

  const names = new Map(concepts.map((c) => [c.id, c.name]));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <RecordVisit lessonId={level.id} activity="pain" />
      <Link href="/" className="font-mono text-sm text-ink-quiet hover:text-flow">
        ← Back to the city
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{level.title}</h1>
        <p className="text-lg text-ink-quiet">{level.summary}</p>
      </header>

      <dl className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-xs text-ink-quiet">Teaches</dt>
          <dd>{level.concepts.map((c) => names.get(c) ?? c).join(", ")}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-ink-quiet">Beats</dt>
          <dd className="capitalize">{level.beats.join(" → ")}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-mono text-xs text-ink-quiet">When not to use it</dt>
          <dd>{level.whenNotToUse}</dd>
        </div>
      </dl>

      <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-quiet">
        This level becomes playable in Milestone 1. Until then, try the{" "}
        <Link href="/lab/flow/" className="underline hover:text-flow">
          diagram lab
        </Link>
        , which already saves your layout.
      </p>
    </main>
  );
}
