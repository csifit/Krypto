# Upgrade to v0.9 — Wallet portfolio

v0.9 extends the multi-wallet model introduced in v0.7/v0.8.

## New behavior

- Read USDTd and CELO balances for all tracked Celo Sepolia addresses.
- Show balances beside embedded, linked, and watch-only wallets.
- Main dashboard Balance is now the total USDTd across owned wallets.
- Watch-only balances are excluded from the owned total.
- Receive can target either the embedded wallet or any verified linked wallet.
- Send continues to use the selected connected signing wallet from v0.8.

## Database

No migration is required.

Balances remain blockchain-derived and are not persisted as authoritative values in Supabase.

## Environment

No new environment variables are required.

## Install

```powershell
npm install
npm run build
npm run dev
```

## Acceptance

- My wallets shows per-wallet balances.
- Main Balance equals embedded + verified linked USDTd balances.
- Watch-only balances never contribute to the owned total.
- Receive lets the user choose an owned destination wallet.
- Existing source-wallet payment flow still settles successfully.
