# Krypto121 v0.21 — Real multi-asset model

v0.21 adds the first real multi-asset payment model.

## Mainnet assets

Celo Mainnet:

- USDT — `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e`
- USDC — `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`

Both use 6 decimals.

Fee-currency adapters:

- USDT — `0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72`
- USDC — `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`

## User flow

Send:

```text
Pay from
Asset: USDT / USDC
Recipient
Amount
Review
Approve & send
```

Receive lets the user create an asset-specific QR/payment request.

A USDC payment request cannot silently turn into USDT, and vice versa.

## Settlement

The direct Celo verifier now resolves the stablecoin from the PaymentIntent and verifies:

- active supported asset;
- exact token contract;
- exact decimals;
- source/destination asset equality;
- source wallet;
- recipient;
- amount;
- successful transaction.

## Testnet

Testnet deliberately remains USDTd-only. No temporary second test token is added.

## Database

No migration is required. `payments.asset_symbol` and JSON intent/quote fields already support multiple asset symbols.

## Apply

Copy the overlay over v0.20, then run:

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
