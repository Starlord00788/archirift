"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { rankFor } from "@/game/ranks";
import { currentStreak } from "@/persistence/progress";
import { useLearning } from "@/persistence/useLearning";
import { useAuth } from "@/sync/AuthProvider";
import { Logo } from "./Logo";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Map", icon: "map" },
  { href: "/review/", label: "Review", icon: "brain" },
  { href: "/codex/", label: "Codex", icon: "book" },
  { href: "/arena/", label: "Arena", icon: "swords" },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/levels");
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function NavBar() {
  const pathname = usePathname() ?? "/";
  const { progress, due } = useLearning();
  const { status, account, sync } = useAuth();
  const xp = progress?.xp ?? 0;
  const { rank, progress: toNext } = rankFor(xp);
  const streak = progress ? currentStreak(progress.activeDays, new Date().toISOString().slice(0, 10)) : 0;

  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-lg pr-2" aria-label="Archirift home">
            <Logo />
            <span className="font-display text-lg font-bold tracking-tight">Archirift</span>
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const on = active(pathname, l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${on ? "text-ink" : "text-ink-quiet hover:text-ink"}`}>
                  {on && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative flex items-center gap-2">
                    <Icon name={l.icon} size={16} />
                    {l.label}
                    {l.href === "/review/" && due.length > 0 && (
                      <span className="rounded-full bg-pink px-1.5 font-mono text-[10px] font-bold leading-4 text-bg" aria-label={`${due.length} due`}>
                        {due.length}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/profile/" className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-warn hover:bg-surface-2 sm:flex" title={`${streak}-day streak`}>
              <Icon name="flame" size={16} filled={streak > 0} />
              <span className="font-mono text-xs font-bold">{streak}</span>
              <span className="sr-only">day streak</span>
            </Link>
            <Link href="/profile/" className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 hover:border-flow" title={`${rank.name}: ${xp} XP`}>
              <Icon name="bolt" size={15} className="text-flow" filled />
              <span className="flex flex-col leading-none">
                <span className="font-mono text-xs font-bold">{xp.toLocaleString("en-IN")} XP</span>
                <span className="mt-1 hidden h-1 w-16 overflow-hidden rounded-full bg-line sm:block" aria-hidden="true">
                  <span className="block h-full rounded-full bg-gradient-to-r from-flow to-player" style={{ width: `${Math.round(toNext * 100)}%` }} />
                </span>
              </span>
              <span className="hidden text-xs text-ink-quiet lg:inline">{rank.name}</span>
            </Link>
            <AccountButton status={status} name={account?.name ?? null} photo={account?.photoURL ?? null} syncState={sync.state} />
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav aria-label="Main (mobile)" className="glass fixed inset-x-0 bottom-0 z-40 flex border-t border-line/70 pb-[env(safe-area-inset-bottom)] md:hidden">
        {[...LINKS, { href: "/profile/", label: "Me", icon: "user" as IconName }].map((l) => {
          const on = active(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-flow" : "text-ink-quiet"}`}>
              <Icon name={l.icon} size={20} />
              {l.label}
              {l.href === "/review/" && due.length > 0 && <span className="absolute right-[calc(50%-18px)] top-1 h-2 w-2 rounded-full bg-pink" aria-label={`${due.length} due`} />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function AccountButton({ status, name, photo, syncState }: { status: string; name: string | null; photo: string | null; syncState: string }) {
  if (status === "signed-in" && name) {
    return (
      <Link href="/account/" className="relative flex items-center rounded-full ring-2 ring-transparent hover:ring-flow" title={`${name} · ${syncState === "synced" ? "progress synced" : syncState}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-flow to-player font-display text-sm font-bold text-bg">{name[0]?.toUpperCase()}</span>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg ${syncState === "synced" ? "bg-good" : syncState === "syncing" ? "bg-flow" : syncState === "idle" ? "bg-line-strong" : "bg-warn"}`} aria-hidden="true" />
        <span className="sr-only">Your account ({syncState})</span>
      </Link>
    );
  }
  if (status === "unconfigured") return null;
  return (
    <Link href="/account/" className="rounded-xl bg-gradient-to-r from-flow to-player px-3 py-1.5 text-sm font-semibold text-bg shadow-glow hover:brightness-110">
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
    <button type="button" onClick={next} className="rounded-lg p-2 text-ink-quiet hover:bg-surface-2 hover:text-ink" aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
      <Icon name={icon} size={17} />
    </button>
  );
}
