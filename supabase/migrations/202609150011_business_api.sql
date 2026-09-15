begin;

create table if not exists public.business_api_keys (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null
    references public.profiles(privy_user_id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists business_api_keys_one_active_per_user
  on public.business_api_keys (privy_user_id)
  where revoked_at is null;

create index if not exists business_api_keys_hash_active_idx
  on public.business_api_keys (key_hash)
  where revoked_at is null;

alter table public.business_api_keys enable row level security;

drop policy if exists business_api_keys_deny_anon
  on public.business_api_keys;
create policy business_api_keys_deny_anon
  on public.business_api_keys
  for all to anon using (false) with check (false);

drop policy if exists business_api_keys_deny_authenticated
  on public.business_api_keys;
create policy business_api_keys_deny_authenticated
  on public.business_api_keys
  for all to authenticated using (false) with check (false);

grant select, insert, update, delete
  on public.business_api_keys to service_role;


alter table public.business_payment_requests
  add column if not exists external_reference text;

alter table public.business_payment_requests
  drop constraint if exists business_payment_requests_external_reference_length;

alter table public.business_payment_requests
  add constraint business_payment_requests_external_reference_length
  check (
    external_reference is null
    or length(external_reference) between 1 and 120
  );

create unique index if not exists business_payment_requests_external_reference_unique
  on public.business_payment_requests (privy_user_id, external_reference)
  where external_reference is not null;

commit;
