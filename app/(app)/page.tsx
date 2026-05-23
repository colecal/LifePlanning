import Link from "next/link";
import { format, isToday, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";

export default async function HomePage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();
  const members = await getHouseholdMembers();
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Next 3 events from now
  const { data: nextEvents } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, all_day, location, owner_id")
    .eq("household_id", householdId)
    .gte("starts_at", startOfDay(now).toISOString())
    .order("starts_at", { ascending: true })
    .limit(3);

  // Tasks due today + overdue
  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("id, title, due_at, assignee_id, status")
    .eq("household_id", householdId)
    .eq("status", "open")
    .lte("due_at", endOfDay.toISOString())
    .order("due_at", { ascending: true });

  // Most-recently-touched grocery list, top 5 unchecked items
  const { data: groceryList } = await supabase
    .from("lists")
    .select("id, name")
    .eq("household_id", householdId)
    .eq("kind", "grocery")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: groceryItems } = groceryList
    ? await supabase
        .from("list_items")
        .select("id, content, category, checked, assignee_id")
        .eq("list_id", groceryList.id)
        .eq("checked", false)
        .order("created_at", { ascending: true })
        .limit(5)
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {format(now, "EEEE, MMMM d")}
        </h1>
        <p className="text-sm text-zinc-500">
          Your snapshot for the day.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Coming up" href="/calendar">
          {nextEvents && nextEvents.length > 0 ? (
            <ul className="flex flex-col gap-2 text-sm">
              {nextEvents.map((e) => {
                const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                const start = new Date(e.starts_at);
                return (
                  <li key={e.id} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: owner?.color ?? "#6b7280" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.title}</div>
                      <div className="text-xs text-zinc-500">
                        {isToday(start) ? "Today" : format(start, "EEE MMM d")}
                        {e.all_day ? "" : ` · ${format(start, "h:mma").toLowerCase()}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No upcoming events.</Empty>
          )}
        </Card>

        <Card title="Due today & overdue" href="/tasks">
          {todayTasks && todayTasks.length > 0 ? (
            <ul className="flex flex-col gap-2 text-sm">
              {todayTasks.map((t) => {
                const assignee = t.assignee_id ? memberMap.get(t.assignee_id) : null;
                const due = t.due_at ? new Date(t.due_at) : null;
                const overdue = due && due < now;
                return (
                  <li key={t.id} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs">
                        <span className={overdue ? "text-red-600" : "text-zinc-500"}>
                          {due ? format(due, "h:mma").toLowerCase() : "No due time"}
                        </span>
                        {assignee ? (
                          <span className="text-zinc-500">
                            {" · "}
                            <span style={{ color: assignee.color }}>
                              {assignee.display_name}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Nothing due today.</Empty>
          )}
        </Card>

        <Card
          title={groceryList?.name ?? "Grocery"}
          href={groceryList ? `/lists/${groceryList.id}` : "/lists"}
        >
          {groceryItems && groceryItems.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {groceryItems.map((it) => (
                <li key={it.id} className="flex items-center gap-2 truncate">
                  <span className="inline-block h-4 w-4 shrink-0 rounded border border-zinc-300 dark:border-zinc-700" />
                  <span className="truncate">{it.content}</span>
                  {it.category ? (
                    <span className="ml-auto shrink-0 text-[10px] uppercase text-zinc-500">
                      {it.category}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{groceryList ? "All caught up!" : "No grocery list yet."}</Empty>
          )}
        </Card>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Household
        </h2>
        <ul className="flex flex-wrap gap-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.display_name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
        <Link
          href={href}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          See all →
        </Link>
      </div>
      <div className="min-h-[6rem]">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400">{children}</p>;
}
