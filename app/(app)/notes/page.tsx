import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { NotesView } from "./NotesView";

export default async function NotesPage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, body, updated_by, updated_at")
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false });

  const members = await getHouseholdMembers();

  return <NotesView initialNotes={notes ?? []} members={members} />;
}
