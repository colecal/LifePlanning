"use client";

import { useEffect, useState, useTransition } from "react";
import type { Profile } from "@/lib/data";
import { CommentThread } from "@/app/components/CommentThread";
import { updateTaskAction } from "./actions";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  assignee_id: string | null;
  status: string;
};

export function TaskDetailModal({
  task,
  members,
  currentUserId,
  onClose,
  onLocalChange,
}: {
  task: Task;
  members: Profile[];
  currentUserId: string;
  onClose: () => void;
  onLocalChange: (patch: Partial<Task>) => void;
}) {
  const [notes, setNotes] = useState(task.notes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [_pending, startTransition] = useTransition();

  useEffect(() => {
    if (notes === (task.notes ?? "")) return;
    setStatus("saving");
    const t = setTimeout(() => {
      startTransition(async () => {
        await updateTaskAction({ id: task.id, notes });
        onLocalChange({ notes });
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1200);
      });
    }, 600);
    return () => clearTimeout(t);
  }, [notes, task.id, task.notes, onLocalChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{task.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium uppercase tracking-wide text-zinc-500">
              Notes
            </span>
            <span className="text-zinc-500">
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved"}
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes…"
            rows={4}
            className="rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <CommentThread
            entityType="task"
            entityId={task.id}
            members={members}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}
