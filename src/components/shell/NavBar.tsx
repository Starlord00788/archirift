"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { rankFor } from "@/game/ranks";
import { currentStreak } from "@/persistence/progress";
import { useLearning } from "@/persistence/useLearning";
import { useAuth } from "@/sync/AuthProvider";
import { Logo } from "./Logo";
import { useCatalog } from "./Providers";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Map", icon: "map" },
  { href: "/review/", label: "Review", icon: "brain" },
  { href: "/codex/", label: "Codex", icon: "book" },
  { href: "/atlas/", label: "Atlas", icon: "layers" },
  { href: "/arena/", label: "Arena", icon: "swords" },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/levels");
  return pathname.startsWith(href.replace(/\/$/, ""));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Everything the header says about the learner, from their saved progress. Nothing is invented. */
function useNavFacts() {
  const { progress, due } = useLearning();
  const catalog = useCatalog();
  const xp = progress?.xp ?? 0;
  const rank = rankFor(xp);
  const streak = progress ? currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10)) : 0;
  const total = catalog.levels.length;
  const sealed = progress ? catalog.levels.filter((l) => progress.completedLessons.includes(l.id)).length : 0;
  const current = progress?.current ? catalog.levels.find((l) => l.id === progress.current?.lessonId && !progress.completedLessons.includes(l.id)) : undefined;
  return { loaded: Boolean(progress), xp, rank, streak, due: due.length, total, sealed, current };
}

type Facts = ReturnType<typeof useNavFacts>;

/** What each destination is for, in plain words, plus what it holds for you when that's known. */
const PURPOSE: Record<string, string[]> = {
  "/codex/": ["Quick reference and interview notes", "One page per concept"],
  "/atlas/": ["See how concepts connect", "What each idea builds on and leads to"],
  "/arena/": ["Timed interview questions", "Ten questions, 25 seconds each"],
};

function previewFor(href: string, f: Facts): string[] | null {
  if (PURPOSE[href]) return PURPOSE[href];
  if (!f.loaded) return null;
  if (href === "/") return [`${f.sealed} of ${f.total} levels sealed`, ...(f.current ? [`Continue: ${f.current.title}`] : [])];
  if (href === "/review/") return [f.due > 0 ? `${plural(f.due, "concept")} due for review now` : "Nothing due right now"];
  return null;
}

