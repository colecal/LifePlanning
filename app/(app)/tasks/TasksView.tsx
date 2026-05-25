"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { SwipeableRow } from "@/app/components/SwipeableRow";
import {
  completeRecurringTaskAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "./actions";
import { TaskDetailModal } from "./TaskDetailModal";

const RRULE_OPTIONS = [
  { value: "", label: "Does not repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Weekdays" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  assignee_id: string | null;
  status: string;
  rrule: string | null;
  created_at: string;
};

export function TasksView({
  initialTasks,
  members,
  currentUserId,
}: {
  initialTasks: Task[];
  members: Profile[];
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [rrule, setRrule] = useState("");
  const [pending, startTransition] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

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
      rrule: rrule || null,
    };
    setTitle("");
    setDue("");
    setAssignee("");
    setRrule("");
    try {
      await createTaskAction(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function toggle(t: Task) {
    // Recurring task with a due date → advance to next occurrence instead of marking done
    if (t.status === "open" && t.rrule && t.due_at) {
      startTransition(async () => {
        try {
          const r = await completeRecurringTaskAction({
            id: t.id,
            rrule: t.rrule!,
            current_due_at: t.due_at!,
          });
          if (r.advanced && r.next_due_at) {
            setTasks((prev) =>
              prev.map((p) => (p.id === t.id ? { ...p, due_at: r.next_due_at! } : p)),
            );
            toast.success("Repeated — next due " + new Date(r.next_due_at).toLocaleDateString());
          } else {
            setTasks((prev) =>
              prev.map((p) => (p.id === t.id ? { ...p, status: "done" } : p)),
            );
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      });
      return;
    }
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

  async function remove(t: Task) {
    const ok = await confirm({
      title: "Delete this task?",
      message: t.title,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setTasks((prev) => prev.filter((p) => p.id !== t.id));
    startTransition(async () => {
      await deleteTaskAction(t.id);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">
          Tasks
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          On the docket
        </h1>
      </header>

      <form onSubmit={addTask} className="card flex flex-col gap-2 p-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none sm:text-sm"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="input-field min-w-0 flex-1"
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Assignee"
            className="input-field w-auto flex-shrink-0"
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          <select
            value={rrule}
            onChange={(e) => setRrule(e.target.value)}
            aria-label="Repeats"
            className="input-field w-auto flex-shrink-0"
          >
            {RRULE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="btn-primary flex-shrink-0"
          >
            Add
          </button>
        </div>
      </form>

      <section>
        <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          Open · {open.length}
        </h3>
        <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
          {open.map((t) => (
            <SwipeableRow key={t.id} onDelete={() => remove(t)}>
              <TaskRow
                task={t}
                members={members}
                memberMap={memberMap}
                onToggle={() => toggle(t)}
                onAssignee={(id) => setAssigneeFor(t, id)}
                onDelete={() => remove(t)}
                onOpen={() => setOpenTaskId(t.id)}
              />
            </SwipeableRow>
          ))}
          {open.length === 0 ? (
            <div className="p-12 text-center text-sm text-ink-300">
              All clear. Nothing on the list.
            </div>
          ) : null}
        </div>
      </section>

      {openTaskId
        ? (() => {
            const t = tasks.find((x) => x.id === openTaskId);
            if (!t) return null;
            return (
              <TaskDetailModal
                task={t}
                members={members}
                currentUserId={currentUserId}
                onClose={() => setOpenTaskId(null)}
                onLocalChange={(patch) =>
                  setTasks((prev) =>
                    prev.map((p) => (p.id === t.id ? { ...p, ...patch } : p)),
                  )
                }
              />
            );
          })()
        : null}

      {done.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Done · {done.length}
          </h3>
          <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden opacity-70">
            {done.map((t) => (
              <SwipeableRow key={t.id} onDelete={() => remove(t)}>
                <TaskRow
                  task={t}
                  members={members}
                  memberMap={memberMap}
                  onToggle={() => toggle(t)}
                  onAssignee={(id) => setAssigneeFor(t, id)}
                  onDelete={() => remove(t)}
                  onOpen={() => setOpenTaskId(t.id)}
                />
              </SwipeableRow>
            ))}
          </div>
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
  onOpen,
}: {
  task: Task;
  members: Profile[];
  memberMap: Map<string, Profile>;
  onToggle: () => void;
  onAssignee: (id: string | null) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : null;
  const isDone = task.status === "done";
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && !isDone && isPast(due);

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition hover:bg-amber-50/40 sm:items-center sm:px-4">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition sm:mt-0 sm:h-5 sm:w-5 ${
          isDone
            ? "border-amber-500 bg-amber-gradient"
            : "border-ink-200 bg-cream-50/40 hover:border-amber-400"
        }`}
        aria-label={isDone ? "Mark open" : "Mark done"}
      >
        {isDone ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-ink-900">
            <path
              d="M2 6.5l2.5 2.5L10 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        ) : null}
      </button>

      {/* Title + meta on mobile, all one row on desktop */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={onOpen}
          className={`flex min-w-0 flex-1 items-center gap-1.5 text-left text-[15px] sm:text-sm ${
            isDone ? "text-ink-300 line-through" : "font-medium text-ink-800 hover:text-amber-700"
          }`}
        >
          <span className="truncate">{task.title}</span>
          {task.rrule ? (
            <span title="Repeats" className="shrink-0 text-amber-600">
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <path
                  d="M3 4a3 3 0 0 1 3-3h2M9 8a3 3 0 0 1-3 3H4M2 2v3h3M10 10V7H7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
          ) : null}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {due ? (
            <span
              className={`text-xs ${
                overdue
                  ? "font-semibold text-red-600"
                  : isDone
                    ? "text-ink-300"
                    : "text-ink-500"
              }`}
            >
              {formatDue(due)}
            </span>
          ) : null}

          <select
            value={task.assignee_id ?? ""}
            onChange={(e) => onAssignee(e.target.value || null)}
            title={assignee ? assignee.display_name : "Unassigned"}
            className="h-7 rounded-md border border-ink-200 bg-cream-50/60 px-1.5 text-xs font-medium"
            style={assignee ? { color: assignee.color } : { color: "var(--color-ink-400)" }}
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} style={{ color: m.color }}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="grid h-6 w-6 shrink-0 place-items-center text-base text-ink-300 transition hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Delete"
      >
        ×
      </button>
    </div>
  );
}

function formatDue(d: Date): string {
  if (isToday(d)) return `Today ${format(d, "h:mma").toLowerCase()}`;
  if (isTomorrow(d)) return `Tmrw ${format(d, "h:mma").toLowerCase()}`;
  return format(d, "MMM d · h:mma").toLowerCase();
}
