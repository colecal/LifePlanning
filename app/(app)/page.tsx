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

  const { data: nextEvents } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, all_day, location, owner_id")
    .eq("household_id", householdId)
    .gte("starts_at", startOfDay(now).toISOString())
    .order("starts_at", { ascending: true })
    .limit(3);

  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("id, title, due_at, assignee_id, status")
    .eq("household_id", householdId)
    .eq("status", "open")
    .lte("due_at", endOfDay.toISOString())
    .order("due_at", { ascending: true });

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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">
          {format(now, "EEEE")}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          {format(now, "MMMM d")}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Your daily snapshot for the household.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Coming up" href="/calendar" accent>
          {nextEvents && nextEvents.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {nextEvents.map((e) => {
                const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                const start = new Date(e.starts_at);
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: owner?.color ?? "var(--color-amber-500)",
                        boxShadow: `0 0 0 3px ${owner?.color ?? "var(--color-amber-500)"}22`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium text-ink-900">
                        {e.title}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {isToday(start) ? "Today" : format(start, "EEE MMM d")}
                        {e.all_day ? "" : ` · ${format(start, "h:mm a").toLowerCase()}`}
                        {e.location ? ` · ${e.location}` : ""}
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

        <Card title="Due today" href="/tasks">
          {todayTasks && todayTasks.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {todayTasks.map((t) => {
                const assignee = t.assignee_id ? memberMap.get(t.assignee_id) : null;
                const due = t.due_at ? new Date(t.due_at) : null;
                const overdue = due && due < now;
                return (
                  <li key={t.id} className="flex items-start gap-3">
                    <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-ink-200" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium text-ink-900">
                        {t.title}
                      </div>
                      <div className="mt-0.5 text-xs">
                        <span className={overdue ? "font-medium text-red-600" : "text-ink-400"}>
                          {due ? format(due, "h:mm a").toLowerCase() : "No time"}
                        </span>
                        {assignee ? (
                          <span className="text-ink-400">
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
            <Empty>All clear for today.</Empty>
          )}
        </Card>

        <Card
          title={groceryList?.name ?? "Grocery"}
          href={groceryList ? `/lists/${groceryList.id}` : "/lists"}
        >
          {groceryItems && groceryItems.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {groceryItems.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 text-[14px] text-ink-700"
                >
                  <span className="inline-block h-4 w-4 shrink-0 rounded-md border border-ink-200 bg-cream-50/40" />
                  <span className="flex-1 truncate">{it.content}</span>
                  {it.category ? (
                    <span className="shrink-0 rounded-full bg-amber-50/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700">
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

      <section className="card flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
            Household
          </h2>
          <p className="mt-2 text-sm text-ink-700">
            Shared by{" "}
            {members.map((m, i) => (
              <span key={m.id}>
                <span style={{ color: m.color }} className="font-medium">
                  {m.display_name}
                </span>
                {i < members.length - 1 ? " & " : ""}
              </span>
            ))}
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          {members.map((m) => (
            <div
              key={m.id}
              className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-ink-900 shadow-soft"
              style={{
                background: `linear-gradient(135deg, ${m.color}cc, ${m.color})`,
              }}
              title={m.display_name}
            >
              {m.display_name.charAt(0)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  href,
  children,
  accent = false,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card group relative flex flex-col overflow-hidden p-5">
      {accent ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(244,189,83,0.45), transparent 70%)",
          }}
        />
      ) : null}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
          {title}
        </h2>
        <Link
          href={href}
          className="text-xs text-ink-400 transition group-hover:text-amber-700"
        >
          See all →
        </Link>
      </div>
      <div className="min-h-[7rem]">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-300">{children}</p>;
}
