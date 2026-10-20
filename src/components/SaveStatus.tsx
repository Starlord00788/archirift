import type { SaveStatus as Status } from "@/persistence/useExerciseState";

const text: Record<Status, string> = {
  loading: "Loading your progress…",
  idle: "",
  saving: "Saving…",
  saved: "Saved on this device",
  failed: "Not saved",
};

/** Subtle, polite save indicator (PRD: "What the learner sees"). */
export function SaveStatus({ status }: { status: Status }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`min-h-5 font-mono text-xs ${status === "failed" ? "text-fail" : "text-ink-quiet"}`}
    >
      {text[status]}
    </p>
  );
}
