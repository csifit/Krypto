# Upgrade to Krypto121 v0.8

## Goal

Allow the user to choose the signing wallet that becomes the `sourceWallet` of a `PaymentIntent`.

## Database

No migration is required.

The existing `payments.source_wallet` column already records the actual source address, and the complete payment intent is already stored as JSON.

## Environment

No new environment variables are required.

## Main changes

- `SendPanel` now has **Pay from**.
- The embedded Krypto121 wallet remains the default source.
- Linked external EVM wallets become selectable when they are currently connected.
- The selected wallet's USDTd balance is read directly from Celo Sepolia.
- The selected source wallet signs the transaction.
- `PaymentIntent.sourceWallet` records the selected source address.
- Payment history continues to be stored under the same authenticated Krypto121 account.
- Watch-only wallets remain excluded from signing and from the source selector.

## Linked versus connected

A wallet can remain linked to the Krypto121 account while not currently connected to the browser session.

The **My wallets** panel therefore shows **Connect for payment** when a linked external wallet needs a live wallet connection before it can sign.

## Test

Use testnet only.

A convenient test is:

```text
Krypto121 embedded wallet
        ↓ send some USDTd
External linked wallet
        ↓
Select external wallet in Pay from
        ↓
Send part of it back
```

The final Celo Sepolia transaction should show the external wallet as `from`.

## Security boundary

Krypto121 never requests the external wallet's seed phrase or private key. The wallet itself approves and signs the transaction.

Before mainnet, payment-record persistence should additionally verify settled transaction details against the blockchain server-side rather than trusting payment metadata supplied by the browser.
