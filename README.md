# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

Krypto121 is currently a testnet, business-first stablecoin payments application.

## v0.9 — Wallet portfolio

v0.9 makes the wallet directory useful as a single place to monitor the user's wallets.

Krypto121 now reads Celo Sepolia balances for:

- the Krypto121 embedded wallet;
- verified linked external wallets; and
- watch-only EVM addresses.

The main **Balance** card shows the total USDTd across owned wallets only:

```text
embedded wallet + verified linked wallets
```

Watch-only balances are visible in **My wallets** but are deliberately excluded from the owned total.

## Send / Receive

Send keeps the v0.8 behavior:

```text
choose connected source wallet
        ↓
PaymentIntent.sourceWallet
        ↓
route / quote
        ↓
selected wallet approves
```

Receive now lets the user choose which owned wallet address should receive funds. A linked wallet does not need to be connected just to display its receive address.

## Source of truth

Celo Sepolia remains the source of truth for balances and settlement. Portfolio balances are read directly from the chain; they are not stored as authoritative balances in Supabase.

## What stays unchanged

- Celo Sepolia development network
- USDTd test token
- Privy authentication and wallet linking
- Supabase persistence for business metadata
- beneficiaries and payment history
- PaymentIntent -> Quote -> Route boundary
- simple dashboard: My wallet, Balance, Send / Receive
- optional dark mode
- future Privy -> custom Krypto121 MPC direction

## Upgrade from v0.8

No database migration and no new environment variables are required.

```bash
npm install
npm run build
npm run dev
```

## v0.9 acceptance test

1. Sign in to Krypto121.
2. Open **My wallets**.
3. Confirm the embedded wallet shows USDTd and CELO balances.
4. Confirm linked wallets show their Celo Sepolia USDTd and CELO balances.
5. Add a watch-only Celo/EVM address and confirm its balances appear.
6. Confirm watch-only funds do **not** increase the main dashboard Balance total.
7. Confirm verified linked-wallet USDTd **does** contribute to the main dashboard Balance total.
8. Click **Receive** and confirm you can choose between the embedded wallet and linked wallets.
9. Copy a linked wallet's receive address and verify it is correct.
10. Send a small payment from a connected linked wallet and confirm the source-wallet balance and total owned balance refresh after settlement.

See `docs/ARCHITECTURE.md` and `docs/upgrades/UPGRADE-v0.9.md`.
