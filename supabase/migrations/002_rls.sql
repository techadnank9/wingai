-- RLS: dashboard users can read; only backend (service role) writes.

alter table public.calls enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;

-- Reads for authenticated users (Supabase Auth).
drop policy if exists "calls_read_authenticated" on public.calls;
create policy "calls_read_authenticated"
on public.calls
for select
to authenticated
using (true);

drop policy if exists "orders_read_authenticated" on public.orders;
create policy "orders_read_authenticated"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "order_events_read_authenticated" on public.order_events;
create policy "order_events_read_authenticated"
on public.order_events
for select
to authenticated
using (true);

-- No insert/update/delete policies: authenticated users cannot write.
-- Backend uses service role key and bypasses RLS.

