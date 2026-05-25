"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; icon: React.ReactNode };

const ICON_CLASS = "h-5 w-5";

const PRIMARY: Item[] = [
  {
    href: "/",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="7" r="2.2" />
        <circle cx="6" cy="17" r="2.2" />
        <path d="M11 7h10M11 17h10" />
      </svg>
    ),
  },
  {
    href: "/lists",
    label: "Lists",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h2M4 12h2M4 18h2M9 6h12M9 12h12M9 18h12" />
      </svg>
    ),
  },
];

const SECONDARY: Item[] = [
  {
    href: "/notes",
    label: "Notes",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h12l4 4v12a0 0 0 0 1 0 0H4a0 0 0 0 1 0 0V4z" />
        <path d="M16 4v4h4" />
      </svg>
    ),
  },
  {
    href: "/trips",
    label: "Trips",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 14l-9 4-9-4 9-4 9 4z" />
        <path d="M12 18v3" />
        <path d="M5 15v3l7 3 7-3v-3" />
      </svg>
    ),
  },
  {
    href: "/pets",
    label: "Pets",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="currentColor">
        <ellipse cx="6" cy="9" rx="1.6" ry="2.1" />
        <ellipse cx="10" cy="6" rx="1.6" ry="2.1" />
        <ellipse cx="14" cy="6" rx="1.6" ry="2.1" />
        <ellipse cx="18" cy="9" rx="1.6" ry="2.1" />
        <path d="M12 11c-3 0-5 2.5-5 5 0 2 1.5 3 3 3 .8 0 1.3-.3 2-.3s1.2.3 2 .3c1.5 0 3-1 3-3 0-2.5-2-5-5-5z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

const ALL = [...PRIMARY, ...SECONDARY];

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export function AppNav({
  profile,
  signOutAction,
}: {
  profile: { display_name: string; color: string };
  signOutAction: () => Promise<void>;
}) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Signal "More sheet is open" to other UI (QuickCapture FAB hides via CSS)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("nav-more-open", moreOpen);
    return () => document.body.classList.remove("nav-more-open");
  }, [moreOpen]);

  // Close the sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  const anySecondaryActive = SECONDARY.some((n) => isActive(path, n.href));

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-strong pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink-900"
          >
            <span
              aria-hidden
              className="bg-amber-gradient inline-block h-6 w-6 rounded-lg shadow-soft"
            />
            <span className="hidden sm:inline">mi vida loca</span>
          </Link>

          {/* Desktop horizontal nav */}
          <nav className="hidden gap-0.5 text-sm sm:flex">
            {ALL.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-full px-3 py-1.5 transition ${
                    active
                      ? "bg-amber-gradient text-ink-900 shadow-soft"
                      : "text-ink-500 hover:bg-cream-100/70 hover:text-ink-900"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-cream-50/60 px-2.5 py-1 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: profile.color,
                  boxShadow: `0 0 0 2px ${profile.color}33`,
                }}
              />
              <span className="hidden text-ink-700 sm:inline">{profile.display_name}</span>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                aria-label="Sign out"
              >
                <span className="hidden sm:inline">Sign out</span>
                <svg viewBox="0 0 16 16" className="h-4 w-4 sm:hidden" aria-hidden>
                  <path
                    d="M6 3.5h-2.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1H6M10 11l3-3-3-3M13 8H6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="glass-strong fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-700/8 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 sm:hidden"
        aria-label="Primary"
      >
        {PRIMARY.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition ${
                active ? "text-amber-700" : "text-ink-400"
              }`}
            >
              <span className={active ? "text-amber-600" : "text-ink-400"}>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition ${
            anySecondaryActive ? "text-amber-700" : "text-ink-400"
          }`}
        >
          <span className={anySecondaryActive ? "text-amber-600" : "text-ink-400"}>
            <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="currentColor" aria-hidden>
              <circle cx="6" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="18" cy="12" r="1.6" />
            </svg>
          </span>
          <span>More</span>
        </button>
      </nav>

      {/* "More" sheet (mobile only) */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shadow-deep animate-scale-in w-full rounded-t-3xl p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <p className="px-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              More
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map((n) => {
                const active = isActive(path, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border border-ink-700/8 bg-cream-50/40 p-4 text-sm font-medium transition ${
                      active ? "text-amber-700" : "text-ink-800"
                    }`}
                  >
                    <span className={active ? "text-amber-600" : "text-ink-400"}>{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
