import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkipTest } from "@/components/check/SkipTest";
import { Icon } from "@/components/ui/Icon";
import { buildDiagnostic } from "@/content/diagnostic";
import { loadValidContent } from "@/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadValidContent().worlds.map((w) => ({ world: w.id }));
}

type Props = { params: Promise<{ world: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { world } = await params;
  const name = loadValidContent().worlds.find((w) => w.id === world)?.name;
  return name ? { title: `Skip test: ${name}`, description: `Already know ${name}? Prove it in a few questions and take its levels off your path.` } : {};
}

export default async function CheckPage({ params }: Props) {
  const { world } = await params;
  const diagnostic = buildDiagnostic(world);
  if (!diagnostic) notFound();
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-xs text-ink-quiet">
        <Link href={`/#world-${world}`} className="flex items-center gap-1 hover:text-flow">
          <Icon name="arrowLeft" size={13} /> Back to {diagnostic.worldName}
        </Link>
      </nav>
      <SkipTest diagnostic={diagnostic} />
    </main>
  );
}
