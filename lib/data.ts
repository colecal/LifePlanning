import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  color: string;
};

export async function getCurrentUserAndHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: membership, error: mErr } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();
  if (mErr || !membership) {
    throw new Error("No household for user");
  }

  return { userId: user.id, householdId: membership.household_id };
}

export async function getHouseholdMembers(): Promise<Profile[]> {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();
  const { data } = await supabase
    .from("household_members")
    .select("profiles(id, display_name, color)")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  return (
    data?.map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { id: p!.id, display_name: p!.display_name, color: p!.color };
    }) ?? []
  );
}
