"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "flow" | "player" | "warn" | "good" | "pink" | "lime";
  glyph?: string;
}

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { ...toast, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-3 top-20 z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="glass pointer-events-auto flex items-center gap-3 rounded-2xl border border-line-strong p-3 shadow-card"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-bg"
                style={{ background: `var(--${t.tone ?? "flow"})` }}
                aria-hidden="true"
              >
                {t.glyph ?? "★"}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{t.title}</span>
                {t.body && <span className="text-xs text-ink-quiet">{t.body}</span>}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
