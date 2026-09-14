-- Krypto121 v0.14 user-defined names for owned wallets.
-- These are private account metadata. They do not claim ownership and do not affect signing.

create table if not exists public.wallet_labels (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  address text not null,
  address_key text generated always as (lower(address)) stored,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_labels_address_valid check (address ~ '^0x[0-9A-Fa-f]{40}$'),
  constraint wallet_labels_label_valid check (length(btrim(label)) between 1 and 100),
  constraint wallet_labels_user_address_unique unique (privy_user_id, address_key)
);

drop trigger if exists wallet_labels_set_updated_at on public.wallet_labels;
create trigger wallet_labels_set_updated_at
before update on public.wallet_labels
for each row execute function public.set_updated_at();

alter table public.wallet_labels enable row level security;

drop policy if exists wallet_labels_deny_anon on public.wallet_labels;
create policy wallet_labels_deny_anon on public.wallet_labels
for all to anon using (false) with check (false);

drop policy if exists wallet_labels_deny_authenticated on public.wallet_labels;
create policy wallet_labels_deny_authenticated on public.wallet_labels
for all to authenticated using (false) with check (false);

revoke all on public.wallet_labels from anon, authenticated;
grant select, insert, update, delete on public.wallet_labels to service_role;