export function NavBar() {
  const pathname = usePathname() ?? "/";
  const facts = useNavFacts();
  const { status, account, sync } = useAuth();

  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-2" aria-label="Archirift home">
            <Logo />
            <span className="font-display text-lg font-bold tracking-tight">Archirift</span>
          </Link>

          <span className="mx-2 hidden h-6 w-px bg-line lg:block" aria-hidden="true" />

          <nav aria-label="Main" className="hidden h-full items-stretch lg:flex">
            {LINKS.map((l) => (
              <NavLink key={l.href} link={l} on={active(pathname, l.href)} pathname={pathname} preview={previewFor(l.href, facts)} due={l.href === "/review/" ? facts.due : 0} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Stats facts={facts} pathname={pathname} />
            <AccountButton status={status} name={account?.name ?? null} photo={account?.photoURL ?? null} syncState={sync.state} />
          </div>
        </div>
      </header>

      <Dock pathname={pathname} due={facts.due} />
    </>
  );
}

/**
 * Opens a preview after a short hover or on keyboard focus, and closes it on leave, blur, Escape,
 * click and route change, so fast navigation never leaves one hanging open.
 */
function usePreview(pathname: string) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => {
    setOpen(false);
    window.clearTimeout(timer.current);
  }, [pathname]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  return {
    open,
    hide,
    handlers: {
      onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && show(220),
      onPointerLeave: hide,
      onFocus: (e: React.FocusEvent) => e.target.matches(":focus-visible") && show(0),
      onBlur: hide,
      onKeyDown: (e: React.KeyboardEvent) => e.key === "Escape" && hide(),
      onClick: hide,
    },
  };
}

function Preview({ open, lines, align = "left" }: { open: boolean; lines: string[]; align?: "left" | "right" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className={`pointer-events-none absolute top-[calc(100%+6px)] z-50 flex w-max max-w-64 flex-col gap-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-left text-xs shadow-card ${align === "left" ? "left-0" : "right-0"}`}
        >
          {lines.map((line, i) => (
            <span key={line} className={i === 0 ? "font-medium text-ink" : "text-ink-quiet"}>
              {line}
            </span>
          ))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NavLink({ link, on, pathname, preview, due }: { link: (typeof LINKS)[number]; on: boolean; pathname: string; preview: string[] | null; due: number }) {
  const { open, handlers } = usePreview(pathname);
  const descId = useId();
  return (
    <div className="relative flex items-stretch">
      <Link
        href={link.href}
        aria-current={on ? "page" : undefined}
        aria-describedby={preview ? descId : undefined}
        {...(preview ? handlers : {})}
        className={`group relative my-3 flex items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${on ? "text-ink" : "text-ink-quiet hover:bg-surface-2/70 hover:text-ink"}`}
      >
        <Icon name={link.icon} size={16} className={on ? "text-flow" : ""} />
        {link.label}
        {due > 0 && (
          <span className="rounded-full bg-pink px-1.5 font-mono text-[10px] font-bold leading-4 text-bg" aria-hidden="true">
            {due}
          </span>
        )}
      </Link>
      {/* One bar shared by every link: it slides to whichever destination you are on. */}
      {on && <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-flow" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden="true" />}
      {preview && (
        <>
          <span id={descId} className="sr-only">
            {preview.join(". ")}
          </span>
          <Preview open={open} lines={preview} />
        </>
      )}
    </div>
  );
}

/** Streak and XP as one quiet chip: secondary to the destinations, with the rank on hover or focus. */
function Stats({ facts, pathname }: { facts: Facts; pathname: string }) {
  const { open, handlers } = usePreview(pathname);
  const descId = useId();
  const { rank, next, progress, toNext } = facts.rank;
  const lines = [
    rank.name,
    next ? `${toNext.toLocaleString("en-IN")} XP to ${next.name}` : "Top rank reached",
    facts.streak > 0 ? `${plural(facts.streak, "day")} in a row` : "No streak yet: study today to start one",
  ];
  return (
    <div className="relative">
      <Link
        href="/profile/"
        aria-label={`Your progress: ${facts.xp.toLocaleString("en-IN")} XP, ${plural(facts.streak, "day")} streak`}
        aria-describedby={descId}
        {...handlers}
        className="flex min-h-10 items-center gap-2.5 rounded-xl border border-line px-2.5 text-ink-quiet transition-colors hover:border-line-strong hover:text-ink"
      >
        <span className={`hidden items-center gap-1 sm:flex ${facts.streak > 0 ? "text-warn" : ""}`}>
          <Icon name="flame" size={15} filled={facts.streak > 0} />
          <span className="font-mono text-xs font-bold">{facts.streak}</span>
        </span>
        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
        <span className="flex items-center gap-1.5">
          <Icon name="bolt" size={14} className="text-flow" filled />
          <span className="flex flex-col leading-none">
            <span className="font-mono text-xs font-bold text-ink">{facts.xp.toLocaleString("en-IN")} XP</span>
            <span className="mt-1 hidden h-1 w-14 overflow-hidden rounded-full bg-line sm:block" aria-hidden="true">
              <span className="block h-full rounded-full bg-flow" style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </span>
        </span>
        <span className="hidden text-xs xl:inline">{rank.name}</span>
      </Link>
      <span id={descId} className="sr-only">
        {lines.join(". ")}
      </span>
      <Preview open={open} lines={lines} align="right" />
    </div>
  );
}

function AccountButton({ status, name, photo, syncState }: { status: string; name: string | null; photo: string | null; syncState: string }) {
  if (status === "signed-in" && name) {
    return (
      <Link href="/account/" className="relative flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-transparent hover:ring-flow" title={`${name} · ${syncState === "synced" ? "progress synced" : syncState}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flow font-display text-sm font-bold text-bg">{name[0]?.toUpperCase()}</span>
        )}
        <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-bg ${syncState === "synced" ? "bg-good" : syncState === "syncing" ? "bg-flow" : syncState === "idle" ? "bg-line-strong" : "bg-warn"}`} aria-hidden="true" />
        <span className="sr-only">Your account ({syncState})</span>
      </Link>
    );
  }
  if (status === "unconfigured") return null;
  return (
    <Link href="/account/" className="flex min-h-10 items-center rounded-xl bg-flow px-3 text-sm font-semibold text-bg hover:brightness-110">
      Sign in
    </Link>
  );
}

const THEMES = ["system", "dark", "light"] as const;
type Theme = (typeof THEMES)[number];

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("archirift:theme") as Theme | null;
      if (stored && THEMES.includes(stored)) setTheme(stored);
    } catch {}
  }, []);
  const next = () => {
    const value = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(value);
    try {
      window.localStorage.setItem("archirift:theme", value);
    } catch {}
    if (value === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", value);
  };
  const icon: IconName = theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor";
  return (
    <button type="button" onClick={next} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-quiet hover:bg-surface-2 hover:text-ink" aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
      <Icon name={icon} size={17} />
    </button>
  );
}

const DOCK = [...LINKS, { href: "/profile/", label: "Me", icon: "user" as IconName }];

/** Phones and tablets: a thumb-reach dock with labelled 56px targets and a marker that follows you. */
function Dock({ pathname, due }: { pathname: string; due: number }) {
  return (
    <nav aria-label="Main (mobile)" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-stretch gap-0.5 rounded-2xl border border-line-strong bg-surface px-1.5 py-1.5 shadow-card">
        {DOCK.map((l) => {
          const on = active(pathname, l.href);
          const count = l.href === "/review/" ? due : 0;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium transition-colors ${on ? "text-ink" : "text-ink-quiet active:text-ink"}`}
            >
              {on && <motion.span layoutId="dock-active" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden="true" />}
              {on && <motion.span layoutId="dock-marker" className="absolute top-0 h-0.5 w-6 rounded-full bg-flow" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden="true" />}
              <motion.span whileTap={{ scale: 0.88 }} className="relative flex flex-col items-center gap-0.5">
                <Icon name={l.icon} size={20} className={on ? "text-flow" : ""} />
                {l.label}
              </motion.span>
              {count > 0 && (
                <span className="absolute right-1.5 top-1 min-w-4 rounded-full bg-pink px-1 text-center font-mono text-[9px] font-bold leading-4 text-bg">
                  {count > 99 ? "99+" : count}
                  <span className="sr-only"> due</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
