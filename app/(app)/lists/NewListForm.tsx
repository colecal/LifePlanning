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
        className="rounded-md border border-dashed border-zinc-300 px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        + New list
      </button>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => createListAction(fd))}
      className="flex flex-col gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name"
        autoFocus
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="todo">To-do</option>
        <option value="grocery">Grocery</option>
        <option value="custom">Custom</option>
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="flex-1 rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
