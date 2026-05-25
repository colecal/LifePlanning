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

    // Other household members (for partner attribution)
    const { data: partners } = await admin
      .from("household_members")
      .select("profiles(id, display_name)")
      .eq("household_id", householdId);
    const memberNames = new Map<string, string>();
    for (const m of partners ?? []) {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (p) memberNames.set(p.id, p.display_name);
    }

    const { data: events } = await admin
      .from("events")
      .select("title, starts_at, all_day, owner_id, location")
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

    // Open grocery items from the most recent grocery list
    const { data: groceryList } = await admin
      .from("lists")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("kind", "grocery")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: groceryItems } = groceryList
      ? await admin
          .from("list_items")
          .select("content")
          .eq("list_id", groceryList.id)
          .eq("checked", false)
      : { data: null };

    const myTasks = (tasks ?? []).filter((t) => t.assignee_id === profile.id);
    const partnerTasks = (tasks ?? []).filter(
      (t) => t.assignee_id && t.assignee_id !== profile.id,
    );
    const unassignedTasks = (tasks ?? []).filter((t) => t.assignee_id === null);

    const totalTasks = myTasks.length + partnerTasks.length + unassignedTasks.length;
    const groceryCount = groceryItems?.length ?? 0;

    // Skip silent days on automated runs
    if (
      (events?.length ?? 0) === 0 &&
      totalTasks === 0 &&
      groceryCount === 0 &&
      !onlyProfileId
    ) {
      continue;
    }

    const summary = buildSummary({
      events: events ?? [],
      myTasks,
      partnerTasks,
      unassignedTasks,
      groceryCount,
      memberNames,
    });
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

function buildSummary({
  events,
  myTasks,
  partnerTasks,
  unassignedTasks,
  groceryCount,
  memberNames,
}: {
  events: { title: string; starts_at: string; all_day: boolean; location: string | null }[];
  myTasks: { title: string; due_at: string | null }[];
  partnerTasks: { title: string; assignee_id: string | null; due_at: string | null }[];
  unassignedTasks: { title: string; due_at: string | null }[];
  groceryCount: number;
  memberNames: Map<string, string>;
}): string {
  const lines: string[] = [];

  // EVENTS — newline-separated, each with time + title + location
  if (events.length > 0) {
    const heading = events.length === 1 ? "📅 Today:" : `📅 ${events.length} events today:`;
    const list = events.slice(0, 4).map((e) => {
      const t = e.all_day
        ? "all day"
        : new Date(e.starts_at)
            .toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: TIMEZONE,
            })
            .toLowerCase();
      const loc = e.location ? ` @ ${e.location}` : "";
      return `  • ${t} — ${e.title}${loc}`;
    });
    if (events.length > 4) list.push(`  • +${events.length - 4} more`);
    lines.push(heading);
    lines.push(...list);
  }

  // YOUR TASKS
  if (myTasks.length > 0) {
    const heading =
      myTasks.length === 1 ? "✓ Your task:" : `✓ ${myTasks.length} tasks for you:`;
    const list = myTasks.slice(0, 4).map((t) => `  • ${t.title}${dueSuffix(t.due_at)}`);
    if (myTasks.length > 4) list.push(`  • +${myTasks.length - 4} more`);
    lines.push(heading);
    lines.push(...list);
  }

  // PARTNER TASKS — group by partner name
  if (partnerTasks.length > 0) {
    const byPartner = new Map<string, typeof partnerTasks>();
    for (const t of partnerTasks) {
      const name = memberNames.get(t.assignee_id!) ?? "Partner";
      const arr = byPartner.get(name) ?? [];
      arr.push(t);
      byPartner.set(name, arr);
    }
    for (const [name, list] of byPartner) {
      const heading = list.length === 1 ? `For ${name}:` : `${list.length} for ${name}:`;
      const items = list.slice(0, 3).map((t) => `  • ${t.title}${dueSuffix(t.due_at)}`);
      if (list.length > 3) items.push(`  • +${list.length - 3} more`);
      lines.push(heading);
      lines.push(...items);
    }
  }

  // UNASSIGNED
  if (unassignedTasks.length > 0) {
    const heading =
      unassignedTasks.length === 1
        ? "Unclaimed:"
        : `${unassignedTasks.length} unclaimed tasks:`;
    const list = unassignedTasks
      .slice(0, 3)
      .map((t) => `  • ${t.title}${dueSuffix(t.due_at)}`);
    if (unassignedTasks.length > 3)
      list.push(`  • +${unassignedTasks.length - 3} more`);
    lines.push(heading);
    lines.push(...list);
  }

  // GROCERY
  if (groceryCount > 0) {
    lines.push(`🛒 ${groceryCount} grocery item${groceryCount === 1 ? "" : "s"}`);
  }

  return lines.join("\n");
}

function dueSuffix(dueISO: string | null): string {
  if (!dueISO) return "";
  const d = new Date(dueISO);
  const today = new Date();
  if (d < today) return " (overdue)";
  const sameDay =
    d.toDateString() === today.toDateString();
  if (!sameDay) return "";
  const t = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
  return ` (${t.toLowerCase()})`;
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
