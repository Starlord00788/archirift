"use client";

import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { RiftState } from "../state";

/** The coach's voice: one line of feedback after every move, announced politely. */
export function Feedback({ feedback }: { feedback: RiftState["feedback"] }) {
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
            <span>{feedback.text}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
