import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfiles } from "@/lib/push";

const TIMEZONE = "America/Chicago";

export async function runDigest({
  onlyProfileId,
}: {
  onlyProfileId?: string | null;
} = {}): Promise<number> {
  const admin = createAdminClient();

  const { startISO, endISO, todayLabel } = todayWindow(TIMEZONE);

  let profileQuery = admin
    .from("profiles")
    .select("id, display_name, email_digest_enabled");
  if (onlyProfileId) profileQuery = profileQuery.eq("id", onlyProfileId);
  const { data: profiles } = await profileQuery;

  if (!profiles) return 0;

  const profileIds = profiles.map((p) => p.id);
  const { data: memberships } = await admin
    .from("household_members")
    .select("profile_id, household_id")
    .in("profile_id", profileIds);

  const householdByProfile = new Map(
    (memberships ?? []).map((m) => [m.profile_id, m.household_id]),
  );

  let sentCount = 0;

  for (const profile of profiles) {
    // Honor the preference unless this is a one-off "send to me" test
    if (!profile.email_digest_enabled && !onlyProfileId) continue;
    const householdId = householdByProfile.get(profile.id);
    if (!householdId) continue;

    const { data: events } = await admin
      .from("events")
      .select("title, starts_at, all_day, owner_id")
      .eq("household_id", householdId)
      .gte("starts_at", startISO)
      .lt("starts_at", endISO)
      .order("starts_at", { ascending: true })
      .limit(8);

    const { data: tasks } = await admin
      .from("tasks")
      .select("title, due_at, assignee_id")
      .eq("household_id", householdId)
      .eq("status", "open")
      .lte("due_at", endISO)
      .order("due_at", { ascending: true })
      .limit(8);

    const myTasks = (tasks ?? []).filter((t) => t.assignee_id === profile.id);
    const otherTasks = (tasks ?? []).filter((t) => t.assignee_id !== profile.id);

    // Skip silent days on automated runs
    if (
      (events?.length ?? 0) === 0 &&
      myTasks.length === 0 &&
      otherTasks.length === 0 &&
      !onlyProfileId
    ) {
      continue;
    }

    const summary = buildSummary(events ?? [], myTasks, otherTasks);
    const title = `${greeting()}, ${profile.display_name} ☕`;

    await sendPushToProfiles([profile.id], {
      title,
      body: summary || `Nothing on the books today (${todayLabel}).`,
      url: "/",
      tag: "digest",
    });
    sentCount++;
  }

  return sentCount;
}

function greeting(): string {
  const h = new Date().getUTCHours();
  if (h < 11) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function buildSummary(
  events: { title: string; starts_at: string; all_day: boolean }[],
  myTasks: { title: string }[],
  otherTasks: { title: string }[],
): string {
  const parts: string[] = [];

  if (events.length > 0) {
    const preview = events
      .slice(0, 2)
      .map((e) => {
        if (e.all_day) return e.title;
        const t = new Date(e.starts_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: TIMEZONE,
        });
        return `${t} ${e.title}`;
      })
      .join(" · ");
    parts.push(
      events.length === 1
        ? preview
        : `${events.length} events: ${preview}${events.length > 2 ? "…" : ""}`,
    );
  }

  if (myTasks.length > 0) {
    parts.push(
      `${myTasks.length} ${myTasks.length === 1 ? "task" : "tasks"} for you${
        myTasks[0] ? `: ${myTasks[0].title}` : ""
      }${myTasks.length > 1 ? "…" : ""}`,
    );
  }

  if (otherTasks.length > 0) {
    parts.push(
      `${otherTasks.length} other open task${otherTasks.length === 1 ? "" : "s"}`,
    );
  }

  return parts.join(" · ");
}

function todayWindow(tz: string): { startISO: string; endISO: string; todayLabel: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;

  const offsetMinutes = tzOffsetMinutes(tz, now);
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const absOff = Math.abs(offsetMinutes);
  const offHH = String(Math.floor(absOff / 60)).padStart(2, "0");
  const offMM = String(absOff % 60).padStart(2, "0");
  const startLocal = `${y}-${m}-${d}T00:00:00${sign}${offHH}:${offMM}`;
  const start = new Date(startLocal);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    todayLabel: `${y}-${m}-${d}`,
  };
}

function tzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((at.getTime() - asUTC) / 60000);
}
