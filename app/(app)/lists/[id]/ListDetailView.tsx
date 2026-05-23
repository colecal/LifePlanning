"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
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
    // Optimistic insert
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
      // Realtime will insert the real row; remove optimistic if real one arrives separately.
      setItems((prev) => prev.filter((p) => p.id !== tempId));
    } catch (err) {
      setItems((prev) => prev.filter((p) => p.id !== tempId));
      alert(err instanceof Error ? err.message : String(err));
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
        alert(err instanceof Error ? err.message : String(err));
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
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function clearCompleted() {
    if (completed.length === 0) return;
    if (!confirm(`Clear ${completed.length} completed item${completed.length === 1 ? "" : "s"}?`)) return;
    setItems((prev) => prev.filter((p) => !p.checked));
    startTransition(async () => {
      await clearCheckedAction(list.id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{list.kind}</p>
        </div>
        <form action={async () => {
          if (confirm(`Delete the list "${list.name}" and all its items?`)) {
            await deleteListAction(list.id);
          }
        }}>
          <button
            type="submit"
            className="text-xs text-red-600 hover:underline"
          >
            Delete list
          </button>
        </form>
      </div>

      <form onSubmit={addItem} className="flex flex-wrap gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={list.kind === "grocery" ? "Add an item…" : "Add to list…"}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {list.kind === "grocery" ? (
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Category…</option>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : null}
        <select
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !newContent.trim()}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          Add
        </button>
      </form>

      <section className="flex flex-col gap-3">
        {groupedActive ? (
          groupedActive.map(([cat, items]) => (
            <div key={cat}>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {cat}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    members={members}
                    memberMap={memberMap}
                    showCategory={false}
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
          <ul className="flex flex-col gap-1">
            {active.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                members={members}
                memberMap={memberMap}
                showCategory={false}
                onToggle={() => toggleChecked(it)}
                onAssignee={(id) => setAssignee(it, id)}
                onCategory={() => {}}
                onDelete={() => remove(it)}
                isGrocery={false}
              />
            ))}
            {active.length === 0 ? (
              <li className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
                Nothing here. Add something above.
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {completed.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Completed ({completed.length})
            </h3>
            <button
              type="button"
              onClick={clearCompleted}
              className="text-xs text-zinc-500 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {completed.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                members={members}
                memberMap={memberMap}
                showCategory={list.kind === "grocery"}
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
  showCategory,
  onToggle,
  onAssignee,
  onCategory,
  onDelete,
  isGrocery,
}: {
  item: Item;
  members: Profile[];
  memberMap: Map<string, Profile>;
  showCategory: boolean;
  onToggle: () => void;
  onAssignee: (id: string | null) => void;
  onCategory: (c: string | null) => void;
  onDelete: () => void;
  isGrocery: boolean;
}) {
  const assignee = item.assignee_id ? memberMap.get(item.assignee_id) : null;
  return (
    <li className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={onToggle}
        className="h-4 w-4"
      />
      <span className={`flex-1 ${item.checked ? "text-zinc-400 line-through" : ""}`}>
        {item.content}
      </span>
      {showCategory ? (
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {item.category}
        </span>
      ) : null}

      {isGrocery ? (
        <select
          value={item.category ?? ""}
          onChange={(e) => onCategory(e.target.value || null)}
          className="hidden rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs group-hover:block dark:border-zinc-700 dark:bg-zinc-900"
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
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        style={assignee ? { color: assignee.color } : undefined}
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id} style={{ color: m.color }}>
            {m.display_name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
        aria-label="Delete"
      >
        ×
      </button>
    </li>
  );
}
