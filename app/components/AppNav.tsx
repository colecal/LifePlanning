"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",         label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/lists",    label: "Lists" },
  { href: "/tasks",    label: "Tasks" },
  { href: "/notes",    label: "Notes" },
  { href: "/settings", label: "Settings" },
];

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

  return (
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
          <span className="hidden xs:inline sm:inline">mi vida loca</span>
          <span className="xs:hidden sm:hidden">mvl</span>
        </Link>

        <nav className="hidden gap-0.5 text-sm sm:flex">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 transition ${
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

      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 text-sm sm:hidden">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${
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
    </header>
  );
}
