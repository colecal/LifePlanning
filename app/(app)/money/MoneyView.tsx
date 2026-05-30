"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { SwipeableRow } from "@/app/components/SwipeableRow";
import {
  addLedgerEntryAction,
  clearMonthOverrideAction,
  deleteLedgerEntryAction,
  setMonthOverrideAction,
  setMonthlyDefaultAction,
} from "./actions";

type Entry = {
  id: string;
  profile_id: string;
  kind: string;
  amount_cents: number;
  category: string;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
};

type MonthOverride = {
  profile_id: string;
  year_month: string;
  amount_cents: number;
};

export type ProfileBudget = {
  profile_id: string;
  default_cents: number;
  start_month: string | null; // 'YYYY-MM'
};

type Preset = { label: string; emoji: string };
type PresetSet = { income: Preset[]; expense: Preset[] };

const COLE_PRESETS: PresetSet = {
  expense: [
    { label: "Pokemon Cards", emoji: "🃏" },
    { label: "Booster Box",   emoji: "📦" },
    { label: "Singles",       emoji: "🌟" },
    { label: "TCG Live",      emoji: "📱" },
    { label: "Games",         emoji: "🎮" },
    { label: "Other",         emoji: "✨" },
  ],
  income: [
    { label: "Card Sale",    emoji: "💸" },
    { label: "Trade Profit", emoji: "🔄" },
    { label: "Allowance",    emoji: "💰" },
    { label: "Other",        emoji: "✨" },
  ],
};

const KAYTIE_PRESETS: PresetSet = {
  expense: [
    { label: "Estate Sale", emoji: "🏛️" },
    { label: "Thrifting",   emoji: "👗" },
    { label: "Crafts",      emoji: "✂️" },
    { label: "Tools",       emoji: "🔧" },
    { label: "Supplies",    emoji: "📦" },
    { label: "Other",       emoji: "✨" },
  ],
  income: [
    { label: "Resale Sold", emoji: "💸" },
    { label: "Etsy Sale",   emoji: "🛒" },
    { label: "Allowance",   emoji: "💰" },
    { label: "Other",       emoji: "✨" },
  ],
};

const GENERIC_PRESETS: PresetSet = {
  expense: [
    { label: "Hobby", emoji: "🎨" },
    { label: "Food",  emoji: "🍔" },
    { label: "Other", emoji: "✨" },
  ],
  income: [
    { label: "Allowance", emoji: "💰" },
    { label: "Sale",      emoji: "💸" },
    { label: "Other",     emoji: "✨" },
  ],
};

function presetsFor(name: string): PresetSet {
  const n = name.trim().toLowerCase();
  if (n === "cole") return COLE_PRESETS;
  if (n === "kaytie") return KAYTIE_PRESETS;
  return GENERIC_PRESETS;
}

function emojiFor(name: string, category: string): string {
  const sets = presetsFor(name);
  const hit = [...sets.income, ...sets.expense].find(
    (p) => p.label.toLowerCase() === category.toLowerCase(),
  );
  return hit?.emoji ?? "✨";
}

