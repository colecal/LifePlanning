"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "./actions";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  assignee_id: string | null;
  status: string;
  created_at: string;
};

export function TasksView({
  initialTasks,
  members,
}: {
  initialTasks: Task[];
  members: Profile[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Task;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Task;
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

  const { open, done } = useMemo(() => {
    const o = tasks
      .filter((t) => t.status === "open")
      .sort((a, b) => {
        if (!a.due_at && !b.due_at) return a.created_at.localeCompare(b.created_at);
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return a.due_at.localeCompare(b.due_at);
      });
    const d = tasks
      .filter((t) => t.status === "done")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { open: o, done: d };
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      assignee_id: assignee || null,
    };
    setTitle("");
    setDue("");
    setAssignee("");
    try {
      await createTaskAction(payload);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function toggle(t: Task) {
    setTasks((prev) =>
      prev.map((p) =>
        p.id === t.id ? { ...p, status: p.status === "open" ? "done" : "open" } : p,
      ),
    );
    startTransition(async () => {
      await updateTaskAction({
        id: t.id,
        status: t.status === "open" ? "done" : "open",
      });
    });
  }

  function setAssigneeFor(t: Task, id: string | null) {
    setTasks((prev) => prev.map((p) => (p.id === t.id ? { ...p, assignee_id: id } : p)));
    startTransition(async () => {
      await updateTaskAction({ id: t.id, assignee_id: id });
    });
  }

  function remove(t: Task) {
    if (!confirm("Delete this task?")) return;
    setTasks((prev) => prev.filter((p) => p.id !== t.id));
    startTransition(async () => {
      await deleteTaskAction(t.id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-zinc-500">Things to handle, with due dates and owners.</p>
      </div>

      <form onSubmit={addTask} className="flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          Add
        </button>
      </form>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Open ({open.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {open.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              members={members}
              memberMap={memberMap}
              onToggle={() => toggle(t)}
              onAssignee={(id) => setAssigneeFor(t, id)}
              onDelete={() => remove(t)}
            />
          ))}
          {open.length === 0 ? (
            <li className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No open tasks.
            </li>
          ) : null}
        </ul>
      </section>

      {done.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Done ({done.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                members={members}
                memberMap={memberMap}
                onToggle={() => toggle(t)}
                onAssignee={(id) => setAssigneeFor(t, id)}
                onDelete={() => remove(t)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  members,
  memberMap,
  onToggle,
  onAssignee,
  onDelete,
}: {
  task: Task;
  members: Profile[];
  memberMap: Map<string, Profile>;
  onToggle: () => void;
  onAssignee: (id: string | null) => void;
  onDelete: () => void;
}) {
  const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : null;
  const isDone = task.status === "done";
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && !isDone && isPast(due);

  return (
    <li className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <input
        type="checkbox"
        checked={isDone}
        onChange={onToggle}
        className="h-4 w-4"
      />
      <span className={`flex-1 ${isDone ? "text-zinc-400 line-through" : ""}`}>
        {task.title}
      </span>
      {due ? (
        <span
          className={`text-xs ${
            overdue
              ? "font-medium text-red-600"
              : isDone
                ? "text-zinc-400"
                : "text-zinc-500"
          }`}
        >
          {formatDue(due)}
        </span>
      ) : null}
      <select
        value={task.assignee_id ?? ""}
        onChange={(e) => onAssignee(e.target.value || null)}
        title={assignee ? assignee.display_name : "Unassigned"}
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        style={assignee ? { color: assignee.color } : undefined}
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id} style={{ color: m.color }}>
            {m.display_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
        aria-label="Delete"
      >
        ×
      </button>
    </li>
  );
}

function formatDue(d: Date): string {
  if (isToday(d)) return `Today ${format(d, "h:mma").toLowerCase()}`;
  if (isTomorrow(d)) return `Tmrw ${format(d, "h:mma").toLowerCase()}`;
  return format(d, "MMM d, h:mma").toLowerCase();
}
