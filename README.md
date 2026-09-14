# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.15 — Bitcoin watch-only

My wallets can now monitor Bitcoin addresses as well as the existing stablecoin/EVM wallets.

Choose:

```text
My wallets
→ Add watch-only
→ Wallet type: Bitcoin wallet
→ Bitcoin address
```

The wallet row then shows its BTC balance and expands to full read-only details.

Bitcoin support in v0.15 is deliberately limited to monitoring:

- no Bitcoin private keys;
- no seed phrases;
- no Bitcoin signing;
- no Bitcoin sending;
- no Bitcoin payment routing yet.

Balances are read from public Bitcoin blockchain data server-side.

## Upgrade

Apply:

```text
supabase/migrations/202609140004_bitcoin_watch_wallets.sql
```

Then run:

```bash
npm install
npm run build
```

No new environment variables are required.
