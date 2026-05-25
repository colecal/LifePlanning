"use client";

import { useEffect, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { SwipeableRow } from "@/app/components/SwipeableRow";
import {
  type LogKind,
  deletePetAction,
  deletePetLogAction,
  logPetEventAction,
} from "../actions";

type Pet = {
  id: string;
  name: string;
  color: string;
  breed: string | null;
  birthday: string | null;
};

type Log = {
  id: string;
  kind: string;
  value: string | null;
  notes: string | null;
  at: string;
  created_by: string | null;
};

type QuickKind = {
  kind: LogKind;
  label: string;
  emoji: string;
  needsValue?: { placeholder: string; unit?: string };
};

const QUICK: QuickKind[] = [
  { kind: "feeding",    label: "Fed",     emoji: "🍖" },
  { kind: "walk",       label: "Walk",    emoji: "🦴" },
  { kind: "medication", label: "Med",     emoji: "💊", needsValue: { placeholder: "What med?" } },
  { kind: "weight",     label: "Weight",  emoji: "⚖️", needsValue: { placeholder: "Weight", unit: "lb" } },
  { kind: "vet",        label: "Vet",     emoji: "🏥", needsValue: { placeholder: "Reason" } },
  { kind: "grooming",   label: "Groom",   emoji: "✂️" },
  { kind: "note",       label: "Note",    emoji: "📝", needsValue: { placeholder: "Note" } },
];

export function PetDetailView({
  pet,
  initialLogs,
}: {
  pet: Pet;
  initialLogs: Log[];
}) {
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [active, setActive] = useState<QuickKind | null>(null);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pet-logs-${pet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pet_logs", filter: `pet_id=eq.${pet.id}` },
        (payload) => {
          setLogs((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Log;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [row, ...prev].sort((a, b) => b.at.localeCompare(a.at));
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
  }, [pet.id]);

  function quickLog(qk: QuickKind) {
    if (qk.needsValue) {
      setActive(qk);
      setValue("");
      return;
    }
    submitLog(qk, undefined);
  }

  function submitLog(qk: QuickKind, val: string | undefined) {
    const finalValue = val && qk.needsValue?.unit ? `${val} ${qk.needsValue.unit}` : val;
    startTransition(async () => {
      try {
        await logPetEventAction({
          pet_id: pet.id,
          kind: qk.kind,
          value: finalValue,
        });
        toast.success(`${qk.label} logged`);
        setActive(null);
        setValue("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function removeLog(log: Log) {
    setLogs((prev) => prev.filter((p) => p.id !== log.id));
    try {
      await deletePetLogAction(log.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function removePet() {
    const ok = await confirm({
      title: `Delete ${pet.name}?`,
      message: "This removes all log entries too.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) await deletePetAction(pet.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl shadow-soft"
            style={{ background: `linear-gradient(135deg, ${pet.color}cc, ${pet.color})` }}
          >
            🐕
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
              {pet.breed || "Pup"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-900">{pet.name}</h1>
            {pet.birthday ? (
              <p className="text-xs text-ink-400">
                Born {format(new Date(pet.birthday), "MMM d, yyyy")}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={removePet}
          className="text-xs font-medium text-ink-400 transition hover:text-red-600"
        >
          Delete
        </button>
      </header>

      <section>
        <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          Quick log
        </h2>
        <div className="card grid grid-cols-3 gap-2 p-3 sm:grid-cols-7">
          {QUICK.map((q) => (
            <button
              key={q.kind}
              type="button"
              onClick={() => quickLog(q)}
              disabled={pending}
              className="flex flex-col items-center gap-1 rounded-xl border border-ink-700/8 bg-cream-50/40 p-3 text-xs font-medium text-ink-700 transition hover:border-amber-400 hover:bg-amber-50/40"
            >
              <span className="text-xl">{q.emoji}</span>
              {q.label}
            </button>
          ))}
        </div>

        {active ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLog(active, value);
            }}
            className="card mt-3 flex items-center gap-2 p-2.5"
          >
            <span className="text-xl">{active.emoji}</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={active.needsValue?.placeholder}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none sm:text-sm"
            />
            {active.needsValue?.unit ? (
              <span className="text-xs text-ink-400">{active.needsValue.unit}</span>
            ) : null}
            <button type="button" onClick={() => setActive(null)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary">
              Log
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Timeline
        </h2>
        {logs.length === 0 ? (
          <div className="card grid place-items-center p-12 text-center">
            <p className="text-3xl">🐾</p>
            <p className="mt-2 text-sm text-ink-400">No entries yet. Tap a quick-log above.</p>
          </div>
        ) : (
          <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
            {logs.map((log) => {
              const q = QUICK.find((k) => k.kind === log.kind);
              return (
                <SwipeableRow key={log.id} onDelete={() => removeLog(log)}>
                  <div className="group flex items-center gap-3 px-4 py-3 transition hover:bg-amber-50/40">
                    <span className="text-xl">{q?.emoji ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800">
                        {q?.label ?? log.kind}
                        {log.value ? (
                          <span className="ml-2 font-normal text-ink-500">{log.value}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-400">
                        {formatDistanceToNow(new Date(log.at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </SwipeableRow>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
