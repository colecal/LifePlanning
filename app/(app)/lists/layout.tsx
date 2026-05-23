import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { NewListForm } from "./NewListForm";

export default async function ListsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, kind")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Lists
        </h2>
        <ul className="flex flex-col gap-1">
          {(lists ?? []).map((l) => (
            <li key={l.id}>
              <Link
                href={`/lists/${l.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="truncate">{l.name}</span>
                <span className="ml-2 shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800">
                  {l.kind}
                </span>
              </Link>
            </li>
          ))}
          {(lists ?? []).length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-zinc-500">No lists yet.</li>
          ) : null}
        </ul>
        <NewListForm />
      </aside>
      <section>{children}</section>
    </div>
  );
}
