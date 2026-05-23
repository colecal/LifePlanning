"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";

type EventInput = {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule?: string | null;
  owner_id?: string | null;
};

export async function saveEventAction(input: EventInput) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();

  const payload = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    all_day: input.all_day,
    rrule: input.rrule?.trim() || null,
    owner_id: input.owner_id || userId,
    household_id: householdId,
  };

  if (input.id) {
    const { error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("events")
      .insert({ ...payload, created_by: userId });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/calendar");
}

export async function deleteEventAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}
