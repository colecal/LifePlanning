"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { sendPushToProfiles } from "@/lib/push";

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

  // Notify the other household members (everyone except the commenter)
  const { data: members } = await supabase
    .from("household_members")
    .select("profile_id")
    .eq("household_id", householdId);
  const recipients = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id) => id !== userId);

  // Look up the entity title for context
  let entityTitle = "";
  if (input.entityType === "event") {
    const { data } = await supabase
      .from("events").select("title").eq("id", input.entityId).single();
    entityTitle = data?.title ?? "";
  } else {
    const { data } = await supabase
      .from("tasks").select("title").eq("id", input.entityId).single();
    entityTitle = data?.title ?? "";
  }

  void sendPushToProfiles(recipients, {
    title: `New comment${entityTitle ? ` on "${entityTitle}"` : ""}`,
    body: input.body.trim().slice(0, 140),
    url: input.entityType === "event" ? "/calendar" : "/tasks",
    tag: `comment-${input.entityId}`,
  });
}

export async function deleteCommentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
