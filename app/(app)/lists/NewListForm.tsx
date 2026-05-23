"use client";

import { useState, useTransition } from "react";
import { createListAction } from "./actions";

export function NewListForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("todo");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded-lg border border-dashed border-ink-200 px-3 py-2 text-xs font-medium text-ink-400 transition hover:border-amber-400 hover:bg-amber-50/40 hover:text-amber-700"
      >
        + New list
      </button>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => createListAction(fd))}
      className="flex flex-col gap-2 rounded-xl border border-ink-700/8 bg-cream-50/60 p-2 backdrop-blur"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name"
        autoFocus
        className="input-field"
      />
      <select
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        className="input-field"
      >
        <option value="todo">To-do</option>
        <option value="grocery">Grocery</option>
        <option value="custom">Custom</option>
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="btn-primary flex-1"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
