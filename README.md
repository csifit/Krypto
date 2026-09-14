# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

Krypto121 is currently a testnet, business-first stablecoin payments application.

## v0.10 — Blockchain abstraction UX

v0.10 applies a simple product rule:

> Show payment concepts first. Show blockchain mechanics only when they are useful.

The normal Krypto121 experience now avoids exposing Celo/Blockscout details unnecessarily.

### Main UX changes

- **My wallet** keeps the address and Copy action, but the explorer link moves out of the main card.
- **My wallets** shows USDTd plus a simple **Network fees · Ready / Needs funds** status instead of the raw CELO amount for owned wallets.
- Watch-only wallets show the monitored USDTd balance without implying that they can pay network fees.
- **Receive** no longer exposes the network name or an explorer link in the normal flow.
- **Send review** uses plain-language route and network-fee descriptions.
- Successful payments and Payment history keep blockchain information inside **Technical details**.
- **Developer / test tools** still expose Celo Sepolia and a wallet explorer link for testing.

## Important boundary

This is a UX abstraction only.

Krypto121 still uses:

- Celo Sepolia for development settlement;
- USDTd as the test stablecoin;
- CELO underneath for network transaction fees;
- Privy for wallet authorization;
- Supabase for durable business metadata.

v0.10 does **not** sponsor gas or remove the underlying CELO requirement yet. True gas abstraction remains a later milestone.

## What stays unchanged

- wallet linking and watch-only wallets
- portfolio balance aggregation
- selectable PaymentIntent source wallet
- selectable Receive wallet
- beneficiaries
- payment history
- direct Celo test route
- non-custodial wallet model
- future Privy -> custom Krypto121 MPC direction

## Upgrade from v0.9

No database migration and no new environment variables are required.

```bash
npm install
npm run build
npm run dev
```

## v0.10 acceptance test

1. Sign in and confirm the main **My wallet** card no longer shows an explorer link.
2. Open **My wallets** and confirm owned wallets show USDTd plus **Network fees · Ready / Needs funds**, not a CELO number.
3. Confirm watch-only wallets still show their USDTd balance and remain view-only.
4. Open **Receive** and confirm no Celo/Blockscout language appears in the normal flow.
5. Create a payment and confirm the route reads **Direct stablecoin transfer**.
6. Confirm Network fee reads **Paid by the source wallet**.
7. Complete a test payment and confirm the success screen is simple.
8. Expand **Technical details** and verify the Celo Sepolia network, transaction ID and blockchain link are available.
9. Open **Payment history** and verify blockchain details are similarly collapsed.
10. Open **Developer / test tools** and confirm the Celo Sepolia technical information and wallet explorer remain available.

See `docs/ARCHITECTURE.md` and `docs/upgrades/UPGRADE-v0.10.md`.
