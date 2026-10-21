"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  GUEST,
  activeProfile,
  adoptGuestProgress,
  getLocalStore,
  notifyLearningChange,
  onLearningChange,
  setActiveProfile,
} from "@/persistence/client";
import { appCheckSiteKey, cloudConfigured, firebaseConfig } from "./config";
import { SyncEngine } from "./engine";

export type AuthStatus = "unconfigured" | "loading" | "signed-out" | "signed-in";
export type SyncState = "idle" | "syncing" | "synced" | "offline" | "error";

export interface Account {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
  provider: "google" | "password" | "other";
}

interface AuthContextValue {
  status: AuthStatus;
  account: Account | null;
  sync: { state: SyncState; lastSyncedAt: string | null };
  error: string | null;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(name: string, email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
  clearError(): void;
  /** The Firestore handle once signed in, for features like the leaderboard. */
  firestore: Firestore | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

interface Firebase {
  auth: Auth;
  firestore: () => Promise<Firestore>;
}

let firebasePromise: Promise<Firebase> | null = null;

/** Loads Firebase only when accounts are configured, and only once per tab. */
function loadFirebase(): Promise<Firebase> {
  firebasePromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const fresh = getApps().length === 0;
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    // App Check must start before auth or Firestore send their first request.
    if (fresh && appCheckSiteKey) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    }
    let db: Firestore | null = null;
    return {
      auth: getAuth(app),
      firestore: async () => {
        if (!db) {
          const { getFirestore } = await import("firebase/firestore");
          db = getFirestore(app);
        }
        return db;
      },
    };
  })();
  return firebasePromise;
}

/** Set while a Google sign-in redirect is in flight, so the page it returns to finishes signing in. */
const REDIRECT_KEY = "archirift:auth-redirect";

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

function toAccount(user: User): Account {
  const providerId = user.providerData[0]?.providerId;
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Architect",
    email: user.email,
    photoURL: user.photoURL,
    provider: providerId === "google.com" ? "google" : providerId === "password" ? "password" : "other",
  };
}

const FRIENDLY: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/wrong-password": "That email and password don't match an account.",
  "auth/user-not-found": "There's no account with that email yet. Create one instead?",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for your password.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/cancelled-popup-request": "The Google window was closed before signing in.",
  "auth/network-request-failed": "You seem to be offline. Try again when you're connected.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/unauthorized-domain": "This site isn't allowed to sign in yet. Add its domain under Firebase → Authentication → Settings → Authorized domains.",
};

function friendly(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  return FRIENDLY[code] ?? "Something went wrong while signing in. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(cloudConfigured ? "loading" : "unconfigured");
  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<{ state: SyncState; lastSyncedAt: string | null }>({ state: "idle", lastSyncedAt: null });
  const [error, setError] = useState<string | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const engine = useRef<SyncEngine | null>(null);

  const runSync = useCallback(async () => {
    const current = engine.current;
    if (!current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSync((s) => ({ ...s, state: "offline" }));
      return;
    }
    setSync((s) => ({ ...s, state: "syncing" }));
    try {
      const report = await current.sync();
      setSync({ state: "synced", lastSyncedAt: new Date().toISOString() });
      if (report.pulledEvents > 0 || report.pulledSnapshots > 0) notifyLearningChange();
    } catch {
      setSync((s) => ({ ...s, state: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error" }));
    }
  }, []);

  // Follow the Firebase session and keep this tab on the matching local database. Started on demand:
  // a guest who never signs in never downloads Firebase.
  const listening = useRef<{ cancelled: boolean; unsubscribe?: () => void } | null>(null);
  const listen = useCallback(() => {
    if (!cloudConfigured || listening.current) return;
    const session: { cancelled: boolean; unsubscribe?: () => void } = { cancelled: false };
    listening.current = session;
    loadFirebase()
      .then(async ({ auth, firestore: getDb }) => {
        const { onAuthStateChanged } = await import("firebase/auth");
        if (session.cancelled) return;
        session.unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (session.cancelled) return;
          storage()?.removeItem(REDIRECT_KEY);
          const stored = activeProfile();
          if (user) {
            if (stored !== user.uid) {
              // First time on this device with this account: bring the guest's progress along.
              if (stored === GUEST) await adoptGuestProgress(user.uid).catch(() => 0);
              setActiveProfile(user.uid);
              window.location.reload();
              return;
            }
            const db = await getDb();
            const { FirestoreRemoteStore } = await import("./firestore");
            engine.current = new SyncEngine(getLocalStore(), new FirestoreRemoteStore(db, user.uid));
            setFirestore(db);
            setAccount(toAccount(user));
            setStatus("signed-in");
            void runSync();
          } else {
            engine.current = null;
            setFirestore(null);
            if (stored !== GUEST) {
              setActiveProfile(GUEST);
              window.location.reload();
              return;
            }
            setAccount(null);
            setStatus("signed-out");
          }
        });
      })
      .catch(() => setStatus("unconfigured"));
  }, [runSync]);

  useEffect(() => {
    if (!cloudConfigured) return;
    // Signed in on this device before, or coming back from a sign-in redirect: restore the session.
    // Otherwise this is a guest, and Firebase waits until they choose to sign in.
    const known = activeProfile() !== GUEST || storage()?.getItem(REDIRECT_KEY) === "1";
    const start = setTimeout(() => (known ? listen() : setStatus((s) => (s === "loading" ? "signed-out" : s))), 0);
    return () => {
      clearTimeout(start);
      const session = listening.current;
      if (session) {
        session.cancelled = true;
        session.unsubscribe?.();
        listening.current = null;
      }
    };
  }, [listen]);

  // Push changes shortly after they happen, and catch up when the tab returns or the network does.
  useEffect(() => {
    if (status !== "signed-in") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(), 2500);
    };
    const off = onLearningChange(soon);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
      else if (timer) {
        clearTimeout(timer);
        void runSync();
      }
    };
    const onOnline = () => void runSync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void runSync();
    }, 90_000);
    return () => {
      off();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [status, runSync]);

  const guard = useCallback(async (action: (fb: Firebase) => Promise<void>) => {
    setError(null);
    listen();
    try {
      await action(await loadFirebase());
    } catch (e) {
      setError(friendly(e));
      throw e;
    }
  }, [listen]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      account,
      sync,
      error,
      firestore,
      clearError: () => setError(null),
      syncNow: runSync,
      signInWithGoogle: () =>
        guard(async ({ auth }) => {
          const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          try {
            await signInWithPopup(auth, provider);
          } catch (e) {
            // Some mobile browsers block pop-ups; fall back to a full-page redirect.
            if ((e as { code?: string }).code === "auth/popup-blocked") {
              storage()?.setItem(REDIRECT_KEY, "1");
              await signInWithRedirect(auth, provider);
            }
            else throw e;
          }
        }),
      signInWithEmail: (email, password) =>
        guard(async ({ auth }) => {
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          await signInWithEmailAndPassword(auth, email.trim(), password);
        }),
      signUpWithEmail: (name, email, password) =>
        guard(async ({ auth }) => {
          const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
          const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
          if (name.trim()) await updateProfile(user, { displayName: name.trim() });
        }),
      resetPassword: (email) =>
        guard(async ({ auth }) => {
          const { sendPasswordResetEmail } = await import("firebase/auth");
          await sendPasswordResetEmail(auth, email.trim());
        }),
      signOut: () =>
        guard(async ({ auth }) => {
          // Send anything still queued before leaving this account's data behind.
          await runSync().catch(() => {});
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
        }),
    }),
    [status, account, sync, error, firestore, guard, runSync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
