# Upgrade to Krypto v0.6

## New dependencies

- `@privy-io/node`
- `@supabase/supabase-js`

## New server environment variables

```env
PRIVY_APP_SECRET=
SUPABASE_URL=https://yueskxkbwlanxcqntpsi.supabase.co
SUPABASE_SECRET_KEY=
```

Keep your existing:

```env
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

## Apply migration

Run the contents of:

```text
supabase/migrations/202609140001_krypto_persistence.sql
```

in the Supabase SQL Editor.

## Vercel

Add `PRIVY_APP_SECRET`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` to Production and Preview environments, then redeploy.

Do not expose either secret with a `NEXT_PUBLIC_` prefix.

## Storage transition

v0.6 stops using browser localStorage for beneficiaries and payment history. Existing v0.5 test records are not automatically imported; new records are persisted in Supabase.
