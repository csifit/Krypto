-- Krypto121 v0.15 Bitcoin watch-only wallets.
-- Bitcoin addresses remain view-only: no ownership claim and no signing capability.

drop index if exists public.watch_wallets_user_address_unique;

alter table public.watch_wallets
  drop constraint if exists watch_wallets_address_valid,
  drop constraint if exists watch_wallets_chain_type_valid;

alter table public.watch_wallets
  add constraint watch_wallets_chain_type_valid
    check (chain_type in ('ethereum', 'bitcoin')),
  add constraint watch_wallets_address_valid
    check (
      (chain_type = 'ethereum' and address ~ '^0x[0-9A-Fa-f]{40}$')
      or
      (
        chain_type = 'bitcoin'
        and (
          address ~ '^[13][1-9A-HJ-NP-Za-km-z]{25,34}$'
          or lower(address) ~ '^bc1[ac-hj-np-z02-9]{11,71}$'
        )
      )
    );

create unique index if not exists watch_wallets_user_evm_address_unique
  on public.watch_wallets (privy_user_id, lower(address))
  where chain_type = 'ethereum';

create unique index if not exists watch_wallets_user_bitcoin_address_unique
  on public.watch_wallets (
    privy_user_id,
    (case when lower(address) like 'bc1%' then lower(address) else address end)
  )
  where chain_type = 'bitcoin';
