"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";

export async function createNoteAction(): Promise<string> {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      household_id: householdId,
      title: "Untitled",
      body: "",
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function saveNoteAction(input: {
  id: string;
  title: string;
  body: string;
}) {
  const supabase = await createClient();
  const { userId } = await getCurrentUserAndHousehold();
  const { error } = await supabase
    .from("notes")
    .update({
      title: input.title,
      body: input.body,
      updated_by: userId,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deleteNoteAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
