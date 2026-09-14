-- Krypto121 v0.7 wallet directory.
-- Linked external wallets are verified and persisted by Privy.
-- This table stores watch-only wallet addresses that Krypto121 may monitor but cannot sign for.

create table if not exists public.watch_wallets (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  label text not null,
  address text not null,
  chain_type text not null default 'ethereum',
  created_at timestamptz not null default now(),
  constraint watch_wallets_label_valid check (length(btrim(label)) between 1 and 100),
  constraint watch_wallets_address_valid check (address ~ '^0x[0-9A-Fa-f]{40}$'),
  constraint watch_wallets_chain_type_valid check (chain_type = 'ethereum')
);

create unique index if not exists watch_wallets_user_address_unique
  on public.watch_wallets (privy_user_id, lower(address));

create index if not exists watch_wallets_user_created_idx
  on public.watch_wallets (privy_user_id, created_at);

alter table public.watch_wallets enable row level security;

drop policy if exists watch_wallets_deny_anon on public.watch_wallets;
create policy watch_wallets_deny_anon on public.watch_wallets
for all to anon using (false) with check (false);

drop policy if exists watch_wallets_deny_authenticated on public.watch_wallets;
create policy watch_wallets_deny_authenticated on public.watch_wallets
for all to authenticated using (false) with check (false);

revoke all on public.watch_wallets from anon, authenticated;
grant select, insert, update, delete on public.watch_wallets to service_role;
