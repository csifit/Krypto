begin;

create table if not exists public.business_payment_requests (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text not null references public.profiles(privy_user_id) on delete cascade,
  recipient text not null,
  asset_symbol text not null,
  network text not null,
  amount numeric(78, 18) not null,
  memo text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  payment_tx_hash text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_payment_requests_recipient_valid
    check (recipient ~ '^0x[0-9A-Fa-f]{40}$'),
  constraint business_payment_requests_amount_positive
    check (amount > 0),
  constraint business_payment_requests_tx_hash_valid
    check (payment_tx_hash is null or payment_tx_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  constraint business_payment_requests_memo_length
    check (memo is null or length(memo) <= 120)
);

create index if not exists business_payment_requests_user_created_idx
  on public.business_payment_requests (privy_user_id, created_at desc);

create index if not exists business_payment_requests_status_idx
  on public.business_payment_requests (privy_user_id, status, created_at desc);

drop trigger if exists business_payment_requests_set_updated_at
  on public.business_payment_requests;

create trigger business_payment_requests_set_updated_at
before update on public.business_payment_requests
for each row execute function public.set_updated_at();

alter table public.business_payment_requests enable row level security;

drop policy if exists business_payment_requests_deny_anon
  on public.business_payment_requests;
create policy business_payment_requests_deny_anon
  on public.business_payment_requests
  for all to anon using (false) with check (false);

drop policy if exists business_payment_requests_deny_authenticated
  on public.business_payment_requests;
create policy business_payment_requests_deny_authenticated
  on public.business_payment_requests
  for all to authenticated using (false) with check (false);

grant select, insert, update, delete
  on public.business_payment_requests to service_role;

commit;
