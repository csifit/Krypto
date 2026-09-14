# Upgrade v0.15 — Bitcoin watch-only

## Database

Apply migration:

```text
202609140004_bitcoin_watch_wallets.sql
```

The migration expands `watch_wallets.chain_type` from only `ethereum` to:

```text
ethereum
bitcoin
```

Existing EVM watch-only rows are unchanged.

## Functional test

1. Open **My wallets**.
2. Click **Add watch-only**.
3. Choose **Bitcoin wallet**.
4. Enter a valid Bitcoin mainnet address.
5. Save it.
6. Confirm the row shows a BTC balance.
7. Expand the row and confirm **View on Bitcoin explorer** works.
8. Confirm **Make payment from this wallet** remains disabled.

## Boundary

Bitcoin is monitoring-only in v0.15. Krypto121 does not hold keys and does not create or broadcast Bitcoin transactions.

No new environment variables are required.
