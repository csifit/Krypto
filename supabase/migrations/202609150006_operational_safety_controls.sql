-- Krypto121 v0.17 operational safety controls.
-- Normal users remain unrestricted by default. Super-admin controls are exceptional safeguards.

alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user',
  add column if not exists account_status text not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by text;

alter table public.profiles
  drop constraint if exists profiles_role_valid,
  add constraint profiles_role_valid check (role in ('user', 'super_admin'));

alter table public.profiles
  drop constraint if exists profiles_account_status_valid,
  add constraint profiles_account_status_valid check (
    account_status in ('active', 'suspended', 'blocked')
  );

create index if not exists profiles_account_status_idx
  on public.profiles (account_status);

create index if not exists profiles_role_idx
  on public.profiles (role);

create table if not exists public.operational_settings (
  id smallint primary key default 1,
  payments_enabled boolean not null default true,
  mainnet_payments_enabled boolean not null default false,
  max_payment_amount numeric(78, 18),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint operational_settings_singleton check (id = 1),
  constraint operational_settings_max_amount_positive check (
    max_payment_amount is null or max_payment_amount > 0
  )
);

insert into public.operational_settings (
  id,
  payments_enabled,
  mainnet_payments_enabled,
  max_payment_amount
)
values (1, true, false, null)
on conflict (id) do nothing;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_privy_user_id text not null,
  action text not null,
  target_privy_user_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_action_not_blank check (length(btrim(action)) > 0)
);

create index if not exists admin_audit_created_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_target_idx
  on public.admin_audit_log (target_privy_user_id, created_at desc);

alter table public.operational_settings enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists operational_settings_deny_anon on public.operational_settings;
create policy operational_settings_deny_anon on public.operational_settings
for all to anon using (false) with check (false);

drop policy if exists operational_settings_deny_authenticated on public.operational_settings;
create policy operational_settings_deny_authenticated on public.operational_settings
for all to authenticated using (false) with check (false);

drop policy if exists admin_audit_deny_anon on public.admin_audit_log;
create policy admin_audit_deny_anon on public.admin_audit_log
for all to anon using (false) with check (false);

drop policy if exists admin_audit_deny_authenticated on public.admin_audit_log;
create policy admin_audit_deny_authenticated on public.admin_audit_log
for all to authenticated using (false) with check (false);

revoke all on public.operational_settings from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

grant select, update on public.operational_settings to service_role;
grant select, insert on public.admin_audit_log to service_role;
