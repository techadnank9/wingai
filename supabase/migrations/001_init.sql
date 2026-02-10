-- Core tables for call lifecycle + order capture.
-- Assumes Supabase (extensions like pgcrypto available for gen_random_uuid()).

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id),

  direction text not null check (direction in ('outbound', 'inbound')),

  customer_name text null,
  customer_phone text null,

  status text not null check (
    status in ('queued','dialing','in_progress','processing','completed','failed')
  ),

  vapi_call_id text null,
  last_event_at timestamptz null,

  error_code text null,
  error_message text null,

  metadata jsonb not null default '{}'::jsonb,
  raw jsonb null
);

create unique index if not exists calls_vapi_call_id_uniq on public.calls (vapi_call_id) where vapi_call_id is not null;
create index if not exists calls_status_created_at_idx on public.calls (status, created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  call_id uuid not null references public.calls (id) on delete cascade,
  status text not null check (status in ('completed','failed')),

  customer_name text null,
  customer_phone text null,
  total_cents integer null,

  payload jsonb not null,
  raw jsonb null
);

create unique index if not exists orders_call_id_uniq on public.orders (call_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  payload jsonb not null
);

create index if not exists order_events_order_id_created_at_idx on public.order_events (order_id, created_at desc);

-- Optional: better Realtime "old_record" support for updates.
alter table public.calls replica identity full;
alter table public.orders replica identity full;

