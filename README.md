# mi vida loca

A private, two-person life-organization web app for **Cole & Kaytie** (and their dogs **Sally** + **Nico**).
Calendar, lists, tasks, notes, pet log, trips, fun-money budgets — with realtime sync between both phones,
Apple-style cream-and-amber UI, dark mode, push notifications, and a daily digest at 6am Central.

🐾 Production: **https://mi-vida-loca.vercel.app**

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind v4 + custom `@theme` tokens (cream / amber / ink) |
| Backend | Supabase (Postgres + Auth + Realtime + RPCs) |
| Auth | Email + password, hard email allowlist trigger |
| Hosting | Vercel (Hobby) |
| Cron | Vercel Cron → `/api/cron/digest` |
| Notifications | Web Push (VAPID) — PWA installable |
| Email | None — daily digest is a push notification, not an email |
| Cost | $0/month on free tiers |

---

## Feature tour

| Route | What it does |
|---|---|
| `/` | **Today dashboard** — next 3 events, today's open tasks, top of latest grocery list, household activity feed, pet feeding status |
| `/calendar` | Month / Week / Agenda views, RRULE recurrence, multi-day banners, per-owner color filter, realtime sync, swipe-to-delete in agenda/week, `.ics` subscription for phones |
| `/lists` | Todo / grocery / custom lists, items with assignees + categories, grocery auto-grouping, swipe-to-delete |
| `/tasks` | Open / done split, recurring tasks (Daily / Weekly / Weekdays / Monthly / Yearly), iOS Reminders-style completion circles, overdue highlighting, task detail modal with notes + comments |
| `/notes` | Markdown editor with Write/Preview tabs, debounced autosave, last-edited-by attribution |
| `/pets` | Sally & Nico log: quick-tap buttons for fed / walk / med / weight / vet / grooming / note, timeline per pet |
| `/trips` | Trip envelopes with auto-pulled itinerary from the calendar, packing list with assignees, autosave notes |
| `/money` | Fun-money budget per person — Cole (Pokemon presets) and Kaytie (estate-sale presets), rolling monthly allowance that carries over, per-month overrides, income/expense ledger with category chips |
| `/settings` | Edit profile (name, color, digest opt-in), change password, Light/Dark/System theme, enable push notifications on this device, phone calendar feed (`webcal://` + `https://`) |
| `/login` | Email + password sign-in |
| `/api/feed/[token]` | Public RFC 5545 `.ics` feed per user (capability URL — keep secret) |
| `/api/push/subscribe` | Subscribe/unsubscribe device for Web Push |
| `/api/push/test` | Trigger a test notification to the current user |
| `/api/cron/digest` | Daily digest — hit by Vercel Cron with `Authorization: Bearer $CRON_SECRET` |
| `/api/digest/test` | Session-authed "Send me one now" button in Settings |
| `/api/theme` | Persist theme preference per user |
| `/api/setup` | **One-shot** seed route that creates the two users on a fresh project; locks after first run |

### Realtime

The following tables stream `postgres_changes` to both users live: `events`, `lists`, `list_items`, `tasks`,
`notes`, `comments`, `pets`, `pet_logs`, `trips`, `trip_packing`, `fun_money_ledger`,
`fun_money_monthly_budget`.

### PWA

`app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx` produce the manifest and icons (hand-drawn paw on the
amber gradient via `next/og`). `public/sw.js` is the service worker that handles push delivery + click
routing. On iPhone, install via Safari → Share → **Add to Home Screen** to unlock push notifications.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Next.js 16 on Vercel                            │
│  ├─ App Router pages (calendar, lists, …)        │
│  ├─ Server Components + Server Actions (CRUD)    │
│  ├─ Route handlers (.ics feed, push, cron)       │
│  ├─ proxy.ts → auth gate (getClaims, no network) │
│  └─ Supabase clients: browser, server, admin     │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│  Supabase (us-west-1)                            │
│  ├─ Postgres + RLS scoped to household_members   │
│  ├─ Auth (email/password, allowlist trigger)     │
│  ├─ Realtime publication on collab tables        │
│  └─ RPCs (fun_money_set_default, is_household_*) │
└──────────────────────────────────────────────────┘
                     │
              Vercel Cron (12:00 UTC daily)
              → /api/cron/digest → Web Push fan-out
