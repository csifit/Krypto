# Krypto

Krypto is a business-first stablecoin payments application.

## v0.6

v0.6 adds the first durable Krypto backend while keeping the tested wallet and payment flow unchanged.

### What persists now

- Krypto profile -> Privy user ID + current embedded wallet address
- beneficiaries
- payment intent / quote / route metadata
- settled transaction hash and memo

### What does **not** move into the database

The blockchain remains the source of truth for:

- USDT / USDTd ownership
- token balance
- actual settlement

Supabase stores business metadata, not a fabricated crypto ledger.

## Authentication boundary

The browser authenticates with Privy. Every Krypto API request sends the short-lived Privy access token to the Next.js backend. The backend verifies that token with Privy before touching Supabase.

The browser does **not** receive a Supabase secret key and does not directly query the three v0.6 tables.

## Setup

### 1. Apply the database migration

Open the Supabase project SQL Editor and run:

```text
supabase/migrations/202609140001_krypto_persistence.sql
```

Project URL:

```text
https://yueskxkbwlanxcqntpsi.supabase.co
```

### 2. Environment variables

Keep the existing variables and add:

```env
PRIVY_APP_SECRET=...
SUPABASE_URL=https://yueskxkbwlanxcqntpsi.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

`PRIVY_APP_SECRET` and `SUPABASE_SECRET_KEY` are server secrets. Never prefix them with `NEXT_PUBLIC_`.

### 3. Install / build

```bash
npm install
npm run build
npm run dev
```

## Acceptance test

1. Sign in to Krypto.
2. Add a beneficiary.
3. Refresh the browser: beneficiary should remain.
4. Sign into the same account in another browser/device: beneficiary should appear there too.
5. Send a test USDTd payment.
6. Open Payment history: payment should appear.
7. Refresh or use another browser: payment should remain.

See `docs/ARCHITECTURE.md` and `UPGRADE-v0.6.md`.
