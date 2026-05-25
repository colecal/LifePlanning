"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { SwipeableRow } from "@/app/components/SwipeableRow";
import {
  addPackingItemAction,
  deletePackingItemAction,
  deleteTripAction,
  updatePackingItemAction,
  updateTripAction,
} from "../actions";

type Trip = {
  id: string;
  name: string;
  destination: string | null;
  starts_on: string;
  ends_on: string;
  notes: string | null;
  color: string;
};

type Packing = {
  id: string;
  content: string;
  category: string | null;
  checked: boolean;
  assignee_id: string | null;
  created_at: string;
};

type EventLite = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  owner_id: string | null;
};

export function TripDetailView({
  trip,
  initialPacking,
  events,
  members,
  currentUserId: _currentUserId,
}: {
  trip: Trip;
  initialPacking: Packing[];
  events: EventLite[];
  members: Profile[];
  currentUserId: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [packing, setPacking] = useState<Packing[]>(initialPacking);
  const [newItem, setNewItem] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [notes, setNotes] = useState(trip.notes ?? "");
  const [notesStatus, setNotesStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastNotesRef = useRef(trip.notes ?? "");
  const [_pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trip-packing-${trip.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_packing", filter: `trip_id=eq.${trip.id}` },
        (payload) => {
          setPacking((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Packing;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Packing;
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
  }, [trip.id]);

  // Autosave notes
  useEffect(() => {
    if (notes === lastNotesRef.current) return;
    setNotesStatus("saving");
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          await updateTripAction({ id: trip.id, notes });
          lastNotesRef.current = notes;
          setNotesStatus("saved");
          setTimeout(() => setNotesStatus("idle"), 1000);
        } catch {
          setNotesStatus("idle");
        }
      });
    }, 600);
    return () => clearTimeout(t);
  }, [notes, trip.id]);

  const memberMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of members) m.set(p.id, p);
    return m;
  }, [members]);

  const { active, packed } = useMemo(() => {
    return {
      active: packing.filter((p) => !p.checked),
      packed: packing.filter((p) => p.checked),
    };
  }, [packing]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const content = newItem.trim();
    setNewItem("");
    try {
      await addPackingItemAction({
        trip_id: trip.id,
        content,
        assignee_id: newAssignee || null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function togglePacked(p: Packing) {
    setPacking((prev) => prev.map((q) => (q.id === p.id ? { ...q, checked: !q.checked } : q)));
    startTransition(async () => {
      await updatePackingItemAction({ id: p.id, checked: !p.checked });
    });
  }

  function setAssignee(p: Packing, id: string | null) {
    setPacking((prev) => prev.map((q) => (q.id === p.id ? { ...q, assignee_id: id } : q)));
    startTransition(async () => {
      await updatePackingItemAction({ id: p.id, assignee_id: id });
    });
  }

  async function removeItem(p: Packing) {
    setPacking((prev) => prev.filter((q) => q.id !== p.id));
    try {
      await deletePackingItemAction(p.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeTrip() {
    const ok = await confirm({
      title: `Delete "${trip.name}"?`,
      message: "Packing list and notes will be removed. Linked calendar events stay.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) await deleteTripAction(trip.id);
  }

  const eventsByDate = useMemo(() => {
    const g = new Map<string, EventLite[]>();
    for (const e of events) {
      const key = format(new Date(e.starts_at), "yyyy-MM-dd");
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(e);
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="flex flex-col gap-6">
      <header className="card relative flex flex-col gap-2 overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60"
          style={{ background: `radial-gradient(closest-side, ${trip.color}55, transparent 70%)` }}
        />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
            {trip.destination || "Trip"}
          </p>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              {trip.name}
            </h1>
            <button
              type="button"
              onClick={removeTrip}
              className="text-xs font-medium text-ink-400 transition hover:text-red-600"
            >
              Delete
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {format(new Date(trip.starts_on), "EEE MMM d")} →{" "}
            {format(new Date(trip.ends_on), "EEE MMM d, yyyy")}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Itinerary
          </h2>
          {eventsByDate.length === 0 ? (
            <p className="py-4 text-sm text-ink-400">
              No events scheduled in this window. Add events on the calendar
              within {format(new Date(trip.starts_on), "MMM d")} –{" "}
              {format(new Date(trip.ends_on), "MMM d")} and they'll show up here.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {eventsByDate.map(([date, items]) => (
                <div key={date}>
                  <p className="mb-1 text-xs font-medium text-ink-700">
                    {format(new Date(date.replace(/-/g, "/")), "EEEE, MMM d")}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((e) => {
                      const owner = e.owner_id ? memberMap.get(e.owner_id) : null;
                      return (
                        <li
                          key={e.id}
                          className="flex items-start gap-3 rounded-lg border border-ink-700/8 bg-cream-50/40 px-3 py-2 text-sm"
                        >
                          <span
                            className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: owner?.color ?? "var(--color-amber-500)" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink-900">{e.title}</p>
                            <p className="text-xs text-ink-400">
                              {e.all_day
                                ? "All day"
                                : format(new Date(e.starts_at), "h:mm a").toLowerCase()}
                              {e.location ? ` · ${e.location}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Packing list
          </h2>
          <form onSubmit={addItem} className="flex flex-col gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add an item…"
              className="input-field"
            />
            <div className="flex gap-2">
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="input-field min-w-0 flex-1"
                aria-label="Assignee"
              >
                <option value="">Either of us</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
              <button type="submit" disabled={!newItem.trim()} className="btn-primary">
                Add
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-1.5">
            {active.map((p) => {
              const assignee = p.assignee_id ? memberMap.get(p.assignee_id) : null;
              return (
                <SwipeableRow key={p.id} onDelete={() => removeItem(p)}>
                  <div className="group flex items-center gap-3 rounded-lg border border-ink-700/8 bg-cream-50/40 px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => togglePacked(p)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink-200 bg-cream-50/40 hover:border-amber-400"
                      aria-label="Mark packed"
                    />
                    <span className="min-w-0 flex-1 truncate">{p.content}</span>
                    <select
                      value={p.assignee_id ?? ""}
                      onChange={(e) => setAssignee(p, e.target.value || null)}
                      className="h-7 rounded-md border border-ink-200 bg-cream-50/60 px-1.5 text-xs font-medium"
                      style={assignee ? { color: assignee.color } : { color: "var(--color-ink-400)" }}
                    >
                      <option value="">Either</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id} style={{ color: m.color }}>{m.display_name}</option>
                      ))}
                    </select>
                  </div>
                </SwipeableRow>
              );
            })}
            {active.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-400">All packed!</p>
            ) : null}
          </div>

          {packed.length > 0 ? (
            <>
              <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Packed · {packed.length}
              </h3>
              <div className="flex flex-col gap-1.5 opacity-70">
                {packed.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-ink-700/8 bg-cream-50/40 px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => togglePacked(p)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-amber-500 bg-amber-gradient"
                      aria-label="Unpack"
                    >
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-ink-900">
                        <path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </button>
                    <span className="flex-1 truncate text-ink-300 line-through">{p.content}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Notes
          </h2>
          <span className="text-[11px] text-ink-400">
            {notesStatus === "saving" && "Saving…"}
            {notesStatus === "saved" && "Saved"}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reservations, links, ideas…"
          rows={8}
          className="min-h-[12rem] resize-y rounded-xl border border-ink-700/8 bg-cream-50/40 p-3 text-sm leading-relaxed text-ink-800 outline-none transition placeholder:text-ink-300 focus:border-amber-400"
        />
      </section>
    </div>
  );
}
