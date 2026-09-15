# Krypto121 v0.20 — USDT network fees on Celo

v0.20 adds Celo-native fee abstraction for the Krypto121 embedded wallet on Celo Mainnet.

## User experience

For the Krypto121 wallet on mainnet:

```text
Send USDT
  ↓
Network fee estimated in USDT
  ↓
User reviews recipient amount + fee + estimated total
  ↓
User approves once
  ↓
Celo deducts the network fee in USDT
```

A separate CELO balance is not required for this path.

Linked external wallets keep their own wallet fee behavior for compatibility. In particular, generic Ethereum wallets such as MetaMask may use the Ethereum-compatible Celo transaction format and therefore still require CELO for gas.

## Celo fee currency

USDT token:
`0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e`

USDT fee-currency adapter:
`0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72`

The adapter is used only as `feeCurrency`. The USDT transfer itself still targets the USDT token contract.

## No migration

No Supabase migration is required.

No new environment variables are required.

## Test

Production remains:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
```

Use the Krypto121 embedded wallet as payment source.

The readiness panel should show:

```text
Network fees · Paid in USDT
```

Review should show an estimated USDT network fee and estimated total.

A successful payment should show under Technical details:

```text
Network fee · Paid in USDT
```
