# Upgrade v0.16 — Mainnet-readiness foundations

v0.16 hardens Krypto121's settlement boundary without enabling mainnet.

## What changes

Before a settled payment is written to Supabase, the Krypto121 server now verifies:

- the authenticated Privy user has the account wallet linked;
- the authenticated Privy user has the source wallet linked;
- the blockchain transaction succeeded;
- source wallet matches;
- token contract matches;
- recipient matches;
- amount matches;
- payment intent, quote, route and asset match.

The server uses the blockchain block timestamp for `settled_at`.

## Migration 005

Apply:

```text
supabase/migrations/202609140005_payment_settlement_verification.sql
```

It adds:

```text
verified_at
settlement_block_number
chain_id
```

and a unique `(network, tx_hash)` index.

Historical test payments are left intact and may have null verification metadata.

## Mainnet

Mainnet remains disabled. Keep:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

No new environment variables are required.
