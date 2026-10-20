"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/sync/AuthProvider";

const input = "w-full rounded-xl border border-line bg-bg/60 px-3 py-2.5 outline-none transition-colors focus:border-flow";

/** Sign in with Google or email, see sync status, sign out. */
export function AccountPanel() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      // The provider turns errors into a friendly message.
    } finally {
      setBusy(false);
    }
  };

  if (auth.status === "unconfigured") {
    return (
      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface/70 p-6">
        <h2 className="font-display text-xl font-semibold">Accounts aren&apos;t switched on here</h2>
        <p className="text-sm text-ink-quiet">
          This copy of Archirift has no cloud account service configured, so your progress is saved on this device only (it survives reloads and restarts). Whoever runs this site can enable
          Google and email sign-in by following <code className="font-mono text-flow">docs/ACCOUNTS.md</code>.
        </p>
        <ButtonLink href="/" className="w-fit">
          Back to the city
        </ButtonLink>
      </div>
    );
  }

  if (auth.status === "loading") {
    return <div className="rift-line w-full" aria-label="Checking your account" />;
  }

  if (auth.status === "signed-in" && auth.account) {
    const a = auth.account;
    const syncText: Record<string, string> = {
      idle: "Waiting to sync",
      syncing: "Syncing…",
      synced: "All progress synced",
      offline: "Offline: changes will sync when you reconnect",
      error: "Sync failed; we'll retry automatically",
    };
    return (
      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface/70 p-6">
        <div className="flex items-center gap-4">
          {a.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photoURL} alt="" className="h-16 w-16 rounded-2xl" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-flow to-player font-display text-2xl font-bold text-bg">{a.name[0]?.toUpperCase()}</span>
          )}
          <div>
            <h2 className="font-display text-2xl font-bold">{a.name}</h2>
            <p className="text-sm text-ink-quiet">
              {a.email} · signed in with {a.provider === "google" ? "Google" : "email"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg/40 p-4">
          <Icon name={auth.sync.state === "offline" || auth.sync.state === "error" ? "cloudOff" : "cloud"} className={auth.sync.state === "synced" ? "text-good" : "text-warn"} />
          <div className="flex-1">
            <p className="text-sm font-semibold" role="status">
              {syncText[auth.sync.state]}
            </p>
            <p className="text-xs text-ink-quiet">
              Your progress is tied to your account and follows you to any device.
              {auth.sync.lastSyncedAt ? ` Last synced ${new Date(auth.sync.lastSyncedAt).toLocaleTimeString()}.` : ""}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void auth.syncNow()} disabled={auth.sync.state === "syncing"}>
            Sync now
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/profile/" variant="primary">
            View profile
          </ButtonLink>
          <Button variant="danger" disabled={busy} onClick={() => void run(auth.signOut)}>
            <Icon name="logout" size={15} /> Sign out
          </Button>
        </div>
        <p className="text-xs text-ink-quiet">Signing out keeps everything safe in your account. This device then starts a fresh guest session.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl font-bold tracking-tight">Save your progress to your account</h2>
        <p className="text-ink-quiet">Sign in once and your levels, XP, streak and review schedule follow you to every device. Anything you&apos;ve already done as a guest on this device comes with you.</p>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {["Progress synced across laptop and phone", "Spaced reviews that remember you", "Join your college leaderboard (optional)"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Icon name="check" size={16} className="text-good" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/80 p-6 shadow-card">
        <Button variant="secondary" className="w-full py-3 text-base" disabled={busy} onClick={() => void run(auth.signInWithGoogle)}>
          <Icon name="google" size={18} /> Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-quiet">
          <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
        </div>

        <div role="tablist" aria-label="Email options" className="flex rounded-xl border border-line p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => {
                auth.clearError();
                setMode(m);
              }} className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${mode === m ? "bg-surface-2 text-ink" : "text-ink-quiet"}`}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "signin") void run(() => auth.signInWithEmail(email, password));
              if (mode === "signup") void run(() => auth.signUpWithEmail(name, email, password));
              if (mode === "reset")
                void run(async () => {
                  await auth.resetPassword(email);
                  setSent(true);
                });
            }}
          >
            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-sm">
                Your name
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} required />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            {mode !== "reset" && (
              <label className="flex flex-col gap-1 text-sm">
                Password
                <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required />
              </label>
            )}
            {auth.error && (
              <p role="alert" className="rounded-lg border border-fail/60 bg-fail/5 p-2 text-sm text-fail">
                {auth.error}
              </p>
            )}
            {sent && mode === "reset" && (
              <p role="status" className="text-sm text-good">
                If an account exists for that email, a reset link is on its way.
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              <Icon name="mail" size={16} /> {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
            {mode === "signin" && (
              <button type="button" className="text-left text-xs text-ink-quiet underline hover:text-ink" onClick={() => setMode("reset")}>
                Forgot your password?
              </button>
            )}
            {mode === "reset" && (
              <button type="button" className="text-left text-xs text-ink-quiet underline hover:text-ink" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
          </motion.form>
        </AnimatePresence>
      </div>
    </div>
  );
}
