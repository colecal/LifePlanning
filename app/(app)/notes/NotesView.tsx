"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { createNoteAction, deleteNoteAction, saveNoteAction } from "./actions";

type Note = {
  id: string;
  title: string | null;
  body: string | null;
  updated_by: string | null;
  updated_at: string;
};

export function NotesView({
  initialNotes,
  members,
}: {
  initialNotes: Note[];
  members: Profile[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        (payload) => {
          setNotes((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Note;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Note;
              return prev
                .map((p) => (p.id === row.id ? row : p))
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  function newNote() {
    startTransition(async () => {
      const id = await createNoteAction();
      setSelectedId(id);
    });
  }

  function removeNote(id: string) {
    if (!confirm("Delete this note?")) return;
    startTransition(async () => {
      await deleteNoteAction(id);
      if (selectedId === id) setSelectedId(null);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Notes
          </h2>
          <button
            type="button"
            onClick={newNote}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + New
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setSelectedId(n.id)}
                className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  selectedId === n.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <span className="truncate font-medium">
                  {n.title?.trim() || "Untitled"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                </span>
              </button>
            </li>
          ))}
          {notes.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-zinc-500">No notes yet.</li>
          ) : null}
        </ul>
      </aside>

      <section>
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            members={members}
            memberMap={memberMap}
            onDelete={() => removeNote(selected.id)}
            onLocalChange={(patch) =>
              setNotes((prev) =>
                prev.map((p) =>
                  p.id === selected.id ? { ...p, ...patch } : p,
                ),
              )
            }
          />
        ) : (
          <div className="flex h-full min-h-[20rem] items-center justify-center rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            <p>Select or create a note.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function NoteEditor({
  note,
  memberMap,
  onDelete,
  onLocalChange,
}: {
  note: Note;
  members: Profile[];
  memberMap: Map<string, Profile>;
  onDelete: () => void;
  onLocalChange: (patch: Partial<Note>) => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef({ title: note.title ?? "", body: note.body ?? "" });

  // Debounced autosave
  useEffect(() => {
    if (title === lastSavedRef.current.title && body === lastSavedRef.current.body) {
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        await saveNoteAction({ id: note.id, title, body });
        lastSavedRef.current = { title, body };
        onLocalChange({ title, body, updated_at: new Date().toISOString() });
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1200);
      } catch {
        setStatus("idle");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [title, body, note.id, onLocalChange]);

  const updatedBy = note.updated_by ? memberMap.get(note.updated_by) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-500">
          <span>
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved"}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Last edited{" "}
        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        {updatedBy ? (
          <>
            {" "}by{" "}
            <span style={{ color: updatedBy.color }} className="font-medium">
              {updatedBy.display_name}
            </span>
          </>
        ) : null}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write…"
        rows={20}
        className="min-h-[24rem] resize-y rounded-md border border-zinc-200 bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
      />
    </div>
  );
}
