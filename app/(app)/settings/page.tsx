import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { FeedUrlBox } from "./FeedUrlBox";
import { ThemeToggle } from "./ThemeToggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: token } = await supabase
    .from("feed_tokens")
    .select("token")
    .eq("profile_id", user!.id)
    .single();

  const h = await headers();
  const host = h.get("host") ?? "mi-vida-loca.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const httpsUrl = `${proto}://${host}/api/feed/${token?.token ?? ""}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">
          Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Preferences
        </h1>
      </header>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-700/8 px-6 py-5">
          <h2 className="text-base font-semibold text-ink-900">Appearance</h2>
          <p className="mt-1 text-sm text-ink-500">
            Choose how mi vida loca looks. System follows your device.
          </p>
        </div>
        <div className="px-6 py-5">
          <ThemeToggle />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-700/8 px-6 py-5">
          <h2 className="text-base font-semibold text-ink-900">Phone calendar feed</h2>
          <p className="mt-1 text-sm text-ink-500">
            Subscribe your phone to see household events anywhere. Keep this URL
            private — anyone with it can read your calendar.
          </p>
        </div>

        <div className="px-6 py-5">
          <FeedUrlBox webcalUrl={webcalUrl} httpsUrl={httpsUrl} />

          <div className="mt-6 grid grid-cols-1 gap-5 text-sm text-ink-600 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-white">

                </span>
                <p className="font-semibold text-ink-900">Apple Calendar</p>
              </div>
              <ol className="ml-4 list-decimal space-y-1 text-[13px]">
                <li>Tap the <span className="font-mono text-amber-700">webcal://</span> link above on your phone.</li>
                <li>Confirm <em>Subscribe</em> — events appear in Calendar.</li>
              </ol>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-gradient text-ink-900 font-bold">
                  G
                </span>
                <p className="font-semibold text-ink-900">Google Calendar</p>
              </div>
              <ol className="ml-4 list-decimal space-y-1 text-[13px]">
                <li>calendar.google.com → settings → <em>Add calendar</em> → <em>From URL</em>.</li>
                <li>Paste the <span className="font-mono text-amber-700">https://</span> URL → <em>Add</em>.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
