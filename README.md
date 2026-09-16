# Krypto121 v0.27 — Fiat UI + provider connection checks

This package is a root overlay. Extract it directly over the Krypto project root.

## Visible immediately

### Sidebar

A new visible item:

```text
Buy / Cash out
```

opens:

```text
/fiat
```

### Fiat UI

The page exposes both directions:

```text
Fiat → stablecoin
Stablecoin → fiat
```

The UI keeps the first screen simple:

- Buy stablecoins / Cash out
- Country of residence
- Amount
- Fiat currency
- Stablecoin/network
- Wallet
- Payment/payout method
- Review

Krypto121 asks all configured fiat providers for a quote and automatically selects the best valid result.

Provider name and detailed fees are kept under the review details rather than shown as the first decision.

### Developer tools

Developer tools now contains a visible:

```text
Provider connections
[ Check connections ]
```

panel.

The button checks every provider registered in Krypto121. Today that is Coinbase. Future providers such as Kraken use the same panel automatically once registered.

## Server routes

```text
GET  /api/fiat/providers/status
GET  /api/fiat/options
POST /api/fiat/quote
POST /api/fiat/session
GET  /api/fiat/session?id=...
```

All routes require the existing Privy authentication.

Provider secrets remain server-only.

## Vercel request location

This version adds:

```text
@vercel/functions
```

and uses Vercel's request helpers for:

- country/region suggestion
- end-user IP passed to the fiat provider

The IP is not accepted from the browser payload and is not persisted in Krypto121's fiat quote table.

## Persistence

Migration 012 adds:

```text
fiat_quotes
fiat_sessions
```

Both are server/service-role only. Browser roles are denied by RLS.

The hosted provider URL/session token is not stored in these tables.

## Coinbase redirect allowlist

Before testing the hosted Coinbase flow in production, add:

```text
https://www.krypto121.app
```

under:

```text
CDP Portal
→ Payments
→ Onramp & Offramp
→ Domain Allowlist
```

The `/fiat` return path is covered by the domain entry.

## Apply

1. Extract this ZIP over:

```text
C:\Users\cozum\Coding\GPT\Krypto
```

2. Check migration state:

```powershell
npx supabase migration list
npx supabase db push --dry-run
```

3. Apply migration 012:

```powershell
npx supabase db push
```

4. Install the new Vercel Functions dependency and build:

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```

## No new secrets

This step uses the existing server-only Coinbase variables already configured in Vercel:

```text
COINBASE_CDP_API_KEY_ID
COINBASE_CDP_API_KEY_SECRET
```

No new provider secret is added in v0.27.
