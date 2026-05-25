"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";

export async function quickCaptureAction(input: {
  kind: "event" | "task" | "note";
  title: string;
  date: string | null;
  all_day?: boolean;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const title = input.title.trim();
  if (!title) throw new Error("Empty");

  if (input.kind === "event") {
    const startISO = input.date ?? new Date().toISOString();
    const start = new Date(startISO);
    const end = new Date(start);
    if (input.all_day) {
      end.setHours(start.getHours(), start.getMinutes() + 0, 0, 0);
    } else {
      end.setHours(end.getHours() + 1);
    }
    const { error } = await supabase.from("events").insert({
      household_id: householdId,
      title,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: input.all_day ?? false,
      owner_id: userId,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/calendar");
    revalidatePath("/");
  } else if (input.kind === "task") {
    const { error } = await supabase.from("tasks").insert({
      household_id: householdId,
      title,
      due_at: input.date,
      assignee_id: userId,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/tasks");
    revalidatePath("/");
  } else if (input.kind === "note") {
    const { error } = await supabase.from("notes").insert({
      household_id: householdId,
      title,
      body: "",
      updated_by: userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/notes");
  }
}
