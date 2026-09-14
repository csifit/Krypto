-- Krypto121 v0.16 mainnet-readiness foundations.
-- New payments are verified against the blockchain before being persisted.

alter table public.payments
  add column if not exists verified_at timestamptz,
  add column if not exists settlement_block_number bigint,
  add column if not exists chain_id bigint;

create unique index if not exists payments_network_tx_unique
  on public.payments (network, lower(tx_hash))
  where network is not null;

comment on column public.payments.verified_at is
  'Time Krypto121 server verified the recorded settlement against the blockchain.';

comment on column public.payments.settlement_block_number is
  'Block containing the verified settlement transaction.';

comment on column public.payments.chain_id is
  'EVM chain ID used for server-side settlement verification.';