function centsToDollars(c: number): string {
  return (c / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function yearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetweenInclusive(startYM: string, endYM: string): string[] {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const result: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy");
}

export function MoneyView({
  members,
  initialEntries,
  profileBudgets,
  initialOverrides,
  currentUserId,
}: {
  members: Profile[];
  initialEntries: Entry[];
  profileBudgets: ProfileBudget[];
  initialOverrides: MonthOverride[];
  currentUserId: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [budgets, setBudgets] = useState<ProfileBudget[]>(profileBudgets);
  const [overrides, setOverrides] = useState<MonthOverride[]>(initialOverrides);
  const [activeId, setActiveId] = useState<string>(
    members.find((m) => m.id === currentUserId)?.id ?? members[0]?.id ?? "",
  );
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Realtime for entries + monthly_budget
  useEffect(() => {
    const supabase = createClient();
    const ledgerChannel = supabase
      .channel("fun-money-ledger-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fun_money_ledger" },
        (payload) => {
          setEntries((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Entry;
              if (prev.find((p) => p.id === row.id)) return prev;
              return [row, ...prev].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Entry;
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

    const budgetChannel = supabase
      .channel("fun-money-budget-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fun_money_monthly_budget" },
        (payload) => {
          setOverrides((prev) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const row = payload.new as MonthOverride;
              const idx = prev.findIndex(
                (p) => p.profile_id === row.profile_id && p.year_month === row.year_month,
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = row;
                return next;
              }
              return [...prev, row];
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as MonthOverride;
              return prev.filter(
                (p) => !(p.profile_id === row.profile_id && p.year_month === row.year_month),
              );
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ledgerChannel);
      supabase.removeChannel(budgetChannel);
    };
  }, []);

  const active = members.find((m) => m.id === activeId) ?? members[0];
  if (!active) return null;

  const activeBudget =
    budgets.find((b) => b.profile_id === active.id) ?? {
      profile_id: active.id,
      default_cents: 0,
      start_month: null,
    };

  const monthOverrideMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) {
      if (o.profile_id === active.id) m.set(o.year_month, o.amount_cents);
    }
    return m;
  }, [overrides, active.id]);

  const ownEntries = useMemo(
    () => entries.filter((e) => e.profile_id === active.id),
    [entries, active.id],
  );

  // Rolling balance and per-month breakdown
  const calc = useMemo(() => {
    const currentYM = yearMonth(new Date());
    const startYM = activeBudget.start_month ?? currentYM;
    const months = monthsBetweenInclusive(startYM, currentYM);
    type MonthRow = {
      ym: string;
      label: string;
      allowance: number;
      income: number;
      expense: number;
      net: number;       // allowance + income - expense
      runningBalance: number;
      hasOverride: boolean;
    };
    const rows: MonthRow[] = months.map((ym) => ({
      ym,
      label: monthLabel(ym),
      allowance: monthOverrideMap.has(ym)
        ? monthOverrideMap.get(ym)!
        : activeBudget.default_cents,
      income: 0,
      expense: 0,
      net: 0,
      runningBalance: 0,
      hasOverride: monthOverrideMap.has(ym),
    }));
    const rowByYM = new Map(rows.map((r) => [r.ym, r]));

    for (const e of ownEntries) {
      const ym = yearMonth(new Date(e.occurred_at));
      const r = rowByYM.get(ym);
      if (!r) continue;
      if (e.kind === "income") r.income += e.amount_cents;
      else r.expense += e.amount_cents;
    }

    let running = 0;
    for (const r of rows) {
      r.net = r.allowance + r.income - r.expense;
      running += r.net;
      r.runningBalance = running;
    }

    const thisMonth = rows[rows.length - 1] ?? null;
    return {
      rows,
      balance: running,
      thisMonth,
    };
  }, [ownEntries, activeBudget, monthOverrideMap]);

  async function removeEntry(entry: Entry) {
    const ok = await confirm({
      title: "Delete this entry?",
      message: `${entry.category} · ${centsToDollars(entry.amount_cents)}`,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setEntries((prev) => prev.filter((p) => p.id !== entry.id));
    try {
      await deleteLedgerEntryAction(entry.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 sm:text-sm">
          Fun money
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          💰 Hobby budget
        </h1>
      </header>

      {/* Tabs */}
      <div className="card flex gap-1 p-1">
        {members.map((m) => {
          const on = m.id === activeId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveId(m.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                on ? "shadow-soft text-ink-900" : "text-ink-500 hover:text-ink-900"
              }`}
              style={
                on
                  ? {
                      background: `linear-gradient(135deg, ${m.color}aa 0%, ${m.color} 100%)`,
                    }
                  : undefined
              }
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold"
                style={
                  on
                    ? { background: "rgba(28, 22, 16, 0.18)" }
                    : { background: m.color, color: "#FCF8EF" }
                }
              >
                {m.display_name.charAt(0)}
              </span>
              {m.display_name}
            </button>
          );
        })}
      </div>

      <BalanceCard
        active={active}
        balance={calc.balance}
        thisMonth={calc.thisMonth}
        onEditBudget={() => setBudgetModalOpen(true)}
      />

      <QuickAdd
        active={active}
        currentUserId={currentUserId}
        onAdded={(temp) => setEntries((prev) => [temp, ...prev])}
        onError={(msg) => toast.error(msg)}
      />

      {/* Monthly history */}
      {calc.rows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Monthly history
          </h2>
          <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
            {[...calc.rows].reverse().map((r) => (
              <MonthHistoryRow
                key={r.ym}
                row={r}
                color={active.color}
                onEdit={() => {
                  // open the budget modal pre-targeted at this month
                  setEditingMonth(r.ym);
                  setBudgetModalOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Entries list */}
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Recent
        </h2>
        {ownEntries.length === 0 ? (
          <div className="card grid place-items-center p-12 text-center">
            <p className="text-3xl" aria-hidden>🪙</p>
            <p className="mt-2 text-sm text-ink-400">
              No entries yet. Add an income or expense above.
            </p>
          </div>
        ) : (
          <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
            {ownEntries.map((e) => (
              <SwipeableRow key={e.id} onDelete={() => removeEntry(e)}>
                <EntryRow
                  entry={e}
                  ownerName={active.display_name}
                  members={members}
                />
              </SwipeableRow>
            ))}
          </div>
        )}
      </section>

      {budgetModalOpen ? (
        <BudgetModal
          active={active}
          budget={activeBudget}
          overrideMap={monthOverrideMap}
          initialMonth={editingMonth ?? yearMonth(new Date())}
          onClose={() => {
            setBudgetModalOpen(false);
            setEditingMonth(null);
          }}
          onDefaultSaved={(cents, startMonth) => {
            setBudgets((prev) => {
              const idx = prev.findIndex((b) => b.profile_id === active.id);
              const next = [...prev];
              if (idx >= 0) {
                next[idx] = { ...next[idx], default_cents: cents, start_month: startMonth };
              } else {
                next.push({
                  profile_id: active.id,
                  default_cents: cents,
                  start_month: startMonth,
                });
              }
              return next;
            });
          }}
          onOverrideSaved={(ym, cents) => {
            setOverrides((prev) => {
              const idx = prev.findIndex(
                (o) => o.profile_id === active.id && o.year_month === ym,
              );
              const next = [...prev];
              const row = { profile_id: active.id, year_month: ym, amount_cents: cents };
              if (idx >= 0) next[idx] = row;
              else next.push(row);
              return next;
            });
          }}
          onOverrideCleared={(ym) => {
            setOverrides((prev) =>
              prev.filter(
                (o) => !(o.profile_id === active.id && o.year_month === ym),
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}

// ----- BalanceCard -----

function BalanceCard({
  active,
  balance,
  thisMonth,
  onEditBudget,
}: {
  active: Profile;
  balance: number;
  thisMonth: {
    allowance: number;
    income: number;
    expense: number;
    runningBalance: number;
    label: string;
  } | null;
  onEditBudget: () => void;
}) {
  const positive = balance >= 0;
  const used = thisMonth ? thisMonth.expense : 0;
  const cap = thisMonth ? thisMonth.allowance + thisMonth.income : 0;
  const usedPct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <section className="card relative overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${active.color}55, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${active.color}33, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              {active.display_name}&apos;s rolling balance
            </p>
            <p
              className={`mt-1 text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl ${
                positive ? "" : "text-red-600"
              }`}
              style={positive ? { color: active.color } : undefined}
            >
              {centsToDollars(balance)}
            </p>
          </div>
          <button
            type="button"
            onClick={onEditBudget}
            className="rounded-full border border-ink-700/10 bg-cream-50/60 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-amber-400 hover:bg-cream-50/90"
          >
            Edit budget
          </button>
        </div>

        {thisMonth ? (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>
                {thisMonth.label} · spent {centsToDollars(thisMonth.expense)} of{" "}
                {centsToDollars(thisMonth.allowance + thisMonth.income)}
              </span>
              <span className="font-medium">{usedPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cream-200/70">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usedPct}%`,
                  background: usedPct >= 100
                    ? "#dc2626"
                    : `linear-gradient(90deg, ${active.color}aa, ${active.color})`,
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Pill label="Allowance"  value={centsToDollars(thisMonth.allowance)} tone="neutral" />
              <Pill label="Income"     value={centsToDollars(thisMonth.income)}    tone="income" />
              <Pill label="Spent"      value={centsToDollars(thisMonth.expense)}   tone="expense" />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-500">
            Set a monthly allowance to start tracking rolling balance.
          </p>
        )}
      </div>
    </section>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "neutral";
}) {
  const styles =
    tone === "income"
      ? "border-emerald-300/40 bg-emerald-50/60 text-emerald-700"
      : tone === "expense"
        ? "border-red-300/40 bg-red-50/60 text-red-700"
        : "border-ink-700/10 bg-cream-50/60 text-ink-700";
  return (
    <div className={`rounded-xl border px-3 py-2 ${styles}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ----- QuickAdd -----

function QuickAdd({
  active,
  currentUserId,
  onAdded,
  onError,
}: {
  active: Profile;
  currentUserId: string;
  onAdded: (entry: Entry) => void;
  onError: (msg: string) => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const sets = presetsFor(active.display_name);
  const presets = kind === "income" ? sets.income : sets.expense;

  useEffect(() => {
    if (category && !presets.find((p) => p.label === category)) setCategory("");
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      onError("Enter an amount.");
      return;
    }
    if (!category.trim()) {
      onError("Pick a category.");
      return;
    }
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: Entry = {
      id: tempId,
      profile_id: active.id,
      kind,
      amount_cents: cents,
      category: category.trim(),
      description: description.trim() || null,
      occurred_at: new Date().toISOString(),
      created_by: currentUserId,
    };
    onAdded(optimistic);
    setAmount("");
    setCategory("");
    setDescription("");
    startTransition(async () => {
      try {
        await addLedgerEntryAction({
          profile_id: active.id,
          kind,
          amount_cents: cents,
          category: optimistic.category,
          description: optimistic.description ?? undefined,
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-4">
      <div className="flex rounded-full bg-cream-100/60 p-1 text-sm">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={`flex-1 rounded-full py-1.5 font-medium transition ${
            kind === "expense" ? "bg-red-500/90 text-white shadow-soft" : "text-ink-500"
          }`}
        >
          − Expense
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={`flex-1 rounded-full py-1.5 font-medium transition ${
            kind === "income" ? "bg-emerald-500/90 text-white shadow-soft" : "text-ink-500"
          }`}
        >
          + Income
        </button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-400">
          $
        </span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          className="w-full rounded-2xl border border-ink-700/10 bg-cream-50/60 py-4 pl-10 pr-4 text-2xl font-semibold tabular-nums text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-amber-400 focus:bg-cream-50/80"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const on = category === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setCategory(p.label)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                on
                  ? "border-transparent bg-amber-gradient text-ink-900 shadow-soft"
                  : "border-ink-700/10 bg-cream-50/40 text-ink-700 hover:border-amber-400/60"
              }`}
            >
              <span className="text-sm">{p.emoji}</span>
              {p.label}
            </button>
          );
        })}
        <input
          value={category && !presets.find((p) => p.label === category) ? category : ""}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Custom…"
          className="min-w-0 flex-1 rounded-full border border-dashed border-ink-700/15 bg-transparent px-3 py-1.5 text-xs text-ink-700 outline-none placeholder:text-ink-300 focus:border-amber-400"
        />
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Note (optional)"
        className="input-field"
      />

      <button
        type="submit"
        disabled={pending || !amount || !category.trim()}
        className={`rounded-xl px-4 py-3 text-base font-medium transition active:scale-[0.98] disabled:opacity-40 ${
          kind === "income"
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {pending ? "Adding…" : `Add ${kind === "income" ? "income" : "expense"}`}
      </button>
    </form>
  );
}

// ----- Monthly history row -----

function MonthHistoryRow({
  row,
  color,
  onEdit,
}: {
  row: {
    ym: string;
    label: string;
    allowance: number;
    income: number;
    expense: number;
    net: number;
    runningBalance: number;
    hasOverride: boolean;
  };
  color: string;
  onEdit: () => void;
}) {
  const positive = row.net >= 0;
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-amber-50/40"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
          {row.label}
          {row.hasOverride ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{ background: `${color}22`, color }}
            >
              override
            </span>
          ) : null}
        </p>
        <p className="text-xs text-ink-500">
          {centsToDollars(row.allowance)} allowance
          {row.income > 0 ? ` · +${centsToDollars(row.income)}` : ""}
          {row.expense > 0 ? ` · −${centsToDollars(row.expense)}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            positive ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {positive ? "+" : "−"}
          {centsToDollars(Math.abs(row.net))}
        </p>
        <p className="text-[10px] text-ink-400">
          Bal {centsToDollars(row.runningBalance)}
        </p>
      </div>
    </button>
  );
}

// ----- Entry row -----

function EntryRow({
  entry,
  ownerName,
  members,
}: {
  entry: Entry;
  ownerName: string;
  members: Profile[];
}) {
  const sign = entry.kind === "income" ? "+" : "−";
  const tone = entry.kind === "income" ? "text-emerald-700" : "text-red-700";
  const emoji = emojiFor(ownerName, entry.category);
  const creator =
    entry.created_by && entry.created_by !== entry.profile_id
      ? members.find((m) => m.id === entry.created_by)
      : null;
  const when = new Date(entry.occurred_at);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream-100/60 text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{entry.category}</p>
        <p className="truncate text-xs text-ink-500">
          {entry.description ? `${entry.description} · ` : ""}
          {formatDistanceToNow(when, { addSuffix: true })}
          {creator ? (
            <>
              {" · added by "}
              <span style={{ color: creator.color }}>{creator.display_name}</span>
            </>
          ) : null}
        </p>
      </div>
      <p className={`shrink-0 text-base font-semibold tabular-nums ${tone}`}>
        {sign}
        {centsToDollars(entry.amount_cents)}
      </p>
    </div>
  );
}

// ----- Budget modal: set default + per-month override -----

function BudgetModal({
  active,
  budget,
  overrideMap,
  initialMonth,
  onClose,
  onDefaultSaved,
  onOverrideSaved,
  onOverrideCleared,
}: {
  active: Profile;
  budget: ProfileBudget;
  overrideMap: Map<string, number>;
  initialMonth: string;
  onClose: () => void;
  onDefaultSaved: (cents: number, startMonth: string | null) => void;
  onOverrideSaved: (ym: string, cents: number) => void;
  onOverrideCleared: (ym: string) => void;
}) {
  const toast = useToast();
  const [defaultDollars, setDefaultDollars] = useState(
    (budget.default_cents / 100).toString(),
  );
  const [month, setMonth] = useState(initialMonth);
  const existingOverride = overrideMap.get(month);
  const [overrideDollars, setOverrideDollars] = useState(
    existingOverride !== undefined ? (existingOverride / 100).toString() : "",
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOverrideDollars(
      overrideMap.get(month) !== undefined
        ? (overrideMap.get(month)! / 100).toString()
        : "",
    );
  }, [month, overrideMap]);

  function saveDefault() {
    const cents = Math.round(parseFloat(defaultDollars || "0") * 100);
    if (cents < 0) {
      toast.error("Default must be ≥ 0.");
      return;
    }
    startTransition(async () => {
      try {
        await setMonthlyDefaultAction({
          profile_id: active.id,
          amount_cents: cents,
        });
        onDefaultSaved(
          cents,
          budget.start_month ?? yearMonth(new Date()),
        );
        toast.success("Default saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function saveOverride() {
    const cents = Math.round(parseFloat(overrideDollars || "0") * 100);
    if (cents < 0) {
      toast.error("Amount must be ≥ 0.");
      return;
    }
    startTransition(async () => {
      try {
        await setMonthOverrideAction({
          profile_id: active.id,
          year_month: month,
          amount_cents: cents,
        });
        onOverrideSaved(month, cents);
        toast.success("Month override saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function clearOverride() {
    startTransition(async () => {
      try {
        await clearMonthOverrideAction({ profile_id: active.id, year_month: month });
        onOverrideCleared(month);
        setOverrideDollars("");
        toast.success("Override cleared");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong shadow-deep animate-scale-in flex max-h-[92dvh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {active.display_name}&apos;s budget
          </h2>
          <p className="text-sm text-ink-500">
            Set the monthly allowance. Use a per-month override when one
            month should be different.
          </p>
        </div>

        {/* Default */}
        <div className="rounded-2xl border border-ink-700/10 bg-cream-50/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Recurring monthly allowance
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-ink-400">
                $
              </span>
              <input
                inputMode="decimal"
                value={defaultDollars}
                onChange={(e) =>
                  setDefaultDollars(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.00"
                className="w-full rounded-xl border border-ink-700/10 bg-white/40 py-2.5 pl-7 pr-3 text-lg font-semibold tabular-nums text-ink-900 outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="button"
              onClick={saveDefault}
              disabled={pending}
              className="btn-primary"
            >
              Save
            </button>
          </div>
          {!budget.start_month ? (
            <p className="mt-2 text-xs text-ink-400">
              Will start accruing from this month.
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-400">
              Accruing since {monthLabel(budget.start_month)}.
            </p>
          )}
        </div>

        {/* Month override */}
        <div className="rounded-2xl border border-ink-700/10 bg-cream-50/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Specific month override
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input-field"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-ink-400">
                $
              </span>
              <input
                inputMode="decimal"
                value={overrideDollars}
                onChange={(e) =>
                  setOverrideDollars(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder={(budget.default_cents / 100).toFixed(2)}
                className="w-full rounded-xl border border-ink-700/10 bg-white/40 py-2.5 pl-7 pr-3 text-base font-semibold tabular-nums text-ink-900 outline-none focus:border-amber-400"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-400">
              {existingOverride !== undefined
                ? `Currently overridden to ${centsToDollars(existingOverride)}`
                : `Falls back to default (${centsToDollars(budget.default_cents)})`}
            </p>
            <div className="flex gap-2">
              {existingOverride !== undefined ? (
                <button
                  type="button"
                  onClick={clearOverride}
                  disabled={pending}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveOverride}
                disabled={pending}
                className="btn-primary"
              >
                Set
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={onClose} className="btn-ghost self-end">
          Close
        </button>
      </div>
    </div>
  );
}
