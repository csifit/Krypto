# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

Krypto121 is currently a testnet, business-first stablecoin payments application.

## v0.8 — Choose payment source

v0.8 lets a user create a `PaymentIntent` from either:

- the Krypto121 embedded wallet; or
- a linked external EVM wallet that is currently connected and able to sign.

Watch-only wallets remain view-only and can never become a payment source.

### Payment flow

```text
Connected source wallet
        ↓
PaymentIntent
        ↓
Krypto121 route / quote
        ↓
User approves in the selected wallet
        ↓
Celo Sepolia
        ↓
Payment history
```

The router still returns the simple direct Celo test route. The important change is that the source wallet is now part of the payment intent rather than being hard-wired to the embedded wallet.

## What stays unchanged

- Celo Sepolia development network
- USDTd test token
- Privy authentication and wallet linking
- Supabase persistence
- beneficiaries and payment history
- PaymentIntent -> Quote -> Route boundary
- simple dashboard: My wallet, Balance, Send / Receive
- optional dark mode
- future Privy -> custom Krypto121 MPC direction

## Upgrade from v0.7

No database migration and no new environment variables are required.

```bash
npm install
npm run build
npm run dev
```

## v0.8 acceptance test

1. Sign in to Krypto121.
2. Open **My wallets**.
3. Confirm the embedded Krypto121 wallet is available.
4. Confirm a previously linked external wallet appears.
5. If it says it is saved but not connected, click **Connect for payment**.
6. Make sure the external wallet has some USDTd on Celo Sepolia for testing.
7. Open **Send**.
8. Confirm **Pay from** lists the Krypto121 wallet plus connected linked wallets.
9. Select the external wallet.
10. Confirm Krypto121 reads that wallet's USDTd balance.
11. Create a small payment, review the quote, and confirm **Pay from** shows the selected external wallet.
12. Approve the transaction in that external wallet.
13. Confirm the transaction settles on Celo Sepolia and appears in Payment history with that external source address.
14. Repeat with the embedded Krypto121 wallet and confirm the original path still works.

Watch-only wallets must never appear in **Pay from**.

See `docs/ARCHITECTURE.md` and `docs/upgrades/UPGRADE-v0.8.md`.
