import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { PetDetailView } from "./PetDetailView";

type Params = Promise<{ id: string }>;

export default async function PetPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, color, breed, birthday, household_id")
    .eq("id", id)
    .single();
  if (!pet || pet.household_id !== householdId) notFound();

  const { data: logs } = await supabase
    .from("pet_logs")
    .select("id, kind, value, notes, at, created_by")
    .eq("pet_id", id)
    .order("at", { ascending: false })
    .limit(100);

  return <PetDetailView pet={pet} initialLogs={logs ?? []} />;
}
