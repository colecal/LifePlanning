"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/app/components/Toast";
import { createPetAction } from "./actions";

export function NewPetButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("#E08A14");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createPetAction({ name, breed, color });
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
            <h2 className="text-lg font-semibold text-ink-900">Add a pet</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
              required
              className="input-field"
            />
            <input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Breed (optional)"
              className="input-field"
            />
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Color
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
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
