-- Krypto121 v0.18 privileged admin access.
-- Super-admin controls require a short-lived, wallet-signed elevated session.
-- Normal Krypto121 user accounts are unchanged.

create table if not exists public.admin_elevation_challenges (
  id uuid primary key,
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  wallet_address text not null,
  challenge_message text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_elevation_challenge_wallet_valid check (
    wallet_address ~ '^0x[0-9A-Fa-f]{40}$'
  )
);

create index if not exists admin_elevation_challenges_user_created_idx
  on public.admin_elevation_challenges (privy_user_id, created_at desc);

create index if not exists admin_elevation_challenges_expires_idx
  on public.admin_elevation_challenges (expires_at);

create table if not exists public.admin_elevated_sessions (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_elevated_session_token_hash_valid check (
    token_hash ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists admin_elevated_sessions_user_expires_idx
  on public.admin_elevated_sessions (privy_user_id, expires_at desc);

alter table public.admin_elevation_challenges enable row level security;
alter table public.admin_elevated_sessions enable row level security;

drop policy if exists admin_elevation_challenges_deny_anon
  on public.admin_elevation_challenges;
create policy admin_elevation_challenges_deny_anon
  on public.admin_elevation_challenges
  for all to anon using (false) with check (false);

drop policy if exists admin_elevation_challenges_deny_authenticated
  on public.admin_elevation_challenges;
create policy admin_elevation_challenges_deny_authenticated
  on public.admin_elevation_challenges
  for all to authenticated using (false) with check (false);

drop policy if exists admin_elevated_sessions_deny_anon
  on public.admin_elevated_sessions;
create policy admin_elevated_sessions_deny_anon
  on public.admin_elevated_sessions
  for all to anon using (false) with check (false);

drop policy if exists admin_elevated_sessions_deny_authenticated
  on public.admin_elevated_sessions;
create policy admin_elevated_sessions_deny_authenticated
  on public.admin_elevated_sessions
  for all to authenticated using (false) with check (false);

revoke all on public.admin_elevation_challenges from anon, authenticated;
revoke all on public.admin_elevated_sessions from anon, authenticated;

grant select, insert, update, delete on public.admin_elevation_challenges to service_role;
grant select, insert, update, delete on public.admin_elevated_sessions to service_role;
