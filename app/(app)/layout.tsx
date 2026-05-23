import Link from "next/link";
import { signOutAction } from "../login/actions";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/lists", label: "Lists" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, color")
    .eq("id", user!.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 glass-strong">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink-900"
          >
            <span
              aria-hidden
              className="bg-amber-gradient inline-block h-6 w-6 rounded-lg shadow-soft"
            />
            <span>mi vida loca</span>
          </Link>

          <nav className="hidden gap-0.5 text-sm sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-3.5 py-1.5 text-ink-500 transition hover:bg-cream-100/70 hover:text-ink-900"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-cream-50/60 px-3 py-1 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shadow-inner"
                style={{
                  backgroundColor: profile?.color ?? "var(--color-amber-500)",
                  boxShadow: `0 0 0 2px ${profile?.color ?? "var(--color-amber-500)"}33`,
                }}
              />
              <span className="hidden text-ink-700 sm:inline">{profile?.display_name}</span>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="btn-ghost">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="flex gap-0.5 overflow-x-auto px-4 pb-3 text-sm sm:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-full px-3 py-1 text-ink-500 hover:bg-cream-100/70 hover:text-ink-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
