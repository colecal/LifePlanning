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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong shadow-deep animate-scale-in flex max-h-[92dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">
            {task.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition hover:bg-cream-100/60 hover:text-ink-900"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              Notes
            </span>
            <span className="text-[11px] text-ink-400">
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved"}
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes…"
            rows={4}
            className="input-field resize-y"
          />
        </label>

        <div className="border-t border-ink-700/8 pt-4">
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
