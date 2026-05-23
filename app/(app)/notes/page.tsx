import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { NotesView } from "./NotesView";

export default async function NotesPage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const [members, notesR] = await Promise.all([
    getHouseholdMembers(),
    supabase
      .from("notes")
      .select("id, title, body, updated_by, updated_at")
      .eq("household_id", householdId)
      .order("updated_at", { ascending: false }),
  ]);

  return <NotesView initialNotes={notesR.data ?? []} members={members} />;
}
