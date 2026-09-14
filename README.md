# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.16 — Mainnet-readiness foundations

This milestone does **not** enable real-money transfers.

It strengthens the payment record boundary so a browser can no longer simply claim that a payment settled.

For the current direct test route, the server verifies the actual blockchain transaction before storing the durable payment record.

Checks include:

- source wallet belongs to the authenticated Privy user;
- transaction succeeded;
- expected token contract;
- expected sender;
- expected recipient;
- exact token amount;
- matching intent / quote / route / asset.

The server records the blockchain-derived settlement time, block number, chain ID and verification time.

## Upgrade

Apply migration:

```text
supabase/migrations/202609140005_payment_settlement_verification.sql
```

Then:

```bash
npm install
npm run build
```

Keep:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

No new environment variables are required.

See `docs/upgrades/UPGRADE-v0.16.md`.
