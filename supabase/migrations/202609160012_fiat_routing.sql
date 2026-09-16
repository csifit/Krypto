begin;

create table if not exists public.fiat_quotes (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null
    references public.profiles(privy_user_id) on delete cascade,
  provider_id text not null,
  provider_quote_id text not null,
  request_payload jsonb not null,
  quote_payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists fiat_quotes_user_created_idx
  on public.fiat_quotes (privy_user_id, created_at desc);

create index if not exists fiat_quotes_expiry_idx
  on public.fiat_quotes (expires_at);

alter table public.fiat_quotes enable row level security;

drop policy if exists fiat_quotes_no_browser_access on public.fiat_quotes;
create policy fiat_quotes_no_browser_access
  on public.fiat_quotes
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists fiat_quotes_service_role on public.fiat_quotes;
create policy fiat_quotes_service_role
  on public.fiat_quotes
  for all to service_role
  using (true)
  with check (true);


create table if not exists public.fiat_sessions (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null
    references public.profiles(privy_user_id) on delete cascade,
  quote_id uuid not null
    references public.fiat_quotes(id) on delete restrict,
  provider_id text not null,
  provider_session_id text not null,
  status text not null
    check (
      status in (
        'created',
        'awaiting-user',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'expired'
      )
    ),
  source_amount text,
  destination_amount text,
  transaction_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, provider_session_id)
);

create index if not exists fiat_sessions_user_created_idx
  on public.fiat_sessions (privy_user_id, created_at desc);

alter table public.fiat_sessions enable row level security;

drop policy if exists fiat_sessions_no_browser_access on public.fiat_sessions;
create policy fiat_sessions_no_browser_access
  on public.fiat_sessions
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists fiat_sessions_service_role on public.fiat_sessions;
create policy fiat_sessions_service_role
  on public.fiat_sessions
  for all to service_role
  using (true)
  with check (true);

commit;
