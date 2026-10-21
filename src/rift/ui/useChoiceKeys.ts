"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard answers: A–E or 1–5 pick the choice in that position. Ignored while typing in a field or
 * when `count` is 0, so it never fights with text inputs or locked questions.
 */
export function useChoiceKeys(count: number, pick: (position: number) => void) {
  const latest = useRef(pick);
  useEffect(() => {
    latest.current = pick;
  });
  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const key = e.key.toLowerCase();
      const position = /^[1-9]$/.test(key) ? Number(key) - 1 : /^[a-e]$/.test(key) ? key.charCodeAt(0) - 97 : -1;
      if (position < 0 || position >= count) return;
      e.preventDefault();
      latest.current(position);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);
}
