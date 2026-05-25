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
import { rrulestr } from "rrule";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { CommentThread } from "@/app/components/CommentThread";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
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
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 sm:text-sm">
              Calendar
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              {format(cursor, "MMMM yyyy")}
            </h1>
          </div>

          <button
            onClick={() => setModal({ mode: "create", defaultDate: new Date() })}
            className="btn-primary sm:hidden"
            aria-label="New event"
          >
            + New
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
          <div className="card flex items-center gap-1 p-1">
            <button
              onClick={() => setCursor(addMonths(cursor, -1))}
              className="grid h-9 w-9 place-items-center rounded-lg text-lg text-ink-500 transition hover:bg-cream-100/70 hover:text-ink-900 sm:h-8 sm:w-8 sm:text-base"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-cream-100/70 hover:text-ink-900"
            >
              Today
            </button>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg text-lg text-ink-500 transition hover:bg-cream-100/70 hover:text-ink-900 sm:h-8 sm:w-8 sm:text-base"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="card flex p-1 text-sm">
            <button
              onClick={() => setView("month")}
              className={`rounded-lg px-3 py-1.5 transition sm:py-1 ${
                view === "month"
                  ? "bg-amber-gradient text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView("agenda")}
              className={`rounded-lg px-3 py-1.5 transition sm:py-1 ${
                view === "agenda"
                  ? "bg-amber-gradient text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              Agenda
            </button>
          </div>

          <button
            onClick={() => setModal({ mode: "create", defaultDate: new Date() })}
            className="btn-primary hidden sm:inline-flex"
          >
            + New event
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {members.map((m) => {
          const on = activeOwners.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggleOwner(m.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition sm:py-1 ${
                on
                  ? "border-ink-200 bg-cream-50/70 text-ink-800 backdrop-blur"
                  : "border-transparent text-ink-300 opacity-50 hover:opacity-100"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: m.color,
                  boxShadow: on ? `0 0 0 2px ${m.color}33` : "none",
                }}
              />
              {m.display_name}
            </button>
          );
        })}
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
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-ink-700/8 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-3">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const dayEvents = occurrences.filter(
            (o) =>
              isWithinInterval(day, {
                start: startOfDay(o.occurrence_start),
                end: o.occurrence_end,
              }) || isSameDay(day, o.occurrence_start),
          );
          const isLastCol = (i + 1) % 7 === 0;
          const isLastRow = i >= days.length - 7;

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`group min-h-[4rem] cursor-pointer p-1 text-xs transition sm:min-h-[6.5rem] sm:p-2 ${
                isLastCol ? "" : "border-r"
              } ${isLastRow ? "" : "border-b"} border-ink-700/6 ${
                inMonth ? "" : "bg-cream-100/30"
              } hover:bg-amber-50/40`}
            >
              <div className="mb-1 flex items-center justify-center sm:justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium transition ${
                    isToday
                      ? "bg-amber-gradient text-ink-900 shadow-soft"
                      : inMonth
                        ? "text-ink-700"
                        : "text-ink-300"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Mobile: dots indicating events */}
              <div className="flex flex-wrap items-center justify-center gap-0.5 sm:hidden">
                {dayEvents.slice(0, 4).map((e, idx) => {
                  const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                  const color = owner?.color ?? "#9A5B0C";
                  return (
                    <span
                      key={`${e.id}-${idx}`}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                      title={e.title}
                    />
                  );
                })}
                {dayEvents.length > 4 ? (
                  <span className="text-[8px] text-ink-400">+{dayEvents.length - 4}</span>
                ) : null}
              </div>

              {/* Desktop: full event chips */}
              <ul className="hidden flex-col gap-0.5 sm:flex">
                {dayEvents.slice(0, 3).map((e, idx) => {
                  const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                  const color = owner?.color ?? "#9A5B0C";
                  return (
                    <li
                      key={`${e.id}-${idx}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className="truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-900 backdrop-blur transition hover:brightness-95"
                      style={{
                        background: `linear-gradient(135deg, ${color}33, ${color}55)`,
                        borderLeft: `2px solid ${color}`,
                      }}
                      title={e.title}
                    >
                      {!e.all_day ? format(e.occurrence_start, "h:mma ").toLowerCase() : ""}
                      {e.title}
                    </li>
                  );
                })}
                {dayEvents.length > 3 ? (
                  <li className="text-[10px] text-ink-400">
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
      <div className="card grid place-items-center p-16 text-center">
        <p className="text-sm text-ink-400">Nothing on the calendar in this range.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="mb-2 flex items-baseline gap-3 px-1">
            <span className="text-2xl font-semibold text-ink-900">
              {format(parseLocalISODate(date), "d")}
            </span>
            <span className="text-sm font-medium text-ink-400">
              {format(parseLocalISODate(date), "EEEE, MMM yyyy")}
            </span>
          </div>
          <ul className="card flex flex-col divide-y divide-ink-700/8 overflow-hidden">
            {items.map((e, idx) => {
              const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
              return (
                <li
                  key={`${e.id}-${idx}`}
                  onClick={() => onEventClick(e)}
                  className="flex cursor-pointer items-center gap-4 px-5 py-3 transition hover:bg-amber-50/40"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: owner?.color ?? "var(--color-amber-500)",
                      boxShadow: `0 0 0 3px ${(owner?.color ?? "#E08A14")}22`,
                    }}
                  />
                  <span className="w-24 shrink-0 text-sm text-ink-400">
                    {e.all_day ? "All day" : format(e.occurrence_start, "h:mm a").toLowerCase()}
                  </span>
                  <span className="flex-1 truncate text-[15px] font-medium text-ink-900">
                    {e.title}
                  </span>
                  {e.location ? (
                    <span className="hidden truncate text-xs text-ink-400 sm:block">
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
  const confirmDialog = useConfirm();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const startDate = fromLocalInput(startsAt, allDay);
    const endDate = fromLocalInput(endsAt, allDay);
    if (endDate <= startDate) {
      setError("End time must be after start time.");
      return;
    }
    startTransition(async () => {
      try {
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
        toast.success(event ? "Event updated" : "Event added");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function remove() {
    if (!event) return;
    const ok = await confirmDialog({
      title: "Delete this event?",
      message: event.title,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteEventAction(event.id);
        toast.success("Event deleted");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong shadow-deep animate-scale-in flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-h-[88vh] sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        <h2 className="text-lg font-semibold text-ink-900">
          {mode === "create" ? "New event" : "Edit event"}
        </h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          autoFocus
          className="input-field text-base font-medium"
        />

        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => {
              const next = e.target.checked;
              setAllDay(next);
              setStartsAt(toLocalInput(fromLocalInput(startsAt, allDay), next));
              setEndsAt(toLocalInput(fromLocalInput(endsAt, allDay), next));
            }}
            className="h-4 w-4 accent-amber-500"
          />
          All day
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <input
              type={allDay ? "date" : "datetime-local"}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="End">
            <input
              type={allDay ? "date" : "datetime-local"}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input-field"
            />
          </Field>
        </div>

        <input
          value={location ?? ""}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="input-field"
        />

        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes"
          rows={2}
          className="input-field resize-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Owner">
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="input-field"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Repeats">
            <select
              value={rrule}
              onChange={(e) => setRrule(e.target.value)}
              className="input-field"
            >
              {RRULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50/80 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        {mode === "edit" && event ? (
          <div className="border-t border-ink-700/8 pt-4">
            <CommentThread
              entityType="event"
              entityId={event.id}
              members={members}
              currentUserId={currentUserId}
            />
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between">
          <div>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="text-sm font-medium text-red-600 transition hover:text-red-700"
              >
                Delete
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function roundToNextHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setHours(x.getHours() + 1);
  return x;
}

function toLocalInput(d: Date, allDay: boolean): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (allDay) return `${y}-${m}-${day}`;
  return `${y}-${m}-${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string, allDay: boolean): Date {
  if (allDay) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(value);
}

// Parse a "yyyy-MM-dd" string as local time. `new Date("2025-12-25")` would
// parse it as UTC midnight and shift to the previous day west of UTC.
function parseLocalISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
