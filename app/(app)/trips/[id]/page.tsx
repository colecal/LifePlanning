import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { TripDetailView } from "./TripDetailView";

type Params = Promise<{ id: string }>;

export default async function TripPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination, starts_on, ends_on, notes, color, household_id")
    .eq("id", id)
    .single();
  if (!trip || trip.household_id !== householdId) notFound();

  // Pull events that fall within the trip's window
  const start = new Date(trip.starts_on);
  const endExclusive = new Date(trip.ends_on);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const [packingR, eventsR, members] = await Promise.all([
    supabase
      .from("trip_packing")
      .select("id, content, category, checked, assignee_id, created_at")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, all_day, location, owner_id")
      .eq("household_id", householdId)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", endExclusive.toISOString())
      .order("starts_at", { ascending: true }),
    getHouseholdMembers(),
  ]);

  return (
    <TripDetailView
      trip={trip}
      initialPacking={packingR.data ?? []}
      events={eventsR.data ?? []}
      members={members}
      currentUserId={userId}
    />
  );
}
