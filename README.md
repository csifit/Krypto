# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.14 — Wallet names

Users can now give owned wallets simple private names.

```text
Company treasury
Operations
Personal
```

Open **My wallets**, expand an owned wallet and choose **Rename**.

The name follows the wallet into:

- My wallets
- Send → Pay from
- Receive → Receive into

The wallet address, provider and ownership status are unchanged.

Watch-only wallets continue to use their existing saved labels.

## Upgrade

Apply migration:

```text
supabase/migrations/202609140003_wallet_labels.sql
```

Then:

```bash
npm install
npm run build
```

No new environment variables are required.

See `docs/upgrades/UPGRADE-v0.14.md`.
