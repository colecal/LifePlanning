"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";

export async function createTripAction(input: {
  name: string;
  destination?: string;
  starts_on: string;
  ends_on: string;
  color?: string;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      household_id: householdId,
      name: input.name.trim(),
      destination: input.destination?.trim() || null,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      color: input.color || "#E08A14",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/trips");
  redirect(`/trips/${data.id}`);
}

export async function updateTripAction(input: {
  id: string;
  name?: string;
  destination?: string | null;
  starts_on?: string;
  ends_on?: string;
  notes?: string | null;
  color?: string;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"trips"> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.destination !== undefined) patch.destination = input.destination;
  if (input.starts_on !== undefined) patch.starts_on = input.starts_on;
  if (input.ends_on !== undefined) patch.ends_on = input.ends_on;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.color !== undefined) patch.color = input.color;
  const { error } = await supabase.from("trips").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deleteTripAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/trips");
  redirect("/trips");
}

export async function addPackingItemAction(input: {
  trip_id: string;
  content: string;
  category?: string | null;
  assignee_id?: string | null;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("trip_packing").insert({
    trip_id: input.trip_id,
    household_id: householdId,
    content: input.content.trim(),
    category: input.category || null,
    assignee_id: input.assignee_id || null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function updatePackingItemAction(input: {
  id: string;
  checked?: boolean;
  assignee_id?: string | null;
  category?: string | null;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"trip_packing"> = {};
  if (input.checked !== undefined) patch.checked = input.checked;
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;
  if (input.category !== undefined) patch.category = input.category;
  const { error } = await supabase.from("trip_packing").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deletePackingItemAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_packing").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
