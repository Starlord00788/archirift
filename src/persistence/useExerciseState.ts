"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRepository } from "./client";
import { StaleWriteError, type SnapshotCodec } from "./repository";
import { withRetry } from "./retry";

export type SaveStatus = "loading" | "idle" | "saving" | "saved" | "failed";

interface Options<S, A> {
  exerciseId: string;
  codec: SnapshotCodec<S>;
  initial: () => S;
  reducer: (state: S, action: A) => S;
  /** Wait this long after the last change before saving (drags and rapid clicks coalesce). */
  debounceMs?: number;
}

/**
 * Exercise state that saves itself (PRD: Persistence and resume, stage 2).
 * Restores the last valid snapshot on mount, checkpoints after changes, never overwrites newer
 * state from another tab, and keeps saving off the critical path of the interaction.
 */
export function useExerciseState<S, A>({ exerciseId, codec, initial, reducer, debounceMs = 400 }: Options<S, A>) {
  const [state, setState] = useState<S | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const attempt = useRef(1);
  const revision = useRef(0);
  const latest = useRef<S | null>(null);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  const save = useCallback(
    async (snapshotStatus: "unfinished" | "completed" = "unfinished") => {
      if (blocked.current) return;
      if (saving.current) {
        // Another save is in flight; save again once it lands so no change is lost.
        dirty.current = true;
        await saving.current;
        if (!dirty.current && snapshotStatus === "unfinished") return;
      }
      const toSave = latest.current;
      if (toSave === null) return;
      dirty.current = false;
      setStatus("saving");
      const run = withRetry(() =>
        getRepository().saveSnapshot(
          {
            id: `${exerciseId}#${attempt.current}`,
            exerciseId,
            attempt: attempt.current,
            status: snapshotStatus,
            schemaVersion: codec.currentVersion,
            state: toSave,
          },
          revision.current,
        ),
      )
        .then((saved) => {
          revision.current = saved.revision;
          setStatus("saved");
        })
        .catch((error) => {
          if (error instanceof StaleWriteError) {
            blocked.current = true;
            setNotice("This exercise was changed in another tab. Reload this page to continue with the newest version.");
          }
          setStatus("failed");
        });
      saving.current = run;
      await run;
      saving.current = null;
      if (dirty.current) await save(snapshotStatus);
    },
    [exerciseId, codec.currentVersion],
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      void save();
    }
  }, [save]);

  // Restore on mount.
  useEffect(() => {
    let cancelled = false;
    const repo = getRepository();
    repo
      .loadSnapshot(exerciseId, codec)
      .then(async (result) => {
        if (cancelled) return;
        if (result.kind === "restored") {
          attempt.current = result.snapshot.attempt;
          revision.current = result.snapshot.revision;
          latest.current = result.snapshot.state;
          setState(result.snapshot.state);
          setRestoredAt(result.snapshot.updatedAt);
          setStatus("saved");
          return;
        }
        if (result.kind === "unrecoverable") {
          setNotice("Your saved progress in this exercise couldn't be restored, so it starts fresh. A copy of the old save was kept.");
        }
        attempt.current = await repo.restartExercise(exerciseId);
        revision.current = 0;
        latest.current = initial();
        setState(latest.current);
        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        blocked.current = true;
        latest.current = initial();
        setState(latest.current);
        setStatus("failed");
        setNotice("Progress can't be saved on this device (storage may be blocked, for example in private browsing). You can still play.");
      });
    return () => {
      cancelled = true;
    };
    // initial and codec are stable for an exercise; restoring once per mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  // Save pending changes when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  const dispatch = useCallback(
    (action: A) => {
      const current = latest.current;
      if (current === null) return;
      const next = reducer(current, action);
      if (next === current) return;
      latest.current = next;
      setState(next);
      // Be honest straight away: there is now an unsaved change.
      if (!blocked.current) setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, debounceMs);
    },
    [reducer, save, debounceMs],
  );

  /** Marks the attempt completed. Completed snapshots can no longer change. */
  const complete = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await save("completed");
  }, [save]);

  /** Starts a fresh attempt; earlier attempts and all learning history are kept. */
  const restart = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await saving.current;
    attempt.current = await getRepository().restartExercise(exerciseId);
    revision.current = 0;
    blocked.current = false;
    latest.current = initial();
    setState(latest.current);
    setRestoredAt(null);
    setNotice(null);
    setStatus("idle");
  }, [exerciseId, initial]);

  return { state, dispatch, status, notice, restoredAt, attempt: attempt.current, complete, restart };
}
