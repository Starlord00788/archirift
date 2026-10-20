import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { loadValidContent } from "@/content/load";
import { HydraLevelLazy } from "@/levels/hydra/ui/HydraLevelLazy";
import { RiftLevel } from "@/rift/ui/RiftLevel";

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

/** Levels with hand-built code. Every other level is played by the generic rift engine. */
const BESPOKE: Record<string, () => React.ReactNode> = {
  "lld-strategy-hydra": () => <HydraLevelLazy />,
};

export default async function LevelPage({ params }: Props) {
  const { id } = await params;
  const { levels, worlds, concepts } = loadValidContent();
  const level = levels.find((l) => l.id === id);
  if (!level) notFound();
  const world = worlds.find((w) => w.id === level.world)!;

  // Next level: the next one in this world, then the first level of the next world.
  const ordered = worlds.flatMap((w) => levels.filter((l) => l.world === w.id).sort((a, b) => a.order - b.order));
  const next = ordered[ordered.findIndex((l) => l.id === level.id) + 1] ?? null;

  const Bespoke = BESPOKE[level.id];
  const concept = concepts.find((c) => c.id === level.concepts[0]);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-xs text-ink-quiet">
        <Link href="/" className="flex items-center gap-1 hover:text-flow">
          <Icon name="arrowLeft" size={13} /> Back to the city
        </Link>
        <span aria-hidden="true">/</span>
        <span>{world.name}</span>
      </nav>
      {Bespoke ? (
        <Bespoke />
      ) : level.rift ? (
        <RiftLevel
          info={{
            id: level.id,
            title: level.title,
            summary: level.summary,
            difficulty: level.difficulty,
            minutes: level.minutes,
            concept: { id: level.concepts[0], name: concept?.name ?? level.title },
            world: { id: world.id, name: world.name, accent: world.accent },
            next: next ? { id: next.id, title: next.title } : null,
            rift: level.rift,
          }}
        />
      ) : (
        <>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{level.title}</h1>
          <p className="text-lg text-ink-quiet">{level.summary}</p>
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-quiet">This level is not playable yet.</p>
        </>
      )}
    </main>
  );
}
