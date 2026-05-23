"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
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
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Comments
      </h3>
      <ul className="flex flex-col gap-1.5">
        {comments.map((c) => {
          const author = c.author_id ? memberMap.get(c.author_id) : null;
          const isMine = c.author_id === currentUserId;
          return (
            <li
              key={c.id}
              className="group rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  <span
                    className="font-medium"
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
              <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
            </li>
          );
        })}
        {comments.length === 0 ? (
          <li className="text-xs text-zinc-400">No comments yet.</li>
        ) : null}
      </ul>

      <form onSubmit={submit} className="mt-1 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          Post
        </button>
      </form>
    </div>
  );
}