```

Source of truth is Postgres. Phones get a one-way read-only `.ics` subscription; edits happen in the web app.

### Auth flow

- `proxy.ts` (Next 16's renamed middleware) runs on every request, calls `supabase.auth.getClaims()` —
  this verifies the JWT **locally** against cached JWKS, so no Supabase round-trip per nav.
- Public paths bypass the gate: `/login`, `/api/setup`, `/api/feed`, `/icon`, `/apple-icon`,
  `/favicon.ico`, `/manifest.webmanifest`, `/sw.js`.
- `handle_new_user` trigger on `auth.users` enforces the email allowlist
  (see `is_email_allowed()` in Postgres) and auto-provisions a `profile`, household membership, and
  `feed_token`. Editing the allowlist requires a SQL migration.

### RLS pattern

Every household-scoped table has the same four policies:
`select / insert / update / delete to authenticated using (public.is_household_member(household_id))`.
`is_household_member()` is `security definer`, so it works inside policy expressions.
`feed_tokens` and `push_subscriptions` use a stricter `profile_id = auth.uid()` policy.

---

## Tables

```
profiles           household_members    households
events             notes                comments
lists              list_items           tasks
feed_tokens        push_subscriptions   pets
pet_logs           trips                trip_packing
fun_money_ledger   fun_money_monthly_budget
```

All household-scoped tables share `household_id` + RLS. Most are added to the `supabase_realtime`
publication with `replica identity full` so updates and deletes stream complete rows.

---

## Deployment

### Supabase

The project lives at `irehmiomrphlntyefxmj.supabase.co` (us-west-1). Migrations are applied via the
Supabase MCP — the full migration list is auditable in the Supabase dashboard.

To deploy schema changes:
1. Apply via Supabase MCP `apply_migration` (preferred — atomic, named) or the SQL editor.
2. If a new table should sync to both devices:
   ```sql
   alter publication supabase_realtime add table public.your_table;
   alter table public.your_table replica identity full;
   ```
3. Run `get_advisors` to lint for missing RLS, mutable search paths, unindexed FKs, etc.
4. Regenerate types into `lib/database.types.ts` (or hand-edit for small additions).

### Vercel

The repo is connected to Vercel via GitHub. Every push to `claude/sweet-ride-yAZjm` (the working branch)
auto-deploys to production. There is **no CI step** beyond the Vercel build.

Required environment variables (set in **Vercel → Settings → Environment Variables**, all environments):

| Name | Public | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Browser + server Supabase client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser client (anon-equivalent) |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | `.ics` feed + setup route bypass RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes | Push subscription on the device |
| `VAPID_PRIVATE_KEY` | **no** | Signing pushes server-side |
| `VAPID_SUBJECT` | no | Contact email in the VAPID JWT (defaults to a mailto: in code) |
| `CRON_SECRET` | **no** | `Authorization: Bearer` for the daily digest cron |

Generate VAPID keys:
```bash
node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

Generate the cron secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Cron (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/digest", "schedule": "0 12 * * *" }
  ]
}
```

12:00 UTC = 6am CST in winter, 7am CDT in summer. Vercel Hobby allows once-daily cron only; for finer
granularity, move to Pro or use `pg_cron` in Supabase calling an Edge Function.

---

## Local development

Outbound network from the dev sandbox may need to allow `*.supabase.co` and `*.vercel.app`.

```bash
git clone <repo>
cd LifePlanning
cp .env.example .env.local   # fill in values from Vercel
npm install
npm run dev                  # http://localhost:3000
```

To test push locally you'll need HTTPS — use a tunnel (e.g. `ngrok`) since service workers + push only
work in secure contexts (localhost is special-cased but iOS Add-to-Home-Screen needs a real https URL).

### Useful scripts

```bash
npm run build       # production build + type check
npm run lint        # eslint
```

### Adding users to the allowlist

Edit the email list in `is_email_allowed()` (Postgres function) via a migration. The
`handle_new_user` trigger consults this on every `auth.users` insert.

### Seeding accounts on a fresh project

The `/api/setup` route is one-shot — it creates the two seed users with generated passwords on first
hit, then locks itself (returns 410 Gone). Useful when bootstrapping a fresh Supabase project. Hit it
via `GET https://<your-domain>/api/setup` and copy the returned passwords.

---

## Mobile

- **Bottom tab bar** with iOS-style icons on phones; top horizontal nav on desktop
- **Bottom-sheet modals** that respect `env(safe-area-inset-bottom)`
- **Swipe-to-delete** on tasks, list items, pet logs, money entries, calendar agenda/week rows
- **iOS-Reminders-style** round-check completion circles
- **Inputs locked to 16px** on small viewports to prevent Safari auto-zoom
- **`-webkit-appearance: none`** on date inputs to defeat their baked-in minimum width
- **Aurora background** is paused under `prefers-reduced-motion`

To install on iPhone:
1. Open the production URL in Safari (not via Chrome — iOS only honors A2HS from Safari).
2. Share → **Add to Home Screen**.
3. Open from the home-screen icon (not Safari) to enable lock-screen push notifications.

---

## Notable design choices

- **Cookie-only auth check in middleware** via `getClaims()` — verifies the JWT locally against cached
  JWKS, no Supabase round-trip per navigation. Pages that need a verified user identity still call
  `getUser()`.
- **`React.cache()` on data helpers** — multiple components in one request share the same Supabase
  query (e.g. `getCurrentUserAndHousehold` is called by layout, page, and helpers but executes once).
- **Optimistic UI everywhere** — list items, tasks, comments, money entries, calendar events all
  insert locally first and reconcile with realtime in the background.
- **No client-side caching beyond React Cache** — Supabase realtime is the cache invalidator.
- **`webcal://` capability URL** — the per-user `feed_tokens.token` is the secret; phones subscribe
  over plain HTTPS bypassing RLS via the service role.
- **Cents-as-integers everywhere** for money to avoid floating-point drift.

---

## Roadmap

Stuff worth doing next, roughly in order of impact:
- Activity badges on the nav (unread comments, new assignments)
- Photo attachments on events / notes / pet log (Supabase Storage)
- Two-way calendar sync via CalDAV (so phone-created events flow back)
- Extract a reusable `useRealtimeRowSync` hook (the same INSERT/UPDATE/DELETE pattern is repeated
  in ~10 components)
- Per-user custom category presets (currently hardcoded by display name)
- Vercel Pro to allow sub-daily cron (so 6am Central is exact, not drifted by DST)

---

## License

Private. Don't redistribute.
