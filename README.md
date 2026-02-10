# wingai (V2)

Fastify API + Next.js dashboard + Supabase (Postgres/Auth/Realtime).

## Structure

- `apps/api`: Fastify API (call trigger + Vapi webhook ingest)
- `apps/dashboard`: Next.js dashboard (Supabase Auth + live updates)
- `supabase/migrations`: SQL schema + RLS policies

## Env

Create `.env` files:

- `apps/api/.env`:
  - `SUPABASE_URL=...`
  - `SUPABASE_SERVICE_ROLE_KEY=...` (server only)
  - `VAPI_API_KEY=...` (server only)
  - `VAPI_PHONE_NUMBER_ID=...`
  - `VAPI_ASSISTANT_ID=...`
  - `VAPI_WEBHOOK_BEARER=...` (shared secret you set in Vapi webhook auth)
  - `PUBLIC_DASHBOARD_ORIGIN=http://localhost:3000`
  - `PORT=4000`

- `apps/dashboard/.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL=...`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

## Database

Run the SQL in:

- `supabase/migrations/001_init.sql`
- `supabase/migrations/002_rls.sql`

## Notes

- Backend uses Supabase **service role** key, so it bypasses RLS for inserts/updates.
- Dashboard reads via Supabase Auth (JWT) and RLS `authenticated` read policies.
- Realtime uses `postgres_changes` channels on `calls` and `orders`.

