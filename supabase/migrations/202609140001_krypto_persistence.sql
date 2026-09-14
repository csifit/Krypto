-- Krypto121 v0.6 durable business metadata.
-- Privy remains the authentication provider. Browser clients do not access these
-- tables directly; authenticated Next.js API routes verify the Privy access token
-- and then use the server-only Supabase secret key.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null unique,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_privy_user_id_not_blank check (length(btrim(privy_user_id)) > 0),
  constraint profiles_wallet_address_valid check (
    wallet_address is null or wallet_address ~ '^0x[0-9A-Fa-f]{40}$'
  )
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  name text not null,
  address text not null,
  created_at timestamptz not null default now(),
  constraint beneficiaries_name_valid check (length(btrim(name)) between 1 and 100),
  constraint beneficiaries_address_valid check (address ~ '^0x[0-9A-Fa-f]{40}$')
);

create unique index if not exists beneficiaries_user_address_unique
  on public.beneficiaries (privy_user_id, lower(address));

create index if not exists beneficiaries_user_created_idx
  on public.beneficiaries (privy_user_id, created_at);

create table if not exists public.payments (
  id text primary key,
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  source_wallet text not null,
  destination text not null,
  asset_symbol text not null,
  network text,
  source_amount numeric(78, 18) not null,
  memo text,
  beneficiary_name text,
  tx_hash text not null,
  status text not null default 'settled',
  intent jsonb not null,
  quote jsonb not null,
  settled_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint payments_source_wallet_valid check (source_wallet ~ '^0x[0-9A-Fa-f]{40}$'),
  constraint payments_destination_valid check (destination ~ '^0x[0-9A-Fa-f]{40}$'),
  constraint payments_tx_hash_valid check (tx_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  constraint payments_amount_positive check (source_amount > 0),
  constraint payments_status_settled check (status = 'settled')
);

create unique index if not exists payments_user_tx_unique
  on public.payments (privy_user_id, lower(tx_hash));

create index if not exists payments_user_settled_idx
  on public.payments (privy_user_id, settled_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.payments enable row level security;

-- No browser-facing Supabase client is used in v0.6. These explicit deny policies
-- document the intended boundary even if a public key is added later.
drop policy if exists profiles_deny_anon on public.profiles;
create policy profiles_deny_anon on public.profiles
for all to anon using (false) with check (false);

drop policy if exists profiles_deny_authenticated on public.profiles;
create policy profiles_deny_authenticated on public.profiles
for all to authenticated using (false) with check (false);

drop policy if exists beneficiaries_deny_anon on public.beneficiaries;
create policy beneficiaries_deny_anon on public.beneficiaries
for all to anon using (false) with check (false);

drop policy if exists beneficiaries_deny_authenticated on public.beneficiaries;
create policy beneficiaries_deny_authenticated on public.beneficiaries
for all to authenticated using (false) with check (false);

drop policy if exists payments_deny_anon on public.payments;
create policy payments_deny_anon on public.payments
for all to anon using (false) with check (false);

drop policy if exists payments_deny_authenticated on public.payments;
create policy payments_deny_authenticated on public.payments
for all to authenticated using (false) with check (false);

revoke all on public.profiles from anon, authenticated;
revoke all on public.beneficiaries from anon, authenticated;
revoke all on public.payments from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.beneficiaries to service_role;
grant select, insert, update, delete on public.payments to service_role;
