"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { RRule, rrulestr } from "rrule";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { CommentThread } from "@/app/components/CommentThread";
import { deleteEventAction, saveEventAction } from "./actions";

type DbEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  owner_id: string | null;
};

type Occurrence = DbEvent & {
  occurrence_start: Date;
  occurrence_end: Date;
};

function expandEvent(ev: DbEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const durationMs = end.getTime() - start.getTime();

  if (!ev.rrule) {
    if (end < rangeStart || start > rangeEnd) return [];
    return [{ ...ev, occurrence_start: start, occurrence_end: end }];
  }

  try {
    const rule = rrulestr(`DTSTART:${formatRruleDate(start)}\nRRULE:${ev.rrule}`);
    const dates = rule.between(rangeStart, rangeEnd, true);
    return dates.map((d) => ({
      ...ev,
      occurrence_start: d,
      occurrence_end: new Date(d.getTime() + durationMs),
    }));
  } catch {
    return [{ ...ev, occurrence_start: start, occurrence_end: end }];
  }
}

function formatRruleDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function CalendarView({
  initialEvents,
  members,
  householdId: _householdId,
  currentUserId,
}: {
  initialEvents: DbEvent[];
  members: Profile[];
  householdId: string;
  currentUserId: string;
}) {
  const [events, setEvents] = useState<DbEvent[]>(initialEvents);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [activeOwners, setActiveOwners] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );
  const [modal, setModal] = useState<
    | { mode: "create"; defaultDate: Date }
    | { mode: "edit"; event: DbEvent }
    | null
  >(null);

  // Realtime: subscribe to event changes for the current household
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          setEvents((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as DbEvent;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as DbEvent;
              return prev.map((p) => (p.id === row.id ? row : p));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const memberMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of members) m.set(p.id, p);
    return m;
  }, [members]);

  const filteredEvents = useMemo(
    () => events.filter((e) => !e.owner_id || activeOwners.has(e.owner_id)),
    [events, activeOwners],
  );

  // Visible window expansion
  const rangeStart = view === "month" ? startOfWeek(startOfMonth(cursor)) : startOfDay(cursor);
  const rangeEnd = view === "month" ? endOfWeek(endOfMonth(cursor)) : addDays(rangeStart, 30);

  const occurrences = useMemo(() => {
    const out: Occurrence[] = [];
    for (const ev of filteredEvents) {
      out.push(...expandEvent(ev, rangeStart, rangeEnd));
    }
    out.sort((a, b) => a.occurrence_start.getTime() - b.occurrence_start.getTime());
    return out;
  }, [filteredEvents, rangeStart, rangeEnd]);

  function toggleOwner(id: string) {
    setActiveOwners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ←
          </button>
          <h1 className="min-w-[12ch] text-center text-xl font-semibold">
            {format(cursor, "MMMM yyyy")}
          </h1>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            →
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="ml-2 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {members.map((m) => {
              const on = activeOwners.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleOwner(m.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    on
                      ? "border-zinc-300 dark:border-zinc-700"
                      : "border-transparent opacity-40"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.display_name}
                </button>
              );
            })}
          </div>

          <div className="flex overflow-hidden rounded-md border border-zinc-300 text-sm dark:border-zinc-700">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 ${view === "month" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
            >
              Month
            </button>
            <button
              onClick={() => setView("agenda")}
              className={`px-3 py-1 ${view === "agenda" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
            >
              Agenda
            </button>
          </div>

          <button
            onClick={() => setModal({ mode: "create", defaultDate: new Date() })}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New event
          </button>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          cursor={cursor}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          occurrences={occurrences}
          memberMap={memberMap}
          onDayClick={(d) => setModal({ mode: "create", defaultDate: d })}
          onEventClick={(ev) => setModal({ mode: "edit", event: ev })}
        />
      ) : (
        <AgendaList
          occurrences={occurrences}
          memberMap={memberMap}
          onEventClick={(ev) => setModal({ mode: "edit", event: ev })}
        />
      )}

      {modal ? (
        <EventModal
          mode={modal.mode}
          event={modal.mode === "edit" ? modal.event : null}
          defaultDate={modal.mode === "create" ? modal.defaultDate : null}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function MonthGrid({
  cursor,
  rangeStart,
  rangeEnd,
  occurrences,
  memberMap,
  onDayClick,
  onEventClick,
}: {
  cursor: Date;
  rangeStart: Date;
  rangeEnd: Date;
  occurrences: Occurrence[];
  memberMap: Map<string, Profile>;
  onDayClick: (d: Date) => void;
  onEventClick: (e: Occurrence) => void;
}) {
  const days: Date[] = [];
  let d = rangeStart;
  while (d <= rangeEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const today = startOfDay(new Date());

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-b-md border-l border-r border-b border-zinc-200 dark:border-zinc-800">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const dayEvents = occurrences.filter((o) =>
            isWithinInterval(day, {
              start: startOfDay(o.occurrence_start),
              end: o.occurrence_end,
            }) || isSameDay(day, o.occurrence_start),
          );

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`group min-h-[6rem] cursor-pointer border-b border-r border-zinc-200 p-1.5 text-xs last:border-r-0 dark:border-zinc-800 ${
                inMonth ? "bg-white dark:bg-zinc-950" : "bg-zinc-50 dark:bg-zinc-900"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday
                      ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900"
                      : inMonth
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e, idx) => {
                  const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                  return (
                    <li
                      key={`${e.id}-${idx}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className="truncate rounded px-1 py-0.5 text-white"
                      style={{ backgroundColor: owner?.color ?? "#6b7280" }}
                      title={e.title}
                    >
                      {!e.all_day ? format(e.occurrence_start, "h:mm a ") : ""}
                      {e.title}
                    </li>
                  );
                })}
                {dayEvents.length > 3 ? (
                  <li className="text-[10px] text-zinc-500">
                    +{dayEvents.length - 3} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  occurrences,
  memberMap,
  onEventClick,
}: {
  occurrences: Occurrence[];
  memberMap: Map<string, Profile>;
  onEventClick: (e: Occurrence) => void;
}) {
  const groups = useMemo(() => {
    const g = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const key = format(o.occurrence_start, "yyyy-MM-dd");
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(o);
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences]);

  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Nothing on the calendar in this range.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {format(new Date(date), "EEEE, MMM d")}
          </div>
          <ul className="flex flex-col gap-1.5">
            {items.map((e, idx) => {
              const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
              return (
                <li
                  key={`${e.id}-${idx}`}
                  onClick={() => onEventClick(e)}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 bg-white p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: owner?.color ?? "#6b7280" }}
                  />
                  <span className="w-24 shrink-0 text-zinc-500">
                    {e.all_day
                      ? "All day"
                      : format(e.occurrence_start, "h:mm a")}
                  </span>
                  <span className="flex-1 truncate font-medium">{e.title}</span>
                  {e.location ? (
                    <span className="hidden truncate text-xs text-zinc-500 sm:block">
                      {e.location}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const RRULE_OPTIONS = [
  { value: "", label: "Does not repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Weekdays" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

function EventModal({
  mode,
  event,
  defaultDate,
  members,
  currentUserId,
  onClose,
}: {
  mode: "create" | "edit";
  event: DbEvent | null;
  defaultDate: Date | null;
  members: Profile[];
  currentUserId: string;
  onClose: () => void;
}) {
  const initialStart = event
    ? new Date(event.starts_at)
    : defaultDate
      ? roundToNextHour(defaultDate)
      : roundToNextHour(new Date());
  const initialEnd = event
    ? new Date(event.ends_at)
    : new Date(initialStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startsAt, setStartsAt] = useState(toLocalInput(initialStart, event?.all_day ?? false));
  const [endsAt, setEndsAt] = useState(toLocalInput(initialEnd, event?.all_day ?? false));
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [ownerId, setOwnerId] = useState<string>(event?.owner_id ?? members[0]?.id ?? "");
  const [rrule, setRrule] = useState(event?.rrule ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const startDate = fromLocalInput(startsAt, allDay);
        const endDate = fromLocalInput(endsAt, allDay);
        await saveEventAction({
          id: event?.id,
          title,
          description,
          location,
          starts_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
          all_day: allDay,
          rrule: rrule || null,
          owner_id: ownerId || null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function remove() {
    if (!event) return;
    if (!confirm("Delete this event?")) return;
    startTransition(async () => {
      try {
        await deleteEventAction(event.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="mb-4 text-lg font-semibold">
          {mode === "create" ? "New event" : "Edit event"}
        </h2>

        <div className="flex flex-col gap-3 text-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            autoFocus
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />

          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                const next = e.target.checked;
                setAllDay(next);
                setStartsAt(toLocalInput(fromLocalInput(startsAt, allDay), next));
                setEndsAt(toLocalInput(fromLocalInput(endsAt, allDay), next));
              }}
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span>Start</span>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>End</span>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>

          <input
            value={location ?? ""}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />

          <textarea
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes"
            rows={2}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span>Owner</span>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Repeats</span>
              <select
                value={rrule}
                onChange={(e) => setRrule(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {RRULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {mode === "edit" && event ? (
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <CommentThread
                entityType="event"
                entityId={event.id}
                members={members}
                currentUserId={currentUserId}
              />
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            <div>
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function roundToNextHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setHours(x.getHours() + 1);
  return x;
}

// Convert a Date into the value expected by <input type="date|datetime-local">,
// in local time, since those inputs work in the browser's timezone.
function toLocalInput(d: Date, allDay: boolean): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (allDay) return `${y}-${m}-${day}`;
  return `${y}-${m}-${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string, allDay: boolean): Date {
  // date input returns "YYYY-MM-DD"; datetime-local returns "YYYY-MM-DDTHH:MM"
  if (allDay) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(value);
}
