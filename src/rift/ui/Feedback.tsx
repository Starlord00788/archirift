"use client";

import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { RiftState } from "../state";

/** The coach's voice: one line of feedback after every move, announced politely. */
export function Feedback({ feedback, onDismiss }: { feedback: RiftState["feedback"]; onDismiss?: () => void }) {
  const colour = feedback?.tone === "good" ? "var(--good)" : feedback?.tone === "bad" ? "var(--fail)" : "var(--flow)";
  return (
    <div role="status" aria-live="polite" className="min-h-0">
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.p
            key={feedback.text}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`flex items-start gap-3 rounded-xl border bg-surface/90 p-3 text-sm ${feedback.tone === "bad" ? "animate-shake" : ""}`}
            style={{ borderColor: colour }}
          >
            <span className="mt-0.5" style={{ color: colour }}>
              <Icon name={feedback.tone === "good" ? "check" : feedback.tone === "bad" ? "x" : "info"} size={16} />
            </span>
            <span className="flex-1">{feedback.text}</span>
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="-m-1 rounded-lg p-1 text-ink-quiet hover:text-ink" aria-label="Dismiss">
                <Icon name="x" size={14} />
              </button>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
