import { signInAction } from "./actions";

type SearchParams = Promise<{ error?: string; redirect?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, redirect } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card animate-scale-in w-full max-w-sm p-8">
        <div className="mb-7 flex flex-col items-center gap-2">
          <div className="bg-amber-gradient grid h-14 w-14 place-items-center rounded-2xl shadow-soft">
            <span className="text-2xl">🐕</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
            mi vida loca
          </h1>
          <p className="text-sm text-ink-400">Sign in to continue</p>
        </div>

        <form action={signInAction} className="flex flex-col gap-4">
          <input type="hidden" name="redirect" value={redirect ?? "/"} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="input-field"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Password
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary mt-1 w-full py-2.5">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
