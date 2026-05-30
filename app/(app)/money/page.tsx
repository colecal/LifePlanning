import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { MoneyView, type ProfileBudget } from "./MoneyView";

export default async function MoneyPage() {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const members = await getHouseholdMembers();
  const memberIds = members.map((m) => m.id);

  const [entriesR, budgetsR, overridesR] = await Promise.all([
    supabase
      .from("fun_money_ledger")
      .select("id, profile_id, kind, amount_cents, category, description, occurred_at, created_by")
      .eq("household_id", householdId)
      .order("occurred_at", { ascending: false })
      .limit(500),
    memberIds.length
      ? supabase
          .from("profiles")
          .select("id, fun_money_default_cents, fun_money_start_month")
          .in("id", memberIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("fun_money_monthly_budget")
      .select("profile_id, year_month, amount_cents")
      .eq("household_id", householdId),
  ]);

  const profileBudgets: ProfileBudget[] = (budgetsR.data ?? []).map((p) => ({
    profile_id: p.id,
    default_cents: p.fun_money_default_cents ?? 0,
    start_month: p.fun_money_start_month ?? null,
  }));

  return (
    <MoneyView
      members={members}
      initialEntries={entriesR.data ?? []}
      profileBudgets={profileBudgets}
      initialOverrides={overridesR.data ?? []}
      currentUserId={userId}
    />
  );
}
