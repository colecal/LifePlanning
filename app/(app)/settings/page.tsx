import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { FeedUrlBox } from "./FeedUrlBox";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your calendar feed and preferences.</p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Phone calendar feed
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Subscribe your phone to see all household events. Keep this URL private —
          anyone with it can read your calendar.
        </p>

        <FeedUrlBox webcalUrl={webcalUrl} httpsUrl={httpsUrl} />

        <div className="mt-6 space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">iPhone (Apple Calendar)</p>
            <ol className="ml-5 mt-1 list-decimal space-y-0.5">
              <li>Tap the <span className="font-mono">webcal://</span> link above on your phone.</li>
              <li>Confirm &quot;Subscribe&quot; → events appear in the Calendar app within a few minutes.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Google Calendar</p>
            <ol className="ml-5 mt-1 list-decimal space-y-0.5">
              <li>Go to calendar.google.com → settings (gear icon) → <em>Add calendar</em> → <em>From URL</em>.</li>
              <li>Paste the <span className="font-mono">https://</span> URL above and click <em>Add calendar</em>.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
