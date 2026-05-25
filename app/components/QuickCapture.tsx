"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { useToast } from "@/app/components/Toast";
import { parseQuick } from "@/lib/quickParse";
import { quickCaptureAction } from "./quickCaptureActions";

type Kind = "auto" | "event" | "task" | "note";

export function QuickCapture() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("auto");
  const [pending, startTransition] = useTransition();

  // ⌘K or Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const parsed = parseQuick(text);
  // Resolved kind: if "auto", default to event when a date was parsed, else task
  const resolvedKind: Exclude<Kind, "auto"> =
    kind === "auto" ? (parsed.date ? "event" : "task") : kind;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title.trim()) return;
    startTransition(async () => {
      try {
        await quickCaptureAction({
          kind: resolvedKind,
          title: parsed.title,
          date: parsed.date?.toISOString() ?? null,
          all_day: parsed.date ? !parsed.hasTime && resolvedKind === "event" : false,
        });
        const noun = resolvedKind === "event" ? "Event" : resolvedKind === "task" ? "Task" : "Note";
        toast.success(`${noun} added`);
        setText("");
        setOpen(false);
        setKind("auto");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-amber-gradient fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-40 grid h-14 w-14 place-items-center rounded-full text-2xl text-ink-900 shadow-lift transition active:scale-95 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        aria-label="Quick capture"
      >
        +
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 p-4 pt-[15dvh] backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shadow-deep animate-scale-in flex w-full max-w-lg flex-col gap-3 rounded-3xl p-4"
          >
            <div className="flex items-center gap-3 px-2">
              <span className="text-2xl">⚡</span>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Quick add… try "dinner fri 7pm" or "trash tuesday"'
                className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none sm:text-lg"
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                className="btn-primary"
              >
                {pending ? "…" : "Add"}
              </button>
            </div>

            {text.trim() ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-ink-700/8 px-2 pt-3 text-xs">
                <span className="font-mono text-ink-400">→</span>
                <span className="font-medium text-ink-800">{parsed.title}</span>
                {parsed.date ? (
                  <span className="rounded-full bg-amber-50/80 px-2 py-0.5 font-medium text-amber-700">
                    {format(parsed.date, parsed.hasTime ? "MMM d, h:mma" : "MMM d").toLowerCase()}
                  </span>
                ) : null}
                <span className="ml-auto flex gap-1">
                  {(["auto", "event", "task", "note"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition ${
                        kind === k
                          ? "bg-amber-gradient text-ink-900"
                          : "text-ink-400 hover:text-ink-700"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </span>
              </div>
            ) : (
              <p className="px-2 pb-1 pt-2 text-xs text-ink-400">
                <kbd className="rounded border border-ink-700/10 px-1 text-[10px]">⌘K</kbd>{" "}
                to open · Esc to close
              </p>
            )}
          </form>
        </div>
      ) : null}
    </>
  );
}
