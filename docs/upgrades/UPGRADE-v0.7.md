# Krypto121 v0.7 upgrade

## Database

Apply:

```text
supabase/migrations/202609140002_watch_wallets.sql
```

Expected SQL Editor result:

```text
Success. No rows returned
```

## What it adds

- `My wallets` sidebar section
- link an external EVM wallet through Privy
- watch-only wallet storage in Supabase
- Krypto121 branding
- new homepage positioning

## Important boundaries

- External-wallet linking requires a wallet signature; Krypto121 does not receive the private key.
- Watch-only wallets never receive signing capability.
- The current Send / Receive flow still uses the embedded Krypto121 wallet.
- No mainnet changes are included.
- No new environment variables are required.

## Verify

```powershell
npm install
npm run build
```

Then test My wallets and one normal USDTd payment.
