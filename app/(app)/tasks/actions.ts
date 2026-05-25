"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";
import { sendPushToProfiles } from "@/lib/push";

export async function createTaskAction(input: {
  title: string;
  due_at?: string | null;
  assignee_id?: string | null;
  notes?: string | null;
  rrule?: string | null;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("tasks").insert({
    household_id: householdId,
    title: input.title.trim(),
    due_at: input.due_at || null,
    assignee_id: input.assignee_id || null,
    notes: input.notes?.trim() || null,
    rrule: input.rrule || null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  // Notify the assignee if it's someone other than the creator
  if (input.assignee_id && input.assignee_id !== userId) {
    void sendPushToProfiles([input.assignee_id], {
      title: "New task for you",
      body: input.title.trim(),
      url: "/tasks",
      tag: `task-assign`,
    });
  }
}

export async function updateTaskAction(input: {
  id: string;
  title?: string;
  due_at?: string | null;
  assignee_id?: string | null;
  status?: "open" | "done";
  notes?: string | null;
  rrule?: string | null;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"tasks"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.due_at !== undefined) patch.due_at = input.due_at;
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.rrule !== undefined) patch.rrule = input.rrule;

  // Fetch the task to know who the actor + previous assignee were
  const { data: prev } = await supabase
    .from("tasks")
    .select("title, assignee_id")
    .eq("id", input.id)
    .single();

  const { error } = await supabase.from("tasks").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  // Notify on reassignment
  if (input.assignee_id && prev && input.assignee_id !== prev.assignee_id) {
    const { userId } = await getCurrentUserAndHousehold();
    if (input.assignee_id !== userId) {
      void sendPushToProfiles([input.assignee_id], {
        title: "Task assigned to you",
        body: prev.title,
        url: "/tasks",
        tag: `task-reassign`,
      });
    }
  }
}

// Completing a recurring task: instead of marking done, advance due_at to the
// next occurrence per its rrule, keep status=open. Mirrors Apple Reminders.
export async function completeRecurringTaskAction(input: {
  id: string;
  rrule: string;
  current_due_at: string;
}) {
  const supabase = await createClient();
  const nextDate = nextOccurrenceISO(input.current_due_at, input.rrule);
  if (!nextDate) {
    // No more occurrences — mark done normally
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { advanced: false };
  }
  const { error } = await supabase
    .from("tasks")
    .update({ due_at: nextDate })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { advanced: true, next_due_at: nextDate };
}

function nextOccurrenceISO(currentDueISO: string, rruleStr: string): string | null {
  // rrule package needs DTSTART. We treat the current due_at as the prior
  // occurrence and ask for the next.
  // Use dynamic import via require-less approach: parse manually for simple cases.
  // FREQ=DAILY → +1 day; FREQ=WEEKLY → +7d (BYDAY ignored for simplicity here);
  // FREQ=MONTHLY → +1 month; FREQ=YEARLY → +1 year.
  // For BYDAY=MO,TU,WE,TH,FR we compute the next weekday.
  const cur = new Date(currentDueISO);
  if (rruleStr.startsWith("FREQ=WEEKLY;BYDAY=")) {
    const days = rruleStr.split("BYDAY=")[1].split(",");
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const allowed = new Set(days.map((d) => dayMap[d]).filter((n) => n !== undefined));
    for (let i = 1; i <= 14; i++) {
      const probe = new Date(cur);
      probe.setDate(probe.getDate() + i);
      if (allowed.has(probe.getDay())) return probe.toISOString();
    }
    return null;
  }
  if (rruleStr === "FREQ=DAILY") {
    cur.setDate(cur.getDate() + 1);
    return cur.toISOString();
  }
  if (rruleStr === "FREQ=WEEKLY") {
    cur.setDate(cur.getDate() + 7);
    return cur.toISOString();
  }
  if (rruleStr === "FREQ=MONTHLY") {
    cur.setMonth(cur.getMonth() + 1);
    return cur.toISOString();
  }
  if (rruleStr === "FREQ=YEARLY") {
    cur.setFullYear(cur.getFullYear() + 1);
    return cur.toISOString();
  }
  return null;
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
