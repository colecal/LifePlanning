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
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">
          Notes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Thoughts on paper
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_1fr]">
        <aside className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              All notes
            </h2>
            <button
              type="button"
              onClick={newNote}
              disabled={pending}
              className="rounded-full bg-amber-50/80 px-2.5 py-0.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
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
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition ${
                    selectedId === n.id
                      ? "bg-amber-50/70 text-ink-900"
                      : "text-ink-700 hover:bg-cream-100/60"
                  }`}
                >
                  <span className="line-clamp-1 text-sm font-medium">
                    {n.title?.trim() || "Untitled"}
                  </span>
                  <span className="text-[10px] text-ink-400">
                    {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  </span>
                </button>
              </li>
            ))}
            {notes.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-ink-300">No notes yet.</li>
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
            <div className="card grid min-h-[24rem] place-items-center p-12 text-center">
              <p className="text-sm text-ink-400">Select or create a note.</p>
            </div>
          )}
        </section>
      </div>
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
    <div className="card flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight text-ink-900 outline-none placeholder:text-ink-300"
        />
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className="text-ink-400">
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved"}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="font-medium text-ink-400 transition hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-xs text-ink-400">
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
        className="min-h-[26rem] resize-y rounded-xl border border-ink-700/8 bg-cream-50/40 p-4 font-mono text-sm leading-relaxed text-ink-800 outline-none transition placeholder:text-ink-300 focus:border-amber-400 focus:bg-cream-50/70"
      />
    </div>
  );
}
