begin;

create table if not exists public.relay_quotes (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null,
  request_id text not null unique,
  source_wallet text not null,
  recipient text not null,
  origin_chain_id bigint not null,
  destination_chain_id bigint not null,
  origin_currency text not null,
  destination_currency text not null,
  source_amount_raw text not null,
  destination_amount_raw text not null,
  source_amount text not null,
  destination_amount text not null,
  expires_at timestamptz not null,
  status text not null default 'quoted'
    check (status in ('quoted','submitted','settled','failed','refunded')),
  origin_tx_hash text,
  destination_tx_hash text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relay_quotes_user_created_idx
  on public.relay_quotes (privy_user_id, created_at desc);

alter table public.relay_quotes enable row level security;

drop policy if exists "relay_quotes_no_browser_access" on public.relay_quotes;
create policy "relay_quotes_no_browser_access"
  on public.relay_quotes
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "relay_quotes_service_role" on public.relay_quotes;
create policy "relay_quotes_service_role"
  on public.relay_quotes
  for all
  to service_role
  using (true)
  with check (true);

commit;
