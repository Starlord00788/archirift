import { HeroScene } from "@/components/home/HeroScene";
import { TodayPanel } from "@/components/home/TodayPanel";
import { WorldMap } from "@/components/home/WorldMap";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { loadValidContent } from "@/content/load";

const LOOP = [
  { title: "Pain", text: "Watch a badly designed system break in a real-life story.", tone: "var(--fail)" },
  { title: "Play", text: "Fix it with your own hands: refactor, scale, simulate.", tone: "var(--flow)" },
  { title: "Proof", text: "Beat the interview boss with the trade-offs.", tone: "var(--player)" },
  { title: "Recall", text: "Rebuild it from memory. Spaced reviews make it stick.", tone: "var(--good)" },
];

export default function Home() {
  const { levels, worlds } = loadValidContent();
  const lld = worlds.filter((w) => w.track === "lld").map((w) => w.id);
  const firstLld = levels.find((l) => l.world === lld[0]) ?? levels[0];
  const firstHld = levels.find((l) => !lld.includes(l.world)) ?? levels[0];

  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full border border-flow/40 bg-flow/10 px-3 py-1 font-mono text-xs text-flow">Build it. Break it. Scale it.</p>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Archirift
            <span className="mt-3 block text-3xl font-semibold text-ink-quiet sm:text-4xl">
              Learn system design by <span className="text-gradient">saving a city</span>.
            </span>
          </h1>
          <p className="max-w-xl text-lg text-ink-quiet">
            Every badly designed system tears a rift in the city. Learn low-level and high-level design by watching systems break, fixing them with your own hands, and
            proving it in interview boss fights. {levels.length} levels, from Singleton to designing WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/levels/${firstLld.id}/`} variant="primary" className="px-6 py-3 text-base">
              Start with LLD <Icon name="arrowRight" size={16} />
            </ButtonLink>
            <ButtonLink href={`/levels/${firstHld.id}/`} className="px-6 py-3 text-base">
              Jump to HLD
            </ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-ink-quiet">
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={14} className="text-good" /> Free and open source
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={14} className="text-good" /> Saves itself, syncs to your account
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={14} className="text-good" /> Built for interviews
            </li>
          </ul>
        </div>
        <div className="relative rounded-[2rem] border border-line bg-surface/50 p-4 shadow-card">
          <HeroScene />
        </div>
      </section>

      <TodayPanel />

      <section aria-label="How every level works" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LOOP.map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-line bg-surface/50 p-4">
            <p className="font-mono text-xs" style={{ color: step.tone }}>
              0{i + 1} · {step.title}
            </p>
            <p className="mt-1 text-sm text-ink-quiet">{step.text}</p>
          </div>
        ))}
      </section>

      <WorldMap />

      <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-quiet sm:flex-row sm:items-center sm:justify-between">
        <p>Archirift is free and open source. Code under MIT, lessons under CC BY 4.0.</p>
        <p className="flex gap-4">
          <a className="underline hover:text-flow" href="https://github.com/Starlord00788/archirift">
            GitHub
          </a>
          <a className="underline hover:text-flow" href="https://github.com/Starlord00788/archirift/blob/main/CONTRIBUTING.md">
            Write a level
          </a>
        </p>
      </footer>
    </main>
  );
}
