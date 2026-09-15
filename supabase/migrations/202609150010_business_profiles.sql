begin;

create table if not exists public.business_profiles (
  privy_user_id text primary key
    references public.profiles(privy_user_id) on delete cascade,
  business_name text not null,
  country_code text,
  business_email text,
  default_receive_wallet text,
  default_receive_asset text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_name_valid
    check (length(btrim(business_name)) between 1 and 120),
  constraint business_profiles_country_valid
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint business_profiles_email_length
    check (business_email is null or length(business_email) between 3 and 254),
  constraint business_profiles_wallet_valid
    check (
      default_receive_wallet is null
      or default_receive_wallet ~ '^0x[0-9A-Fa-f]{40}$'
    ),
  constraint business_profiles_asset_valid
    check (
      default_receive_asset is null
      or length(default_receive_asset) between 2 and 20
    )
);

drop trigger if exists business_profiles_set_updated_at
  on public.business_profiles;

create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

alter table public.business_profiles enable row level security;

drop policy if exists business_profiles_deny_anon
  on public.business_profiles;
create policy business_profiles_deny_anon
  on public.business_profiles
  for all to anon using (false) with check (false);

drop policy if exists business_profiles_deny_authenticated
  on public.business_profiles;
create policy business_profiles_deny_authenticated
  on public.business_profiles
  for all to authenticated using (false) with check (false);

grant select, insert, update, delete
  on public.business_profiles to service_role;


create table if not exists public.beneficiary_partners (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null
    references public.profiles(privy_user_id) on delete cascade,
  name text not null,
  partner_type text not null default 'private'
    check (partner_type in ('business', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiary_partners_name_valid
    check (length(btrim(name)) between 1 and 120)
);

create index if not exists beneficiary_partners_user_name_idx
  on public.beneficiary_partners (privy_user_id, lower(name), created_at);

drop trigger if exists beneficiary_partners_set_updated_at
  on public.beneficiary_partners;

create trigger beneficiary_partners_set_updated_at
before update on public.beneficiary_partners
for each row execute function public.set_updated_at();

alter table public.beneficiary_partners enable row level security;

drop policy if exists beneficiary_partners_deny_anon
  on public.beneficiary_partners;
create policy beneficiary_partners_deny_anon
  on public.beneficiary_partners
  for all to anon using (false) with check (false);

drop policy if exists beneficiary_partners_deny_authenticated
  on public.beneficiary_partners;
create policy beneficiary_partners_deny_authenticated
  on public.beneficiary_partners
  for all to authenticated using (false) with check (false);

grant select, insert, update, delete
  on public.beneficiary_partners to service_role;


create table if not exists public.beneficiary_wallets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null
    references public.beneficiary_partners(id) on delete cascade,
  privy_user_id text not null
    references public.profiles(privy_user_id) on delete cascade,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficiary_wallets_address_valid
    check (address ~ '^0x[0-9A-Fa-f]{40}$')
);

create unique index if not exists beneficiary_wallets_user_address_unique
  on public.beneficiary_wallets (privy_user_id, lower(address));

create index if not exists beneficiary_wallets_partner_idx
  on public.beneficiary_wallets (partner_id, created_at);

drop trigger if exists beneficiary_wallets_set_updated_at
  on public.beneficiary_wallets;

create trigger beneficiary_wallets_set_updated_at
before update on public.beneficiary_wallets
for each row execute function public.set_updated_at();

alter table public.beneficiary_wallets enable row level security;

drop policy if exists beneficiary_wallets_deny_anon
  on public.beneficiary_wallets;
create policy beneficiary_wallets_deny_anon
  on public.beneficiary_wallets
  for all to anon using (false) with check (false);

drop policy if exists beneficiary_wallets_deny_authenticated
  on public.beneficiary_wallets;
create policy beneficiary_wallets_deny_authenticated
  on public.beneficiary_wallets
  for all to authenticated using (false) with check (false);

grant select, insert, update, delete
  on public.beneficiary_wallets to service_role;


insert into public.beneficiary_partners (
  id,
  privy_user_id,
  name,
  partner_type,
  created_at,
  updated_at
)
select
  b.id,
  b.privy_user_id,
  b.name,
  'private',
  b.created_at,
  b.created_at
from public.beneficiaries b
on conflict (id) do nothing;

insert into public.beneficiary_wallets (
  partner_id,
  privy_user_id,
  address,
  created_at,
  updated_at
)
select
  b.id,
  b.privy_user_id,
  b.address,
  b.created_at,
  b.created_at
from public.beneficiaries b
where not exists (
  select 1
  from public.beneficiary_wallets w
  where w.privy_user_id = b.privy_user_id
    and lower(w.address) = lower(b.address)
);


alter table public.payments
  add column if not exists beneficiary_partner_id uuid
  references public.beneficiary_partners(id) on delete set null;

create index if not exists payments_beneficiary_partner_idx
  on public.payments (privy_user_id, beneficiary_partner_id, settled_at desc);

update public.payments p
set beneficiary_partner_id = b.id
from public.beneficiaries b
where p.beneficiary_partner_id is null
  and p.privy_user_id = b.privy_user_id
  and lower(p.destination) = lower(b.address);


alter table public.business_payment_requests
  add column if not exists business_name_snapshot text;

alter table public.business_payment_requests
  drop constraint if exists business_payment_requests_business_name_length;

alter table public.business_payment_requests
  add constraint business_payment_requests_business_name_length
  check (
    business_name_snapshot is null
    or length(business_name_snapshot) between 1 and 120
  );

commit;
