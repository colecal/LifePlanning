import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { CalendarView } from "./CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();

  const until = new Date();
  until.setMonth(until.getMonth() + 6);

  const [members, eventsR] = await Promise.all([
    getHouseholdMembers(),
    supabase
      .from("events")
      .select(
        "id, title, description, location, starts_at, ends_at, all_day, rrule, owner_id",
      )
      .eq("household_id", householdId)
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
  ]);
  const events = eventsR.data;

  return (
    <CalendarView
      initialEvents={events ?? []}
      members={members}
      householdId={householdId}
      currentUserId={userId}
    />
  );
}
