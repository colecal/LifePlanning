"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/app/components/Toast";
import { createTripAction } from "./actions";

export function NewTripButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [color, setColor] = useState("#E08A14");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !starts || !ends) return;
    if (new Date(ends) < new Date(starts)) {
      toast.error("End date must be after start date.");
      return;
    }
    startTransition(async () => {
      try {
        await createTripAction({
          name,
          destination,
          starts_on: starts,
          ends_on: ends,
          color,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + New
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shadow-deep animate-scale-in flex w-full max-w-sm flex-col gap-4 rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6"
          >
            <h2 className="text-lg font-semibold text-ink-900">Plan a trip</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trip name (e.g. Honeymoon)"
              autoFocus
              required
              className="input-field"
            />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Destination"
              className="input-field"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Start</span>
                <input
                  type="date"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                  required
                  className="input-field"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">End</span>
                <input
                  type="date"
                  value={ends}
                  onChange={(e) => setEnds(e.target.value)}
                  required
                  className="input-field"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Accent
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border border-ink-700/10 bg-transparent"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={pending || !name.trim()} className="btn-primary">
                {pending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
