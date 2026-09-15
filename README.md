# Krypto121 v0.21 — Real multi-asset model

Overlay for the current v0.20 project.

## Production

Krypto121 now supports two real stablecoins on Celo Mainnet:

```text
USDT
USDC
```

Both can be sent and received directly.

The Krypto121 embedded wallet pays Celo network fees in the same selected stablecoin through Celo fee abstraction.

## Why only Celo in this milestone?

This milestone expands the **asset model**, not the route provider surface.

Keeping USDT and USDC on the already-live Celo network gives Krypto121 a real multi-asset model without introducing Base or another chain before the first Relay integration.

The next routing milestone can then use the same asset registry to model source and destination assets on different networks.

## No migration

No Supabase migration and no new environment variables.

Production stays:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
```

Apply the overlay and run:

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
