# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

Krypto121 is currently a testnet, business-first stablecoin payments application.

## v0.7 — My wallets

v0.7 introduces the first wallet directory without changing the tested payment flow.

### Wallet types

- **Krypto121 wallet** — the existing Privy embedded wallet used by the current Send / Receive flow.
- **Linked wallet** — an external wallet the user connects and verifies ownership of through Privy.
- **Watch-only wallet** — an address saved in Krypto121 for monitoring; it can never sign or move funds.

Linked external wallets are tied to the Privy user account. Watch-only wallet records are stored in Supabase.

Krypto121 never asks users to paste a seed phrase or private key.

## What stays unchanged

- Celo Sepolia development network
- USDTd test token
- user-authorized payment signing
- PaymentIntent -> Quote -> Route boundary
- beneficiaries and payment history persistence
- simple dashboard: My wallet, Balance, Send / Receive
- optional dark mode

The current Send flow still uses the Krypto121 embedded wallet as its source. Selecting another linked wallet as the payment source comes in a later milestone.

## Upgrade from v0.6

### 1. Apply migration 002

Run this file in the krypto121 Supabase SQL Editor:

```text
supabase/migrations/202609140002_watch_wallets.sql
```

It adds only:

```text
watch_wallets
```

Migration 001 remains unchanged.

### 2. Environment variables

No new environment variables are required.

Keep:

```env
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
SUPABASE_URL=https://yueskxkbwlanxcqntpsi.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

### 3. Install / build

```bash
npm install
npm run build
npm run dev
```

## v0.7 acceptance test

1. Sign in with the existing Krypto121 account.
2. Confirm the normal dashboard still has only My wallet, Balance, and Send / Receive.
3. Open **My wallets** from the sidebar.
4. Confirm the Krypto121 embedded wallet appears as Active.
5. Click **Link existing wallet**, connect an external EVM wallet, and approve the ownership signature.
6. Confirm the wallet appears as Linked.
7. Add a separate EVM address as **watch-only**.
8. Refresh or sign in on another browser and confirm the watch-only address remains.
9. Remove the watch-only wallet and confirm it disappears.
10. Send a normal USDTd test payment from the Krypto121 wallet and confirm the existing payment flow still works.

See `docs/ARCHITECTURE.md` and `UPGRADE-v0.7.md`.
