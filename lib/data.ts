import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  color: string;
};

// React.cache deduplicates within a single request — layout + page + helpers
// can all call this and we hit Supabase once.
export const getCurrentUserAndHousehold = cache(async () => {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally against cached JWKS — same security
  // as getUser() but no Supabase round-trip.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new Error("Not authenticated");

  const { data: membership, error: mErr } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", userId)
    .limit(1)
    .single();
  if (mErr || !membership) throw new Error("No household for user");

  return { userId, householdId: membership.household_id };
});

export const getHouseholdMembers = cache(async (): Promise<Profile[]> => {
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
});

// Cached profile lookup used by the app shell + anywhere else
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { userId } = await getCurrentUserAndHousehold();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, color")
    .eq("id", userId)
    .single();
  return data;
});
