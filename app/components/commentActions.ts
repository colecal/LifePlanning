"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";

export async function postCommentAction(input: {
  entityType: "event" | "task";
  entityId: string;
  body: string;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("comments").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    body: input.body.trim(),
    author_id: userId,
    household_id: householdId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCommentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
