"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { yearMonth } from "@/lib/money";

export async function addLedgerEntryAction(input: {
  profile_id: string;
  kind: "income" | "expense";
  amount_cents: number;
  category: string;
  description?: string;
  occurred_at?: string;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  if (input.amount_cents <= 0) throw new Error("Amount must be positive.");
  if (!input.category.trim()) throw new Error("Category required.");

  const { error } = await supabase.from("fun_money_ledger").insert({
    household_id: householdId,
    profile_id: input.profile_id,
    kind: input.kind,
    amount_cents: Math.round(input.amount_cents),
    category: input.category.trim(),
    description: input.description?.trim() || null,
    occurred_at: input.occurred_at || new Date().toISOString(),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteLedgerEntryAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fun_money_ledger").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Sets the recurring monthly allowance and (if not yet set) anchors the
// start month to today, so balance starts accruing from now.
// Uses a Postgres RPC so the COALESCE happens atomically without a round-trip.
export async function setMonthlyDefaultAction(input: {
  profile_id: string;
  amount_cents: number;
}) {
  if (input.amount_cents < 0) throw new Error("Amount must be ≥ 0");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fun_money_set_default", {
    p_profile_id: input.profile_id,
    p_amount_cents: Math.round(input.amount_cents),
    p_default_start_month: yearMonth(new Date()),
  });
  if (error) throw new Error(error.message);
}

export async function setMonthOverrideAction(input: {
  profile_id: string;
  year_month: string; // 'YYYY-MM'
  amount_cents: number;
}) {
  if (input.amount_cents < 0) throw new Error("Amount must be ≥ 0");
  if (!/^\d{4}-\d{2}$/.test(input.year_month)) throw new Error("Invalid month");
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase
    .from("fun_money_monthly_budget")
    .upsert(
      {
        profile_id: input.profile_id,
        household_id: householdId,
        year_month: input.year_month,
        amount_cents: Math.round(input.amount_cents),
        created_by: userId,
      },
      { onConflict: "profile_id,year_month" },
    );
  if (error) throw new Error(error.message);
}

export async function clearMonthOverrideAction(input: {
  profile_id: string;
  year_month: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("fun_money_monthly_budget")
    .delete()
    .eq("profile_id", input.profile_id)
    .eq("year_month", input.year_month);
  if (error) throw new Error(error.message);
}

