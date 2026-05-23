import { signOutAction } from "../login/actions";
import { getCurrentProfile } from "@/lib/data";
import { AppNav } from "@/app/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-[100dvh] flex-col pb-[env(safe-area-inset-bottom)]">
      <AppNav
        profile={profile ?? { display_name: "", color: "#E08A14" }}
        signOutAction={signOutAction}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
