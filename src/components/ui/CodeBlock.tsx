"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef } from "react";

import { tokenize, type Language } from "./highlight";

/**
 * Highlighted, read-only code. Lines that changed since the previous render glow briefly,
 * so a refactor step shows exactly what moved.
 */
export function CodeBlock({ source, language = "java", highlight = [], title, maxHeight = 420 }: { source: string; language?: Language; highlight?: number[]; title?: string; maxHeight?: number }) {
  const lines = useMemo(() => source.replace(/\n$/, "").split("\n"), [source]);
  const previous = useRef<string[] | null>(null);
  const changed = useMemo(() => {
    const before = previous.current;
    if (!before) return new Set<number>();
    const old = new Set(before);
    return new Set(lines.map((l, i) => (old.has(l) ? -1 : i)).filter((i) => i >= 0));
  }, [lines]);
  previous.current = lines;
  const marked = new Set(highlight);

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-[color-mix(in_srgb,var(--bg)_70%,var(--surface))] shadow-card">
      <figcaption className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-fail/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
        </span>
        <span className="font-mono text-xs text-ink-quiet">{title ?? language}</span>
      </figcaption>
      <pre className="overflow-auto py-3 font-mono text-[12.5px] leading-[1.6]" style={{ maxHeight }} tabIndex={0} aria-label={title ? `Code: ${title}` : "Code"}>
        <code>
          <AnimatePresence initial={false}>
            {lines.map((line, i) => (
              <motion.span
                key={`${i}:${line}`}
                layout="position"
                initial={changed.has(i) ? { opacity: 0, x: -6, backgroundColor: "color-mix(in srgb, var(--good) 28%, transparent)" } : false}
                animate={{ opacity: 1, x: 0, backgroundColor: marked.has(i + 1) ? "color-mix(in srgb, var(--warn) 9%, transparent)" : "rgba(0,0,0,0)" }}
                transition={{ duration: 0.5 }}
                className={`block pr-4 ${marked.has(i + 1) ? "border-l-2 border-warn" : "border-l-2 border-transparent"}`}
              >
                <span className="inline-block w-9 select-none pr-3 text-right text-ink-quiet/50">{i + 1}</span>
                {tokenize(line, language).map((t, j) =>
                  t.kind === "plain" ? <span key={j}>{t.text}</span> : <span key={j} className={`code-token-${t.kind}`}>{t.text}</span>,
                )}
                {line === "" ? " " : null}
              </motion.span>
            ))}
          </AnimatePresence>
        </code>
      </pre>
    </figure>
  );
}
