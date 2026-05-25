"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import {
  addItemAction,
  clearCheckedAction,
  deleteItemAction,
  deleteListAction,
  updateItemAction,
} from "../actions";

type Item = {
  id: string;
  content: string;
  category: string | null;
  checked: boolean;
  assignee_id: string | null;
  created_at: string;
};

const GROCERY_CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat",
  "Pantry",
  "Frozen",
  "Bakery",
  "Beverages",
  "Household",
  "Other",
];

export function ListDetailView({
  list,
  initialItems,
  members,
}: {
  list: { id: string; name: string; kind: string };
  initialItems: Item[];
  members: Profile[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`list-items-${list.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${list.id}`,
        },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Item;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Item;
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
  }, [list.id]);

  const memberMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of members) m.set(p.id, p);
    return m;
  }, [members]);

  const { active, completed } = useMemo(() => {
    const a = items.filter((i) => !i.checked);
    const c = items.filter((i) => i.checked);
    return { active: a, completed: c };
  }, [items]);

  const groupedActive = useMemo(() => {
    if (list.kind !== "grocery") return null;
    const g = new Map<string, Item[]>();
    for (const it of active) {
      const cat = it.category || "Other";
      if (!g.has(cat)) g.set(cat, []);
      g.get(cat)!.push(it);
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [active, list.kind]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    const content = newContent.trim();
    setNewContent("");
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: Item = {
      id: tempId,
      content,
      category: list.kind === "grocery" ? newCategory || null : null,
      checked: false,
      assignee_id: newAssignee || null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    try {
      await addItemAction({
        list_id: list.id,
        content,
        category: list.kind === "grocery" ? newCategory || null : null,
        assignee_id: newAssignee || null,
      });
      setItems((prev) => prev.filter((p) => p.id !== tempId));
    } catch (err) {
      setItems((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleChecked(item: Item) {
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, checked: !p.checked } : p)),
    );
    startTransition(async () => {
      try {
        await updateItemAction({ id: item.id, checked: !item.checked });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function setAssignee(item: Item, assignee_id: string | null) {
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, assignee_id } : p)),
    );
    startTransition(async () => {
      await updateItemAction({ id: item.id, assignee_id });
    });
  }

  function setCategory(item: Item, category: string | null) {
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, category } : p)),
    );
    startTransition(async () => {
      await updateItemAction({ id: item.id, category });
    });
  }

  function remove(item: Item) {
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    startTransition(async () => {
      try {
        await deleteItemAction(item.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function clearCompleted() {
    if (completed.length === 0) return;
    const ok = await confirm({
      title: `Clear ${completed.length} completed item${completed.length === 1 ? "" : "s"}?`,
      destructive: true,
      confirmLabel: "Clear",
    });
    if (!ok) return;
    setItems((prev) => prev.filter((p) => !p.checked));
    startTransition(async () => {
      await clearCheckedAction(list.id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            {list.name}
          </h2>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            {list.kind}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete "${list.name}"?`,
              message: "This deletes the list and all its items.",
              destructive: true,
              confirmLabel: "Delete",
            });
            if (ok) await deleteListAction(list.id);
          }}
          className="text-xs font-medium text-ink-400 transition hover:text-red-600"
        >
          Delete list
        </button>
      </div>

      <form onSubmit={addItem} className="card flex flex-col gap-2 p-2.5">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={list.kind === "grocery" ? "Add an item…" : "Add to list…"}
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none sm:text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {list.kind === "grocery" ? (
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              aria-label="Category"
              className="input-field min-w-0 flex-1 sm:w-auto sm:flex-none"
            >
              <option value="">Category</option>
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : null}
          <select
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            aria-label="Assignee"
            className="input-field min-w-0 flex-1 sm:w-auto sm:flex-none"
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !newContent.trim()}
            className="btn-primary flex-shrink-0"
          >
            Add
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        {groupedActive ? (
          groupedActive.map(([cat, items]) => (
            <div key={cat}>
              <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                {cat}
              </h3>
              <ul className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
                {items.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    members={members}
                    memberMap={memberMap}
                    onToggle={() => toggleChecked(it)}
                    onAssignee={(id) => setAssignee(it, id)}
                    onCategory={(c) => setCategory(it, c)}
                    onDelete={() => remove(it)}
                    isGrocery
                  />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <ul className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
            {active.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                members={members}
                memberMap={memberMap}
                onToggle={() => toggleChecked(it)}
                onAssignee={(id) => setAssignee(it, id)}
                onCategory={() => {}}
                onDelete={() => remove(it)}
                isGrocery={false}
              />
            ))}
            {active.length === 0 ? (
              <li className="p-10 text-center text-sm text-ink-300">
                Nothing here. Add something above.
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {completed.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              Completed · {completed.length}
            </h3>
            <button
              type="button"
              onClick={clearCompleted}
              className="text-xs font-medium text-ink-400 transition hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <ul className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden opacity-70">
            {completed.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                members={members}
                memberMap={memberMap}
                onToggle={() => toggleChecked(it)}
                onAssignee={(id) => setAssignee(it, id)}
                onCategory={(c) => setCategory(it, c)}
                onDelete={() => remove(it)}
                isGrocery={list.kind === "grocery"}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  members,
  memberMap,
  onToggle,
  onAssignee,
  onCategory,
  onDelete,
  isGrocery,
}: {
  item: Item;
  members: Profile[];
  memberMap: Map<string, Profile>;
  onToggle: () => void;
  onAssignee: (id: string | null) => void;
  onCategory: (c: string | null) => void;
  onDelete: () => void;
  isGrocery: boolean;
}) {
  const assignee = item.assignee_id ? memberMap.get(item.assignee_id) : null;
  return (
    <li className="group flex items-start gap-3 px-3 py-2.5 transition hover:bg-amber-50/40 sm:items-center sm:px-4">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition sm:mt-0 sm:h-5 sm:w-5 ${
          item.checked
            ? "border-amber-500 bg-amber-gradient"
            : "border-ink-200 bg-cream-50/40 hover:border-amber-400"
        }`}
        aria-label={item.checked ? "Uncheck" : "Check"}
      >
        {item.checked ? (
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

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span
          className={`min-w-0 flex-1 text-[15px] sm:text-sm ${
            item.checked ? "text-ink-300 line-through" : "text-ink-800"
          }`}
        >
          {item.content}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {isGrocery && item.category ? (
            <span className="shrink-0 rounded-full bg-amber-50/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">
              {item.category}
            </span>
          ) : null}

          {isGrocery ? (
            <select
              value={item.category ?? ""}
              onChange={(e) => onCategory(e.target.value || null)}
              aria-label="Category"
              className="hidden h-7 rounded-md border border-ink-200 bg-cream-50/60 px-1 text-xs text-ink-600 sm:group-hover:block"
            >
              <option value="">—</option>
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : null}

          <select
            value={item.assignee_id ?? ""}
            onChange={(e) => onAssignee(e.target.value || null)}
            title={assignee ? assignee.display_name : "Unassigned"}
            aria-label="Assignee"
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
    </li>
  );
}
