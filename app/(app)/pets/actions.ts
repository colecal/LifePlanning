"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";

export type LogKind =
  | "feeding"
  | "medication"
  | "vet"
  | "weight"
  | "walk"
  | "grooming"
  | "note";

export async function createPetAction(input: {
  name: string;
  color?: string;
  breed?: string;
  birthday?: string;
}) {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();
  const { data, error } = await supabase
    .from("pets")
    .insert({
      household_id: householdId,
      name: input.name.trim(),
      color: input.color || "#E08A14",
      breed: input.breed?.trim() || null,
      birthday: input.birthday || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/pets");
  redirect(`/pets/${data.id}`);
}

export async function updatePetAction(input: {
  id: string;
  name?: string;
  color?: string;
  breed?: string | null;
  birthday?: string | null;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"pets"> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  if (input.breed !== undefined) patch.breed = input.breed;
  if (input.birthday !== undefined) patch.birthday = input.birthday;
  const { error } = await supabase.from("pets").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/pets");
}

export async function deletePetAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pets");
  redirect("/pets");
}

export async function logPetEventAction(input: {
  pet_id: string;
  kind: LogKind;
  value?: string;
  notes?: string;
  at?: string;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("pet_logs").insert({
    pet_id: input.pet_id,
    household_id: householdId,
    kind: input.kind,
    value: input.value?.trim() || null,
    notes: input.notes?.trim() || null,
    at: input.at || new Date().toISOString(),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function deletePetLogAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pet_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
