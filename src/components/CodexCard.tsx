import type { Codex } from "@/content/rift";
import { Rich } from "@/rift/ui/Rich";
import { CodeBlock } from "./ui/CodeBlock";

const LIST: { key: keyof Pick<Codex, "keyPoints" | "whenToUse" | "whenNotToUse" | "interviewTells" | "pitfalls">; title: string; tone: string }[] = [
  { key: "keyPoints", title: "Key points", tone: "var(--flow)" },
  { key: "whenToUse", title: "Reach for it when", tone: "var(--good)" },
  { key: "whenNotToUse", title: "Don't use it when", tone: "var(--fail)" },
  { key: "interviewTells", title: "Interview tells", tone: "var(--player)" },
  { key: "pitfalls", title: "Pitfalls", tone: "var(--warn)" },
];

/** The one-page cheat sheet for a concept, shown after a level and in the Codex. */
export function CodexCard({ name, codex, compact = false }: { name: string; codex: Codex; compact?: boolean }) {
  return (
    <article className="flex flex-col gap-4" aria-label={`Codex: ${name}`}>
      <div className="rounded-2xl border border-flow/40 bg-linear-to-br from-flow/10 to-player/10 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-flow">In one line</p>
        <p className="mt-1 font-display text-xl font-semibold leading-snug">
          <Rich text={codex.oneLiner} inline />
        </p>
        <p className="mt-3 text-sm text-ink-quiet">
          <span className="font-semibold text-ink">Analogy: </span>
          <Rich text={codex.analogy} inline />
        </p>
      </div>
      <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {LIST.filter((l) => codex[l.key].length > 0).map((l) => (
          <section key={l.key} className="rounded-2xl border border-line bg-surface/60 p-4">
            <h3 className="mb-2 font-display font-semibold" style={{ color: l.tone }}>
              {l.title}
            </h3>
            <ul className="flex flex-col gap-1.5 text-sm">
              {codex[l.key].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.tone }} aria-hidden="true" />
                  <span>
                    <Rich text={item} inline />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {codex.code && !compact && <CodeBlock source={codex.code.source} language={codex.code.language} highlight={codex.code.highlight} title="Reference implementation" />}
    </article>
  );
}
