# Krypto121 v0.22 — Relay

v0.22 adds Krypto121's first real alternative route:

```text
Celo USDC → Base USDC
```

Relay is selected automatically only when the payment intent requires the cross-network route.

Normal users do not choose a provider.

## UI refinement

Stablecoin balances are now shown vertically:

```text
12.50 USDT
8.00 USDC
```

instead of side by side.

## Migration

Apply:

`supabase/migrations/202609150008_relay_quotes.sql`

## Environment

`RELAY_API_KEY` is optional. It is server-side only.

Relay's default unauthenticated limits are sufficient for initial low-volume integration. Add an API key later when Krypto121 needs higher throughput.

## Build

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
