"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Icon } from "@/components/ui/Icon";
import type { CodeStageSchema } from "@/content/rift";
import type { z } from "zod";
import { runCodeTestsInWorker } from "../../code";
import type { StageState } from "../../state";
import type { Dispatch } from "../types";

type Stage = z.infer<typeof CodeStageSchema>;
type State = Extract<StageState, { kind: "code" }>;

const INDENT = "  ";

/** Write real code: JavaScript checked by hidden tests in a sandboxed worker. */
export function CodeStage({ stage, state, dispatch }: { stage: Stage; state: State; dispatch: Dispatch }) {
  const [running, setRunning] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const lines = state.source.split("\n").length;

  async function run() {
    setRunning(true);
    try {
      const results = await runCodeTestsInWorker(stage.given, state.source, stage.tests);
      dispatch({ type: "codeResults", results });
    } finally {
      setRunning(false);
    }
  }

  /** Tab indents instead of leaving the editor; Escape then Tab still moves focus on. */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey || state.done) return;
    const el = e.currentTarget;
    if (el.dataset.escaped === "true") return;
    e.preventDefault();
    const { selectionStart: start, selectionEnd: end } = el;
    const next = state.source.slice(0, start) + INDENT + state.source.slice(end);
    dispatch({ type: "codeEdit", source: next });
    requestAnimationFrame(() => editor.current?.setSelectionRange(start + INDENT.length, start + INDENT.length));
  }

  return (
    <div className="flex flex-col gap-4">
      {stage.given && <CodeBlock source={stage.given} language="js" title="Given (read-only)" maxHeight={320} />}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <label htmlFor="code-editor" className="flex items-center gap-2 font-mono text-xs text-ink-quiet">
            <Icon name="code" /> Your code (JavaScript)
          </label>
          <span className="text-xs text-ink-quiet">Tab indents · Esc then Tab leaves</span>
        </div>
        <textarea
          id="code-editor"
          ref={editor}
          aria-label="Your code"
          value={state.source}
          readOnly={state.done}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={Math.min(Math.max(lines + 1, 8), 28)}
          onChange={(e) => dispatch({ type: "codeEdit", source: e.target.value })}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (e.key === "Escape") e.currentTarget.dataset.escaped = "true";
          }}
          onFocus={(e) => {
            e.currentTarget.dataset.escaped = "false";
          }}
          className="block w-full resize-y bg-bg/60 p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:bg-bg/80"
        />
      </div>

      {!state.done && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={run} disabled={running}>
            <Icon name="play" /> {running ? "Running…" : "Run tests"}
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "codeReset" })} disabled={running}>
            Reset code
          </Button>
          <span className="text-xs text-ink-quiet">
            {stage.tests.length} hidden {stage.tests.length === 1 ? "test" : "tests"}
          </span>
        </div>
      )}

      <AnimatePresence>
        {state.results && (
          <motion.ul initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-2" aria-live="polite" aria-label="Test results">
            {state.results.map((r, i) => (
              <motion.li
                key={r.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${r.passed ? "border-good/50 bg-good/5" : "border-fail/50 bg-fail/5"}`}
              >
                <Icon name={r.passed ? "check" : "x"} className={`mt-0.5 shrink-0 ${r.passed ? "text-good" : "text-fail"}`} />
                <span>
                  <span className="font-semibold">{r.name}</span>
                  {!r.passed && <span className="block font-mono text-xs text-ink-quiet">{r.message}</span>}
                  <span className="sr-only">{r.passed ? " passed" : " failed"}</span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
