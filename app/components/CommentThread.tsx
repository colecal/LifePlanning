"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { useToast } from "@/app/components/Toast";
import { postCommentAction, deleteCommentAction } from "./commentActions";

type Comment = {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export function CommentThread({
  entityType,
  entityId,
  members,
  currentUserId,
}: {
  entityType: "event" | "task";
  entityId: string;
  members: Profile[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, author_id, body, created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (!cancelled) setComments(data ?? []);
    })();

    const channel = supabase
      .channel(`comments-${entityType}-${entityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Comment & { entity_type: string };
            if (row.entity_type !== entityType) return;
            setComments((prev) =>
              prev.find((c) => c.id === row.id) ? prev : [...prev, row],
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Comment & { entity_type: string };
            if (row.entity_type !== entityType) return;
            setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            setComments((prev) => prev.filter((c) => c.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId]);

  const memberMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of members) m.set(p.id, p);
    return m;
  }, [members]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    try {
      await postCommentAction({ entityType, entityId, body });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
        Comments
      </h3>

      <ul className="flex flex-col gap-2">
        {comments.map((c) => {
          const author = c.author_id ? memberMap.get(c.author_id) : null;
          const isMine = c.author_id === currentUserId;
          return (
            <li
              key={c.id}
              className="group rounded-xl border border-ink-700/6 bg-cream-50/60 px-3 py-2 backdrop-blur"
            >
              <div className="flex items-center justify-between text-[11px] text-ink-400">
                <span>
                  <span
                    className="font-semibold"
                    style={author ? { color: author.color } : undefined}
                  >
                    {author?.display_name ?? "Someone"}
                  </span>{" "}
                  · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
                {isMine ? (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteCommentAction(c.id);
                      })
                    }
                    disabled={pending}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                  >
                    delete
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{c.body}</p>
            </li>
          );
        })}
        {comments.length === 0 ? (
          <li className="text-xs text-ink-300">No comments yet.</li>
        ) : null}
      </ul>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="input-field flex-1"
        />
        <button type="submit" disabled={!draft.trim()} className="btn-primary">
          Post
        </button>
      </form>
    </div>
  );
}
